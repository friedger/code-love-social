// Shared Nostr helpers for Supabase edge functions (Deno runtime).
// Events arrive already signed from the browser; the backend's job is to
// verify the signature and index the event in the database.

import { verifyEvent } from "npm:nostr-tools@^2.10.0/pure";

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export const KIND_REACTION = 7;
export const KIND_COMMENT = 1111;
export const KIND_DELETION = 5;

export const EXTERNAL_ID_STACKS_TX = "stacks:tx";
export const DID_PUBKEY_SCHEME = "did:pubkey:";

const HEX32 = /^[0-9a-f]{64}$/;
const HEX_SIG = /^[0-9a-f]{128}$/;

export function pubkeyToDid(pubkey: string): string {
  return `${DID_PUBKEY_SCHEME}${pubkey}`;
}

export function didToPubkey(did: string): string | undefined {
  if (!did.startsWith(DID_PUBKEY_SCHEME)) return undefined;
  const hex = did.slice(DID_PUBKEY_SCHEME.length);
  return HEX32.test(hex) ? hex : undefined;
}

/** Shallow shape check — does NOT verify the signature. */
export function isStructurallyValidEvent(event: unknown): event is NostrEvent {
  if (typeof event !== "object" || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e.id === "string" && HEX32.test(e.id) &&
    typeof e.pubkey === "string" && HEX32.test(e.pubkey) &&
    typeof e.created_at === "number" &&
    typeof e.kind === "number" &&
    Array.isArray(e.tags) &&
    (e.tags as unknown[]).every(
      (t) => Array.isArray(t) && t.every((v) => typeof v === "string"),
    ) &&
    typeof e.content === "string" &&
    typeof e.sig === "string" && HEX_SIG.test(e.sig)
  );
}

/** Verify signature and shape. Throws on failure. */
export function assertValidSignedEvent(event: unknown): NostrEvent {
  if (!isStructurallyValidEvent(event)) {
    throw new Error("Malformed Nostr event");
  }
  if (!verifyEvent(event)) {
    throw new Error("Invalid Nostr event signature");
  }
  return event;
}

export function findTagValue(tags: string[][], name: string): string | undefined {
  return tags.find((t) => t[0] === name)?.[1];
}

export function findTag(tags: string[][], name: string): string[] | undefined {
  return tags.find((t) => t[0] === name);
}

export function readStacksTxIdFromRoot(tags: string[][]): string | undefined {
  const value = findTagValue(tags, "I");
  if (!value) return undefined;
  const prefix = `${EXTERNAL_ID_STACKS_TX}:`;
  if (!value.startsWith(prefix)) return undefined;
  const txId = value.slice(prefix.length);
  return txId.length > 0 ? txId : undefined;
}
