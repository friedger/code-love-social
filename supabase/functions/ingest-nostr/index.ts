// Nostr ingestor.
//
// Scheduled via pg_cron (see the accompanying migration). On each tick:
//   1. Load the list of whitelisted Nostr pubkeys.
//   2. Load the resume cursor (unix seconds).
//   3. Open WebSocket connections to the default relay set.
//   4. REQ events since the cursor, filtered to our kinds (1111 comments,
//      7 reactions, 5 deletions) AND the whitelisted authors AND
//      `#K=stacks:tx` so relays do most of the filtering.
//   5. For each incoming event: verify signature, route to shared
//      indexer (which re-checks the whitelist and resolves the contract).
//   6. Drain until EOSE from every relay (or a ~15s budget), then close.
//   7. Save the new cursor (latest event created_at, with a small lookback
//      to tolerate clock skew / out-of-order delivery).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyEvent } from "npm:nostr-tools@^2.10.0/pure";
import {
  findTag,
  findTagValue,
  KIND_COMMENT as NOSTR_KIND_COMMENT,
  KIND_DELETION as NOSTR_KIND_DELETION,
  KIND_REACTION as NOSTR_KIND_REACTION,
  pubkeyToDid,
  readStacksTxIdFromRoot,
  type NostrEvent,
} from "../_shared/nostr.ts";
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

const CURSOR_SOURCE = "nostr-relays";
const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
];
const DRAIN_BUDGET_MS = 15_000;
/** Rewind the cursor by this many seconds when saving, so that a later
 *  tick has a chance to pick up events that were in flight across relays. */
const CURSOR_REWIND_SEC = 60;

interface WhitelistedPubkey {
  identifier: string;
}

interface DrainResult {
  eventsSeen: number;
  eventsIndexed: number;
  latestCreatedAt: number;
  errors: string[];
}

async function loadWhitelist(): Promise<string[]> {
  const { data, error } = await supabase
    .from("ingest_whitelist")
    .select("identifier")
    .eq("author_type", "nostr");
  if (error) {
    console.error("Failed to load Nostr whitelist:", error);
    return [];
  }
  return (data as WhitelistedPubkey[]).map((r) => r.identifier);
}

