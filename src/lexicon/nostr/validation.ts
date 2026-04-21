import type { ContractRef, LineRange, NostrEvent } from './types';
import { KIND_COMMENT, KIND_REACTION, KNOWN_REACTIONS } from './types';
import { findTag, findTagValue, readRootStacksTxId } from './tags';

const HEX32 = /^[0-9a-f]{64}$/;
const HEX_SIG = /^[0-9a-f]{128}$/;

export function isHex32(value: unknown): value is string {
  return typeof value === 'string' && HEX32.test(value);
}

export function isValidContractRef(ref: unknown): ref is ContractRef {
  if (typeof ref !== 'object' || ref === null) return false;
  const obj = ref as Record<string, unknown>;
  return (
    typeof obj.principal === 'string' &&
    obj.principal.length > 0 &&
    typeof obj.contractName === 'string' &&
    obj.contractName.length > 0 &&
    obj.contractName.length <= 128 &&
    typeof obj.txId === 'string' &&
    obj.txId.length > 0
  );
}

export function isValidLineRange(range: unknown): range is LineRange {
  if (typeof range !== 'object' || range === null) return false;
  const obj = range as Record<string, unknown>;
  return (
    typeof obj.start === 'number' &&
    Number.isInteger(obj.start) &&
    obj.start >= 1 &&
    typeof obj.end === 'number' &&
    Number.isInteger(obj.end) &&
    obj.end >= 1 &&
    obj.end >= obj.start
  );
}

/**
 * Shallow structural check for a signed Nostr event.
 * Does NOT verify the signature — use nostr-tools `verifyEvent` for that.
 */
export function isValidNostrEvent(event: unknown): event is NostrEvent {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    isHex32(e.id) &&
    isHex32(e.pubkey) &&
    typeof e.created_at === 'number' &&
    Number.isFinite(e.created_at) &&
    typeof e.kind === 'number' &&
    Array.isArray(e.tags) &&
    (e.tags as unknown[]).every(
      (t) => Array.isArray(t) && t.every((v) => typeof v === 'string')
    ) &&
    typeof e.content === 'string' &&
    typeof e.sig === 'string' &&
    HEX_SIG.test(e.sig)
  );
}

/** Validate the shape of a kind-1111 comment event for this app. */
export function isValidCommentEvent(event: unknown): event is NostrEvent {
  if (!isValidNostrEvent(event)) return false;
  if (event.kind !== KIND_COMMENT) return false;
  if (event.content.length === 0 || event.content.length > 10000) return false;
  if (!readRootStacksTxId(event.tags)) return false;
  return true;
}

/** Validate the shape of a kind-7 reaction event. */
export function isValidReactionEvent(event: unknown): event is NostrEvent {
  if (!isValidNostrEvent(event)) return false;
  if (event.kind !== KIND_REACTION) return false;
  if (event.content.length === 0 || event.content.length > 10) return false;
  const target = findTagValue(event.tags, 'e');
  if (!target || !HEX32.test(target)) return false;
  return true;
}

export function isKnownReaction(emoji: string): boolean {
  return (KNOWN_REACTIONS as readonly string[]).includes(emoji);
}

/** lineNumber and a `line`/`lines` tag are mutually exclusive. */
export function validateLineTargeting(tags: string[][]): {
  valid: boolean;
  error?: string;
} {
  const hasLine = !!findTagValue(tags, 'line');
  const hasLines = !!findTag(tags, 'lines');
  if (hasLine && hasLines) {
    return {
      valid: false,
      error: 'line and lines tags are mutually exclusive. Use one or the other, not both.',
    };
  }
  return { valid: true };
}

/** Describe whether a comment is contract-level, single-line, or a range. */
export function getCommentTargetType(tags: string[][]): 'contract' | 'line' | 'range' {
  if (findTag(tags, 'lines')) return 'range';
  if (findTagValue(tags, 'line')) return 'line';
  return 'contract';
}
