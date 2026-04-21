// Shared upsert path for the comments/reactions index.
//
// Everything that ends up in `comments_index` / `likes_index` — whether it
// came in via the UI's signed-event POST handler or via a background
// ingestor scraping the atproto firehose / Nostr relays — flows through
// here. Single insert shape, single whitelist check, single contract
// resolver.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveContractByTxId } from "./contract-resolver.ts";

export type AuthorType = "atproto" | "nostr";

export interface CommentRow {
  uri: string;
  cid: string;
  author_did: string;
  author_type: AuthorType;
  tx_id: string;
  text: string;
  line_number?: number | null;
  line_range_start?: number | null;
  line_range_end?: number | null;
  parent_uri?: string | null;
  created_at?: string | null;
  /** Optional override. If unset, principal+contractName are resolved from tx_id. */
  principal?: string;
  contractName?: string;
}

export interface ReactionRow {
  uri: string;
  cid: string;
  author_did: string;
  author_type: AuthorType;
  subject_uri: string;
  subject_cid?: string | null;
  emoji: string;
  created_at?: string | null;
}

export interface IngestContext {
  supabase: SupabaseClient;
  /** If true, checks `ingest_whitelist` before inserting. Used by background
   *  ingestors; UI paths pass `false` because the signing user has implicitly
   *  authorised their own write. */
  requireWhitelist: boolean;
}

/**
 * Returns true if `(author_type, identifier)` is on the ingest whitelist.
 * Identifier is a DID for atproto or a hex pubkey for nostr.
 */
export async function isWhitelisted(
  supabase: SupabaseClient,
  authorType: AuthorType,
  identifier: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("ingest_whitelist")
    .select("id")
    .eq("author_type", authorType)
    .eq("identifier", identifier)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("Whitelist lookup error:", error);
    return false;
  }
  return !!data;
}

/** Upsert a comment row. Skips silently on whitelist failure or unknown contract. */
export async function upsertComment(
  ctx: IngestContext,
  row: CommentRow,
): Promise<"inserted" | "duplicate" | "skipped-whitelist" | "skipped-contract"> {
  if (ctx.requireWhitelist) {
    const allowed = await isWhitelisted(
      ctx.supabase,
      row.author_type,
      whitelistIdentifierFor(row.author_type, row.author_did),
    );
    if (!allowed) return "skipped-whitelist";
  }

  let principal = row.principal;
  let contractName = row.contractName;
  if (!principal || !contractName) {
    const resolved = await resolveContractByTxId(ctx.supabase, row.tx_id);
    if (!resolved) return "skipped-contract";
    principal = resolved.principal;
    contractName = resolved.contractName;
  }

  const { error } = await ctx.supabase.from("comments_index").insert({
    uri: row.uri,
    cid: row.cid,
    author_did: row.author_did,
    author_type: row.author_type,
    principal,
    contract_name: contractName,
    tx_id: row.tx_id,
    line_number: row.line_number ?? null,
    line_range_start: row.line_range_start ?? null,
    line_range_end: row.line_range_end ?? null,
    parent_uri: row.parent_uri ?? null,
    text: row.text,
    created_at: row.created_at ?? new Date().toISOString(),
  });
  if (!error) return "inserted";
  if (String(error.message).toLowerCase().includes("duplicate")) return "duplicate";
  console.error("Comment upsert error:", error);
  throw new Error("Failed to upsert comment");
}

/** Upsert a reaction row. Replaces any prior reaction by the same author on the same subject. */
export async function upsertReaction(
  ctx: IngestContext,
  row: ReactionRow,
): Promise<"inserted" | "duplicate" | "skipped-whitelist"> {
  if (ctx.requireWhitelist) {
    const allowed = await isWhitelisted(
      ctx.supabase,
      row.author_type,
      whitelistIdentifierFor(row.author_type, row.author_did),
    );
    if (!allowed) return "skipped-whitelist";
  }

  await ctx.supabase
    .from("likes_index")
    .delete()
    .eq("author_did", row.author_did)
    .eq("subject_uri", row.subject_uri);

  const { error } = await ctx.supabase.from("likes_index").insert({
    uri: row.uri,
    cid: row.cid,
    author_did: row.author_did,
    author_type: row.author_type,
    subject_uri: row.subject_uri,
    subject_cid: row.subject_cid ?? "",
    emoji: row.emoji,
  });
  if (!error) return "inserted";
  if (String(error.message).toLowerCase().includes("duplicate")) return "duplicate";
  console.error("Reaction upsert error:", error);
  throw new Error("Failed to upsert reaction");
}

/** Apply a deletion: remove rows identified by `eventIds` authored by `authorDid`. */
export async function applyDeletion(
  ctx: IngestContext,
  authorType: AuthorType,
  authorDid: string,
  eventIds: string[],
): Promise<{ deleted: number }> {
  if (eventIds.length === 0) return { deleted: 0 };
  const [{ error: cErr }, { error: lErr }] = await Promise.all([
    ctx.supabase
      .from("comments_index")
      .delete()
      .eq("author_did", authorDid)
      .eq("author_type", authorType)
      .in("uri", eventIds),
    ctx.supabase
      .from("likes_index")
      .delete()
      .eq("author_did", authorDid)
      .eq("author_type", authorType)
      .in("uri", eventIds),
  ]);
  if (cErr) console.error("Delete comments error:", cErr);
  if (lErr) console.error("Delete reactions error:", lErr);
  return { deleted: eventIds.length };
}

/** Resume cursor helpers for ingestors. */
export async function readCursor(
  supabase: SupabaseClient,
  source: string,
  defaultValue: string,
): Promise<string> {
  const { data } = await supabase
    .from("ingest_state")
    .select("cursor")
    .eq("source", source)
    .maybeSingle();
  return data?.cursor ?? defaultValue;
}

export async function writeCursor(
  supabase: SupabaseClient,
  source: string,
  cursor: string,
): Promise<void> {
  await supabase
    .from("ingest_state")
    .upsert({ source, cursor, updated_at: new Date().toISOString() }, { onConflict: "source" });
}

/**
 * Whitelist stores raw identifiers: the atproto DID or the hex Nostr pubkey.
 * For Nostr, the comments_index `author_did` is `did:pubkey:<hex>` — strip
 * the wrapper so the whitelist can be maintained in the protocol's native
 * form.
 */
function whitelistIdentifierFor(authorType: AuthorType, authorDid: string): string {
  if (authorType === "nostr" && authorDid.startsWith("did:pubkey:")) {
    return authorDid.slice("did:pubkey:".length);
  }
  return authorDid;
}
