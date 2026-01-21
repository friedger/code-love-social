import type { ContractRef, LineRange, StrongRef, CommentRecord, LikeRecord, ReplyRef } from './types';
import { LEXICON_COMMENT, LEXICON_LIKE } from './types';

/**
 * Validates if an object is a valid ContractRef
 */
export function isValidContractRef(ref: unknown): ref is ContractRef {
  if (typeof ref !== 'object' || ref === null) return false;
  const obj = ref as Record<string, unknown>;
  return (
    typeof obj.principal === 'string' &&
    obj.principal.length > 0 &&
    typeof obj.contractName === 'string' &&
    obj.contractName.length > 0 &&
    obj.contractName.length <= 128
  );
}

/**
 * Validates if an object is a valid LineRange
 */
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
 * Validates if an object is a valid StrongRef
 */
export function isValidStrongRef(ref: unknown): ref is StrongRef {
  if (typeof ref !== 'object' || ref === null) return false;
  const obj = ref as Record<string, unknown>;
  return (
    typeof obj.uri === 'string' &&
    obj.uri.startsWith('at://') &&
    typeof obj.cid === 'string' &&
    obj.cid.length > 0
  );
}

/**
 * Validates if an object is a valid ReplyRef
 */
export function isValidReplyRef(ref: unknown): ref is ReplyRef {
  if (typeof ref !== 'object' || ref === null) return false;
  const obj = ref as Record<string, unknown>;
  return isValidStrongRef(obj.root) && isValidStrongRef(obj.parent);
}

/**
 * Validates if an object is a valid CommentRecord
 */
export function isValidCommentRecord(record: unknown): record is CommentRecord {
  if (typeof record !== 'object' || record === null) return false;
  const obj = record as Record<string, unknown>;
  
  // Check required fields
  if (obj.$type !== LEXICON_COMMENT) return false;
  if (!isValidContractRef(obj.subject)) return false;
  if (typeof obj.text !== 'string' || obj.text.length === 0 || obj.text.length > 10000) return false;
  if (typeof obj.createdAt !== 'string') return false;
  
  // Validate ISO 8601 timestamp
  const timestamp = Date.parse(obj.createdAt);
  if (isNaN(timestamp)) return false;
  
  // Check optional fields
  if (obj.lineNumber !== undefined) {
    if (typeof obj.lineNumber !== 'number' || !Number.isInteger(obj.lineNumber) || obj.lineNumber < 1) {
      return false;
    }
  }
  
  if (obj.lineRange !== undefined) {
    if (!isValidLineRange(obj.lineRange)) return false;
  }
  
  if (obj.reply !== undefined) {
    if (!isValidReplyRef(obj.reply)) return false;
  }
  
  return true;
}

/**
 * Validates if an object is a valid LikeRecord
 */
export function isValidLikeRecord(record: unknown): record is LikeRecord {
  if (typeof record !== 'object' || record === null) return false;
  const obj = record as Record<string, unknown>;
  
  if (obj.$type !== LEXICON_LIKE) return false;
  if (!isValidStrongRef(obj.subject)) return false;
  if (typeof obj.createdAt !== 'string') return false;
  
  // Validate ISO 8601 timestamp
  const timestamp = Date.parse(obj.createdAt);
  if (isNaN(timestamp)) return false;
  
  return true;
}

/**
 * Validates that line targeting is correct (lineNumber and lineRange are mutually exclusive)
 */
export function validateLineTargeting(record: CommentRecord): { valid: boolean; error?: string } {
  if (record.lineNumber !== undefined && record.lineRange !== undefined) {
    return {
      valid: false,
      error: 'lineNumber and lineRange are mutually exclusive. Use one or the other, not both.',
    };
  }
  return { valid: true };
}

/**
 * Determines the type of comment based on line targeting
 */
export function getCommentType(record: CommentRecord): 'contract' | 'line' | 'range' {
  if (record.lineRange !== undefined) return 'range';
  if (record.lineNumber !== undefined) return 'line';
  return 'contract';
}
