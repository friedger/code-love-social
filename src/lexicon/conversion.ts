import type { CommentRecord, ContractRef, StrongRef, LikeRecord } from './types';
import { LEXICON_COMMENT, LEXICON_LIKE } from './types';

/**
 * Legacy Comment interface used in the app
 * This matches the structure in src/data/dummyComments.ts
 */
export interface LegacyComment {
  id: string;
  uri: string;
  cid: string;
  contractId: string;
  contract?: ContractRef;
  lineNumber?: number;
  lineRange?: { start: number; end: number };
  authorDid: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  likes: number;
  likedBy: string[];
  parentId?: string;
  reply?: {
    root: StrongRef;
    parent: StrongRef;
  };
  replyCount: number;
}

/**
 * Options for converting a CommentRecord to a LegacyComment
 */
export interface FromRecordOptions {
  /** The local ID for the comment */
  id: string;
  /** The DID of the comment author */
  authorDid: string;
  /** The AT URI of the record */
  uri: string;
  /** The CID of the record */
  cid: string;
  /** Local contract ID mapping */
  contractId: string;
  /** Initial like count */
  likes?: number;
  /** Initial likedBy array */
  likedBy?: string[];
  /** Reply count */
  replyCount?: number;
  /** Parent ID for threading (if reply) */
  parentId?: string;
}

/**
 * Convert a LegacyComment to a CommentRecord for AT Protocol storage
 */
export function toCommentRecord(comment: LegacyComment): CommentRecord {
  // Use existing contract ref or derive from contractId
  const subject: ContractRef = comment.contract ?? {
    principal: 'SP000000000000000000000000000000',
    contractName: comment.contractId,
  };

  const record: CommentRecord = {
    $type: LEXICON_COMMENT,
    subject,
    text: comment.content,
    createdAt: comment.createdAt,
  };

  // Add optional line targeting
  if (comment.lineNumber !== undefined) {
    record.lineNumber = comment.lineNumber;
  }

  if (comment.lineRange !== undefined) {
    record.lineRange = comment.lineRange;
  }

  // Add reply reference if present
  if (comment.reply) {
    record.reply = comment.reply;
  }

  return record;
}

/**
 * Convert a CommentRecord from AT Protocol to a LegacyComment for local use
 */
export function fromCommentRecord(
  record: CommentRecord,
  options: FromRecordOptions
): LegacyComment {
  const comment: LegacyComment = {
    id: options.id,
    uri: options.uri,
    cid: options.cid,
    contractId: options.contractId,
    contract: record.subject,
    authorDid: options.authorDid,
    content: record.text,
    createdAt: record.createdAt,
    likes: options.likes ?? 0,
    likedBy: options.likedBy ?? [],
    replyCount: options.replyCount ?? 0,
  };

  // Add optional line targeting
  if (record.lineNumber !== undefined) {
    comment.lineNumber = record.lineNumber;
  }

  if (record.lineRange !== undefined) {
    comment.lineRange = record.lineRange;
  }

  // Add reply reference if present
  if (record.reply) {
    comment.reply = record.reply;
    comment.parentId = options.parentId;
  }

  return comment;
}

/**
 * Create a new CommentRecord with the current timestamp
 */
export function createCommentRecord(
  subject: ContractRef,
  text: string,
  options?: {
    lineNumber?: number;
    lineRange?: { start: number; end: number };
    reply?: { root: StrongRef; parent: StrongRef };
  }
): CommentRecord {
  const record: CommentRecord = {
    $type: LEXICON_COMMENT,
    subject,
    text,
    createdAt: new Date().toISOString(),
  };

  if (options?.lineNumber !== undefined) {
    record.lineNumber = options.lineNumber;
  }

  if (options?.lineRange !== undefined) {
    record.lineRange = options.lineRange;
  }

  if (options?.reply) {
    record.reply = options.reply;
  }

  return record;
}

/**
 * Create a new LikeRecord with the current timestamp
 */
export function createLikeRecord(subject: StrongRef): LikeRecord {
  return {
    $type: LEXICON_LIKE,
    subject,
    createdAt: new Date().toISOString(),
  };
}
