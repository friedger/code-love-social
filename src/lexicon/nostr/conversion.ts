import type {
  Comment,
  ContractRef,
  EventTemplate,
  LineRange,
  NostrEvent,
  ReplyRef,
} from './types';
import { KIND_COMMENT, KIND_REACTION } from './types';
import {
  buildLineTags,
  buildParentTags,
  buildStacksRootTags,
  parseLineTags,
  parseReplyRef,
  readRootStacksTxId,
} from './tags';

/** Options for building a Comment domain object from a Nostr event. */
export interface FromEventOptions {
  /**
   * Optional enrichment for the contract reference. The event itself only
   * encodes the deploy tx id; principal and contractName are typically
   * resolved via a Stacks API and passed in here.
   */
  contract?: Pick<ContractRef, 'principal' | 'contractName' | 'sourceHash'>;
  reactions?: Record<string, number>;
  userReaction?: { emoji: string; id: string };
  replyCount?: number;
}

/**
 * Build an unsigned kind-1111 event template for a new comment.
 * The caller is responsible for setting `pubkey`, computing `id`, and signing.
 */
export function buildCommentEventTemplate(
  subject: ContractRef,
  text: string,
  options?: {
    lineNumber?: number;
    lineRange?: LineRange;
    reply?: ReplyRef;
    createdAt?: number;
  }
): EventTemplate {
  const tags: string[][] = [
    ...buildStacksRootTags(subject),
    ...buildParentTags(subject, options?.reply),
    ...buildLineTags({ lineNumber: options?.lineNumber, lineRange: options?.lineRange }),
  ];

  return {
    kind: KIND_COMMENT,
    created_at: options?.createdAt ?? Math.floor(Date.now() / 1000),
    tags,
    content: text,
  };
}

/**
 * Build an unsigned kind-7 (NIP-25) reaction event targeting a comment event.
 */
export function buildReactionEventTemplate(
  target: { id: string; pubkey: string },
  emoji: string,
  createdAt?: number
): EventTemplate {
  return {
    kind: KIND_REACTION,
    created_at: createdAt ?? Math.floor(Date.now() / 1000),
    tags: [
      ['e', target.id],
      ['p', target.pubkey],
      ['k', String(KIND_COMMENT)],
    ],
    content: emoji,
  };
}

/**
 * Project a signed kind-1111 event into the Comment domain model.
 * Returns undefined if the event is missing a Stacks root reference.
 */
export function fromCommentEvent(
  event: NostrEvent,
  options: FromEventOptions = {}
): Comment | undefined {
  if (event.kind !== KIND_COMMENT) return undefined;
  const txId = readRootStacksTxId(event.tags);
  if (!txId) return undefined;

  const subject: ContractRef = {
    principal: options.contract?.principal ?? '',
    contractName: options.contract?.contractName ?? '',
    txId,
    sourceHash: options.contract?.sourceHash,
  };

  const reply = parseReplyRef(event.tags);
  const { lineNumber, lineRange } = parseLineTags(event.tags);

  const comment: Comment = {
    id: event.id,
    pubkey: event.pubkey,
    subject,
    text: event.content,
    createdAt: event.created_at,
    reactions: options.reactions ?? {},
    userReaction: options.userReaction,
    replyCount: options.replyCount ?? 0,
  };
  if (lineNumber !== undefined) comment.lineNumber = lineNumber;
  if (lineRange) comment.lineRange = lineRange;
  if (reply) {
    comment.reply = reply;
    comment.parentId = reply.parent.id;
  }
  return comment;
}

/**
 * Project a Comment back into an unsigned event template.
 * Useful when editing a comment (a new event is published — NIP-22 events
 * are not addressable).
 */
export function toCommentEventTemplate(comment: Comment): EventTemplate {
  return buildCommentEventTemplate(comment.subject, comment.text, {
    lineNumber: comment.lineNumber,
    lineRange: comment.lineRange,
    reply: comment.reply,
    createdAt: comment.createdAt,
  });
}
