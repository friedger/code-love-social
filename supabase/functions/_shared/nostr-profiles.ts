// Nostr profile (kind-0) cache + relay fetcher.
//
// `loadCachedProfiles` reads what we already have. `fetchAndCacheProfiles`
// drains kind-0 events for a set of pubkeys from the default relay list
// and upserts the latest version into `nostr_profiles`. Used in two places:
//   1. /comments GET — reads the cache synchronously and triggers a
//      background fetch for any missing/stale pubkey via waitUntil.
//   2. (future) the Nostr ingestor could also call into this if we want
//      profiles refreshed on the same schedule as comments.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DID_PUBKEY_SCHEME, didToPubkey, pubkeyToDid } from "./nostr.ts";

export interface NostrProfileRow {
  pubkey: string;
  name: string | null;
  display_name: string | null;
  picture: string | null;
  nip05: string | null;
  about: string | null;
  event_created_at: number;
  fetched_at: string;
}

export interface ResolvedProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
];

const FETCH_BUDGET_MS = 8_000;
/** A row older than this is refreshed in the background. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isNostrDid(did: string): boolean {
  return did.startsWith(DID_PUBKEY_SCHEME);
}

export function rowToProfile(row: NostrProfileRow): ResolvedProfile {
  const did = pubkeyToDid(row.pubkey);
  const displayName = row.display_name || row.name || undefined;
  const handle = row.nip05 || row.name || row.pubkey.slice(0, 12);
  return {
    did,
    handle,
    displayName,
    avatar: row.picture || undefined,
  };
}

/** Read cached rows for the given DIDs (only `did:pubkey:*` ones are looked up). */
export async function loadCachedProfiles(
  supabase: SupabaseClient,
  authorDids: string[],
): Promise<{ profiles: Record<string, ResolvedProfile>; missing: string[]; stale: string[] }> {
  const profiles: Record<string, ResolvedProfile> = {};
  const pubkeys: string[] = [];
  const didByPubkey = new Map<string, string>();

  for (const did of authorDids) {
    const pk = didToPubkey(did);
    if (!pk) continue;
    pubkeys.push(pk);
    didByPubkey.set(pk, did);
  }

  if (pubkeys.length === 0) {
    return { profiles, missing: [], stale: [] };
  }

  const { data, error } = await supabase
    .from("nostr_profiles")
    .select("*")
    .in("pubkey", pubkeys);

  if (error) {
    console.warn("nostr_profiles read failed:", error);
    return { profiles, missing: pubkeys, stale: [] };
  }

  const found = new Set<string>();
  const stale: string[] = [];
  const now = Date.now();

  for (const row of (data || []) as NostrProfileRow[]) {
    found.add(row.pubkey);
    profiles[pubkeyToDid(row.pubkey)] = rowToProfile(row);
    if (now - new Date(row.fetched_at).getTime() > STALE_AFTER_MS) {
      stale.push(row.pubkey);
    }
  }

  const missing = pubkeys.filter((pk) => !found.has(pk));
  return { profiles, missing, stale };
}

interface Kind0Content {
  name?: unknown;
  display_name?: unknown;
  displayName?: unknown;
  picture?: unknown;
  nip05?: unknown;
  about?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v.slice(0, 500) : null;
}

function parseKind0(content: string): Kind0Content | null {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null ? parsed as Kind0Content : null;
  } catch {
    return null;
  }
}

interface RawEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
}

/** Drain kind-0 events for `pubkeys` from one relay; resolves on EOSE or budget. */
function drainProfiles(
  url: string,
  pubkeys: string[],
  onEvent: (ev: RawEvent) => void,
  deadline: number,
): Promise<void> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve();
      return;
    }
    const subId = `prof-${Math.random().toString(36).slice(2, 10)}`;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve();
    };
    const timer = setTimeout(close, Math.max(0, deadline - Date.now()));

    ws.onopen = () => {
      ws.send(JSON.stringify(["REQ", subId, { kinds: [0], authors: pubkeys }]));
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (!Array.isArray(data)) return;
        if (data[0] === "EVENT" && data[1] === subId) {
          onEvent(data[2] as RawEvent);
        } else if (data[0] === "EOSE" && data[1] === subId) {
          clearTimeout(timer);
          close();
        }
      } catch {
        /* ignore malformed */
      }
    };
    ws.onerror = () => { clearTimeout(timer); close(); };
    ws.onclose = () => { clearTimeout(timer); close(); };
  });
}

/**
 * Fetch kind-0 metadata for `pubkeys` from the default relay set and upsert
 * the newest seen version per pubkey. Designed to run in the background via
 * `EdgeRuntime.waitUntil` — does not throw, swallows relay errors.
 */
export async function fetchAndCacheProfiles(
  supabase: SupabaseClient,
  pubkeys: string[],
): Promise<void> {
  if (pubkeys.length === 0) return;

  const newest = new Map<string, RawEvent>();
  const onEvent = (ev: RawEvent) => {
    if (ev.kind !== 0) return;
    if (!/^[0-9a-f]{64}$/.test(ev.pubkey)) return;
    const prev = newest.get(ev.pubkey);
    if (!prev || ev.created_at > prev.created_at) {
      newest.set(ev.pubkey, ev);
    }
  };

  const deadline = Date.now() + FETCH_BUDGET_MS;
  await Promise.all(
    DEFAULT_RELAYS.map((url) => drainProfiles(url, pubkeys, onEvent, deadline)),
  );

  if (newest.size === 0) return;

  const rows = Array.from(newest.values()).map((ev) => {
    const meta = parseKind0(ev.content) ?? {};
    return {
      pubkey: ev.pubkey,
      name: asString(meta.name),
      display_name: asString(meta.display_name ?? meta.displayName),
      picture: asString(meta.picture),
      nip05: asString(meta.nip05),
      about: asString(meta.about),
      event_created_at: ev.created_at,
      fetched_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("nostr_profiles")
    .upsert(rows, { onConflict: "pubkey" });
  if (error) {
    console.warn("nostr_profiles upsert failed:", error);
  }
}
