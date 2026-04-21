// AT Protocol (Bluesky) Jetstream ingestor.
//
// Jetstream (https://github.com/bluesky-social/jetstream) is the filtered,
// JSON-serialised view of the Bluesky firehose. We subscribe with
// `wantedCollections` narrowed to our custom NSIDs, pass a cursor (time in
// microseconds), and drain for ~20 seconds each cron tick. Every create
// op for a whitelisted DID is routed through the shared indexer.
//
// Events come with a repo-level CID which we use as the row `cid`.
// The at:// URI is `at://<did>/<collection>/<rkey>`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  applyDeletion,
  readCursor,
  upsertComment,
  upsertReaction,
  writeCursor,
  type IngestContext,
} from "../_shared/indexer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CURSOR_SOURCE = "atproto-jetstream";
const JETSTREAM_BASE = "wss://jetstream2.us-east.bsky.network/subscribe";
const COMMENT_COLLECTION = "com.source-of-clarity.temp.comment";
const REACTION_COLLECTION = "com.source-of-clarity.temp.reaction";
const WANTED_COLLECTIONS = [COMMENT_COLLECTION, REACTION_COLLECTION];
const DRAIN_BUDGET_MS = 20_000;

interface JetstreamCommitEvent {
  did: string;
  time_us: number;
  kind: "commit";
  commit: {
    rev: string;
    operation: "create" | "update" | "delete";
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
    cid?: string;
  };
}

interface JetstreamIdentityEvent { kind: "identity"; did: string; time_us: number; }
interface JetstreamAccountEvent { kind: "account"; did: string; time_us: number; }

type JetstreamEvent = JetstreamCommitEvent | JetstreamIdentityEvent | JetstreamAccountEvent;

interface DrainResult {
  eventsSeen: number;
  eventsIndexed: number;
  latestTimeUs: number;
  errors: string[];
}

async function loadWhitelist(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("ingest_whitelist")
    .select("identifier")
    .eq("author_type", "atproto");
  if (error) {
    console.error("Failed to load atproto whitelist:", error);
    return new Set();
  }
  return new Set((data as { identifier: string }[]).map((r) => r.identifier));
}

function buildStreamUrl(cursor: string): string {
  const params = new URLSearchParams();
  for (const c of WANTED_COLLECTIONS) params.append("wantedCollections", c);
  if (cursor && cursor !== "0") params.set("cursor", cursor);
  return `${JETSTREAM_BASE}?${params.toString()}`;
}

function drainJetstream(
  url: string,
  onEvent: (ev: JetstreamEvent) => Promise<void>,
  deadline: number,
): Promise<void> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn("Jetstream connect failed:", err);
      resolve();
      return;
    }

    const pending: Promise<void>[] = [];
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      Promise.allSettled(pending).then(() => resolve());
    };

    const timer = setTimeout(close, Math.max(0, deadline - Date.now()));
    ws.onopen = () => {
      /* Jetstream starts streaming immediately — no REQ needed. */
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as JetstreamEvent;
        pending.push(onEvent(data).catch((err) => {
          console.warn("Jetstream event handler threw:", err);
        }));
      } catch {
        /* malformed — ignore */
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      close();
    };
    ws.onclose = () => {
      clearTimeout(timer);
      close();
    };
  });
}

function extractContractRef(record: Record<string, unknown> | undefined): {
  txId?: string;
  principal?: string;
  contractName?: string;
} {
  if (!record || typeof record.subject !== "object" || record.subject === null) return {};
  const s = record.subject as Record<string, unknown>;
  return {
    txId: typeof s.txId === "string" ? s.txId : undefined,
    principal: typeof s.principal === "string" ? s.principal : undefined,
    contractName: typeof s.contractName === "string" ? s.contractName : undefined,
  };
}

function extractReactionSubject(record: Record<string, unknown> | undefined): {
  uri?: string;
  cid?: string;
} {
  if (!record || typeof record.subject !== "object" || record.subject === null) return {};
  const s = record.subject as Record<string, unknown>;
  return {
    uri: typeof s.uri === "string" ? s.uri : undefined,
    cid: typeof s.cid === "string" ? s.cid : undefined,
  };
}

