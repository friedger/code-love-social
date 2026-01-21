// AT Protocol record types for com.source-of-clarity namespace

/** Reference to a Stacks smart contract */
export interface ContractRef {
  /** Stacks address that deployed the contract */
  principal: string;
  /** Name of the contract */
  contractName: string;
}

/** Range of lines in source code */
export interface LineRange {
  /** Starting line (inclusive, 1-based) */
  start: number;
  /** Ending line (inclusive, 1-based) */
  end: number;
}

/** AT Protocol strong reference to another record */
export interface StrongRef {
  /** AT URI (at://did/collection/rkey) */
  uri: string;
  /** Content ID hash */
  cid: string;
}

/** Reply reference for threaded comments */
export interface ReplyRef {
  /** Root comment of the thread */
  root: StrongRef;
  /** Immediate parent comment */
  parent: StrongRef;
}

/**
 * com.source-of-clarity.comment record
 * A comment on a Clarity smart contract
 */
export interface CommentRecord {
  $type: 'com.source-of-clarity.comment';
  /** The contract being commented on */
  subject: ContractRef;
  /** Specific line number (omit for contract-level comments) */
  lineNumber?: number;
  /** Range of lines for multi-line comments */
  lineRange?: LineRange;
  /** Comment content */
  text: string;
  /** Reply threading reference */
  reply?: ReplyRef;
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

/**
 * com.source-of-clarity.like record
 * A like on a comment
 */
export interface LikeRecord {
  $type: 'com.source-of-clarity.like';
  /** Reference to the liked comment */
  subject: StrongRef;
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

// Collection NSIDs
export const LEXICON_COMMENT = 'com.source-of-clarity.comment' as const;
export const LEXICON_LIKE = 'com.source-of-clarity.like' as const;
