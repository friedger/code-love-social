import type { CommentRecord, ContractRef, StrongRef, LikeRecord, Comment } from './types';
import { LEXICON_COMMENT, LEXICON_LIKE } from './types';

/**
 * Options for converting a CommentRecord to a Comment
 */
export interface FromRecordOptions {
  /** The DID of the comment author */
  authorDid: string;
  /** The AT URI of the record */
  uri: string;
  /** The CID of the record */
  cid: string;
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
 * Convert a Comment to a CommentRecord for AT Protocol storage
 */
export function toCommentRecord(comment: Comment): CommentRecord {
  const record: CommentRecord = {
    $type: LEXICON_COMMENT,
    subject: comment.subject,
    text: comment.text,
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
 * Convert a CommentRecord from AT Protocol to a Comment for local use
 */
export function fromCommentRecord(
  record: CommentRecord,
  options: FromRecordOptions
): Comment {
  const comment: Comment = {
    uri: options.uri,
    cid: options.cid,
    subject: record.subject,
    authorDid: options.authorDid,
    text: record.text,
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

/**
 * Generate an AT Protocol TID (timestamp ID) for record keys
 * Base32 sortable timestamp in microseconds
 */
export function generateTID(): string {
  const now = Date.now() * 1000; // Convert to microseconds
  // Use base32 encoding (0-9, a-v) for AT Protocol TIDs
  const chars = '234567abcdefghijklmnopqrstuvwxyz';
  let tid = '';
  let n = now;
  
  for (let i = 0; i < 13; i++) {
    tid = chars[n & 31] + tid;
    n = Math.floor(n / 32);
  }
  
  return tid;
}

/**
 * Extract parent ID from a reply reference URI
 */
export function extractParentIdFromUri(uri: string): string | undefined {
  // AT URI format: at://did:plc:xxx/collection/rkey
  const match = uri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (match) {
    return match[3]; // Return the rkey as parent ID
  }
  return undefined;
}
