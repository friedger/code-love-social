import type { ContractRef, LineRange, ReplyRef } from './types';
import {
  KIND_COMMENT,
  TAG_E_LOWER,
  TAG_E_UPPER,
  TAG_I_LOWER,
  TAG_I_UPPER,
  TAG_K_LOWER,
  TAG_K_UPPER,
  TAG_LINE,
  TAG_LINES,
  TAG_P_LOWER,
  TAG_P_UPPER,
  EXTERNAL_ID_STACKS_TX,
  stacksTxExternalId,
} from './types';

/** Return the first value of the first tag with the given name. */
export function findTagValue(tags: string[][], name: string): string | undefined {
  const tag = tags.find((t) => t[0] === name);
  return tag?.[1];
}

/** Return all values of tags with the given name. */
export function findTagValues(tags: string[][], name: string): string[] {
  return tags.filter((t) => t[0] === name).map((t) => t[1]).filter(Boolean);
}

/** Return the full first tag (including extra positions) with the given name. */
export function findTag(tags: string[][], name: string): string[] | undefined {
  return tags.find((t) => t[0] === name);
}

/**
 * Build the NIP-22 root-scope tags for a comment targeting a Stacks deploy tx.
 * Always emitted regardless of whether the comment is top-level or a reply.
 */
export function buildStacksRootTags(ref: ContractRef): string[][] {
  const externalId = stacksTxExternalId(ref.txId);
  return [
    [TAG_I_UPPER, externalId],
    [TAG_K_UPPER, EXTERNAL_ID_STACKS_TX],
  ];
}

/**
 * Build the NIP-22 immediate-parent tags.
 * For a top-level comment, the parent is the same external scope as the root.
 * For a reply, the parent is another kind-1111 event.
 */
export function buildParentTags(ref: ContractRef, reply?: ReplyRef): string[][] {
  if (!reply) {
    // Top-level: parent scope mirrors root scope.
    return [
      [TAG_I_LOWER, stacksTxExternalId(ref.txId)],
      [TAG_K_LOWER, EXTERNAL_ID_STACKS_TX],
    ];
  }
  const tags: string[][] = [];
  const parentETag = [TAG_E_LOWER, reply.parent.id];
  if (reply.parent.relay || reply.parent.pubkey) {
    parentETag.push(reply.parent.relay ?? '');
    if (reply.parent.pubkey) parentETag.push(reply.parent.pubkey);
  }
  tags.push(parentETag);
  tags.push([TAG_K_LOWER, String(KIND_COMMENT)]);
  if (reply.parent.pubkey) {
    tags.push([TAG_P_LOWER, reply.parent.pubkey]);
  }
  // Also reference the root comment event if different from parent.
  if (reply.root.id !== reply.parent.id) {
    const rootETag = [TAG_E_UPPER, reply.root.id];
    if (reply.root.relay || reply.root.pubkey) {
      rootETag.push(reply.root.relay ?? '');
      if (reply.root.pubkey) rootETag.push(reply.root.pubkey);
    }
    tags.push(rootETag);
    if (reply.root.pubkey) {
      tags.push([TAG_P_UPPER, reply.root.pubkey]);
    }
  }
  return tags;
}

/** Build the line-targeting tag(s) for a comment. */
export function buildLineTags(opts: {
  lineNumber?: number;
  lineRange?: LineRange;
}): string[][] {
  if (opts.lineNumber !== undefined) {
    return [[TAG_LINE, String(opts.lineNumber)]];
  }
  if (opts.lineRange) {
    return [[TAG_LINES, String(opts.lineRange.start), String(opts.lineRange.end)]];
  }
  return [];
}

/**
 * Parse line-targeting tags back to the structured form.
 * Returns `{}` if no line tags are present.
 */
export function parseLineTags(tags: string[][]): {
  lineNumber?: number;
  lineRange?: LineRange;
} {
  const line = findTagValue(tags, TAG_LINE);
  if (line) {
    const n = Number(line);
    if (Number.isInteger(n) && n >= 1) return { lineNumber: n };
  }
  const lines = findTag(tags, TAG_LINES);
  if (lines && lines.length >= 3) {
    const start = Number(lines[1]);
    const end = Number(lines[2]);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
      return { lineRange: { start, end } };
    }
  }
  return {};
}

/** Extract the Stacks tx id from a NIP-73 external identifier, or undefined. */
export function parseStacksTxExternalId(externalId: string): string | undefined {
  const prefix = `${EXTERNAL_ID_STACKS_TX}:`;
  if (!externalId.startsWith(prefix)) return undefined;
  const txId = externalId.slice(prefix.length);
  return txId.length > 0 ? txId : undefined;
}

/**
 * Read the root Stacks tx id from a kind-1111 event's tags.
 * Returns undefined if no `I` tag with the stacks:tx scheme is present.
 */
export function readRootStacksTxId(tags: string[][]): string | undefined {
  const value = findTagValue(tags, TAG_I_UPPER);
  if (!value) return undefined;
  return parseStacksTxExternalId(value);
}

/**
 * Extract the reply reference from a kind-1111 event's tags, if present.
 * A top-level comment has no `e` tag — only `i`/`I`.
 */
export function parseReplyRef(tags: string[][]): ReplyRef | undefined {
  const parentE = findTag(tags, TAG_E_LOWER);
  if (!parentE) return undefined;
  const parent = { id: parentE[1], relay: parentE[2] || undefined, pubkey: parentE[3] || undefined };
  const rootE = findTag(tags, TAG_E_UPPER);
  const root = rootE
    ? { id: rootE[1], relay: rootE[2] || undefined, pubkey: rootE[3] || undefined }
    : parent;
  return { root, parent };
}