/** Connect to one relay and drain matching events into `onEvent` until EOSE. */
function drainRelay(
  url: string,
  filter: Record<string, unknown>,
  onEvent: (ev: NostrEvent) => Promise<void>,
  deadline: number,
): Promise<void> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn(`${url}: connect failed`, err);
      resolve();
      return;
    }

    const subId = `ingest-${Math.random().toString(36).slice(2, 10)}`;
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
      // Await any in-flight per-event handlers before resolving, so the
      // caller can save a cursor that reflects work actually completed.
      Promise.allSettled(pending).then(() => resolve());
    };

    const timer = setTimeout(close, Math.max(0, deadline - Date.now()));

    ws.onopen = () => {
      ws.send(JSON.stringify(["REQ", subId, filter]));
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (!Array.isArray(data)) return;
        if (data[0] === "EVENT" && data[1] === subId) {
          pending.push(onEvent(data[2] as NostrEvent).catch((err) => {
            console.warn(`${url}: event handler threw`, err);
          }));
        } else if (data[0] === "EOSE" && data[1] === subId) {
          clearTimeout(timer);
          close();
        }
      } catch {
        /* malformed message — ignore */
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

async function handleEvent(
  ctx: IngestContext,
  event: NostrEvent,
  result: DrainResult,
): Promise<void> {
  result.eventsSeen += 1;
  if (!verifyEvent(event as unknown as Parameters<typeof verifyEvent>[0])) {
    result.errors.push(`bad signature: ${event.id}`);
    return;
  }
  if (event.created_at > result.latestCreatedAt) {
    result.latestCreatedAt = event.created_at;
  }

  try {
    if (event.kind === NOSTR_KIND_COMMENT) {
      const txId = readStacksTxIdFromRoot(event.tags);
      if (!txId) return;
      if (!event.content || event.content.length > 10000) return;
      const { lineNumber, lineRange } = parseLineTags(event.tags);
      const parentId = findTagValue(event.tags, "e") || null;
      const outcome = await upsertComment(ctx, {
        uri: event.id,
        cid: event.id,
        author_did: pubkeyToDid(event.pubkey),
        author_type: "nostr",
        tx_id: txId,
        line_number: lineNumber ?? null,
        line_range_start: lineRange?.start ?? null,
        line_range_end: lineRange?.end ?? null,
        parent_uri: parentId,
        text: event.content,
        created_at: new Date(event.created_at * 1000).toISOString(),
      });
      if (outcome === "inserted") result.eventsIndexed += 1;
      return;
    }

    if (event.kind === NOSTR_KIND_REACTION) {
      const emoji = event.content;
      if (!emoji || emoji.length > 10) return;
      const targetEventId = findTagValue(event.tags, "e");
      const externalTxId = readStacksTxIdFromRoot(event.tags);
      let subjectUri: string;
      if (targetEventId) {
        subjectUri = targetEventId;
      } else if (externalTxId) {
        subjectUri = `contract://${externalTxId}`;
      } else {
        return;
      }
      const outcome = await upsertReaction(ctx, {
        uri: event.id,
        cid: event.id,
        author_did: pubkeyToDid(event.pubkey),
        author_type: "nostr",
        subject_uri: subjectUri,
        subject_cid: "",
        emoji,
        created_at: new Date(event.created_at * 1000).toISOString(),
      });
      if (outcome === "inserted") result.eventsIndexed += 1;
      return;
    }

    if (event.kind === NOSTR_KIND_DELETION) {
      const targetIds = event.tags
        .filter((t) => t[0] === "e")
        .map((t) => t[1])
        .filter((id) => !!id && /^[0-9a-f]{64}$/.test(id));
      if (targetIds.length === 0) return;
      const { deleted } = await applyDeletion(
        ctx,
        "nostr",
        pubkeyToDid(event.pubkey),
        targetIds,
      );
      if (deleted > 0) result.eventsIndexed += 1;
      return;
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }
}

function parseLineTags(tags: string[][]): {
  lineNumber?: number;
  lineRange?: { start: number; end: number };
} {
  const line = findTagValue(tags, "line");
  if (line) {
    const n = Number(line);
    if (Number.isInteger(n) && n >= 1) return { lineNumber: n };
  }
  const lines = findTag(tags, "lines");
  if (lines && lines.length >= 3) {
    const start = Number(lines[1]);
    const end = Number(lines[2]);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
      return { lineRange: { start, end } };
    }
  }
  return {};
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
    const authors = await loadWhitelist();
    if (authors.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", note: "Nostr whitelist is empty — nothing to ingest" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cursorStr = await readCursor(supabase, CURSOR_SOURCE, "0");
    const since = parseInt(cursorStr, 10) || 0;

    const filter = {
      kinds: [NOSTR_KIND_COMMENT, NOSTR_KIND_REACTION, NOSTR_KIND_DELETION],
      authors,
      since,
    };

    const ctx: IngestContext = { supabase, requireWhitelist: true };
    const result: DrainResult = {
      eventsSeen: 0,
      eventsIndexed: 0,
      latestCreatedAt: since,
      errors: [],
    };

    const deadline = Date.now() + DRAIN_BUDGET_MS;
    await Promise.all(
      DEFAULT_RELAYS.map((url) =>
        drainRelay(url, filter, (ev) => handleEvent(ctx, ev, result), deadline)
      ),
    );

    const nextCursor = Math.max(
      since,
      result.latestCreatedAt - CURSOR_REWIND_SEC,
    );
    await writeCursor(supabase, CURSOR_SOURCE, String(nextCursor));

    return new Response(
      JSON.stringify({
        status: "ok",
        since,
        nextCursor,
        authorsOnWhitelist: authors.length,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ingest-nostr failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