async function handleCommit(
  ctx: IngestContext,
  whitelist: Set<string>,
  commitEvent: JetstreamCommitEvent,
  result: DrainResult,
): Promise<void> {
  const { did, commit, time_us } = commitEvent;
  result.eventsSeen += 1;
  if (time_us > result.latestTimeUs) result.latestTimeUs = time_us;
  if (!whitelist.has(did)) return;

  const uri = `at://${did}/${commit.collection}/${commit.rkey}`;

  try {
    if (commit.collection === COMMENT_COLLECTION) {
      if (commit.operation === "delete") {
        await applyDeletion(ctx, "atproto", did, [uri]);
        result.eventsIndexed += 1;
        return;
      }
      const { txId, principal, contractName } = extractContractRef(commit.record);
      const text = typeof commit.record?.text === "string" ? commit.record.text : "";
      if (!txId || text.length === 0 || text.length > 10000) return;

      const lineNumber = typeof commit.record?.lineNumber === "number"
        ? commit.record.lineNumber
        : undefined;
      const lineRange = (commit.record?.lineRange && typeof commit.record.lineRange === "object")
        ? commit.record.lineRange as { start?: number; end?: number }
        : undefined;
      const reply = (commit.record?.reply && typeof commit.record.reply === "object")
        ? commit.record.reply as { parent?: { uri?: string } }
        : undefined;
      const parentUri = reply?.parent?.uri ?? null;
      const createdAt = typeof commit.record?.createdAt === "string"
        ? commit.record.createdAt
        : undefined;

      const outcome = await upsertComment(ctx, {
        uri,
        cid: commit.cid ?? "",
        author_did: did,
        author_type: "atproto",
        tx_id: txId,
        principal,
        contractName,
        line_number: lineNumber ?? null,
        line_range_start: lineRange?.start ?? null,
        line_range_end: lineRange?.end ?? null,
        parent_uri: parentUri,
        text,
        created_at: createdAt ?? new Date(time_us / 1000).toISOString(),
      });
      if (outcome === "inserted") result.eventsIndexed += 1;
      return;
    }

    if (commit.collection === REACTION_COLLECTION) {
      if (commit.operation === "delete") {
        await applyDeletion(ctx, "atproto", did, [uri]);
        result.eventsIndexed += 1;
        return;
      }
      const { uri: subjectUri, cid: subjectCid } = extractReactionSubject(commit.record);
      const emoji = typeof commit.record?.emoji === "string" ? commit.record.emoji : "";
      if (!subjectUri || !emoji) return;

      const outcome = await upsertReaction(ctx, {
        uri,
        cid: commit.cid ?? "",
        author_did: did,
        author_type: "atproto",
        subject_uri: subjectUri,
        subject_cid: subjectCid ?? "",
        emoji,
        created_at: new Date(time_us / 1000).toISOString(),
      });
      if (outcome === "inserted") result.eventsIndexed += 1;
      return;
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const whitelist = await loadWhitelist();
    if (whitelist.size === 0) {
      return new Response(
        JSON.stringify({ status: "ok", note: "atproto whitelist is empty — nothing to ingest" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cursor = await readCursor(supabase, CURSOR_SOURCE, "0");
    const url = buildStreamUrl(cursor);

    const ctx: IngestContext = { supabase, requireWhitelist: true };
    const result: DrainResult = {
      eventsSeen: 0,
      eventsIndexed: 0,
      latestTimeUs: parseInt(cursor, 10) || 0,
      errors: [],
    };

    const deadline = Date.now() + DRAIN_BUDGET_MS;
    await drainJetstream(url, async (ev) => {
      if (ev.kind === "commit") await handleCommit(ctx, whitelist, ev, result);
    }, deadline);

    // Rewind 10 seconds (10_000_000 µs) to re-cover any late/out-of-order
    // commits Jetstream might replay on reconnect.
    const rewoundCursor = Math.max(0, result.latestTimeUs - 10_000_000);
    await writeCursor(supabase, CURSOR_SOURCE, String(rewoundCursor));

    return new Response(
      JSON.stringify({
        status: "ok",
        startCursor: cursor,
        nextCursor: String(rewoundCursor),
        authorsOnWhitelist: whitelist.size,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ingest-atproto failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
