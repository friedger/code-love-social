// AT Protocol record types for com.source-of-clarity.temp namespace

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
 * com.source-of-clarity.temp.comment record
 * A comment on a Clarity smart contract
 */
export interface CommentRecord {
  $type: 'com.source-of-clarity.temp.comment';
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
 * com.source-of-clarity.temp.like record
 * A like on a comment
 */
export interface LikeRecord {
  $type: 'com.source-of-clarity.temp.like';
  /** Reference to the liked comment */
  subject: StrongRef;
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

/**
 * Full Comment with metadata (extends CommentRecord with local/federation data)
 * This is the unified type used throughout the application
 */
export interface Comment extends Omit<CommentRecord, '$type'> {
  /** AT Protocol record URI */
  uri: string;
  /** AT Protocol Content ID */
  cid: string;
  /** DID of the comment author */
  authorDid: string;
  /** Local like count (aggregated) */
  likes: number;
  /** DIDs who liked this comment */
  likedBy: string[];
  /** Count of replies */
  replyCount: number;
  /** Local parent ID for tree traversal (derived from reply.parent.uri) */
  parentId?: string;
}

/**
 * AT Protocol user profile (app.bsky.actor.profile compatible)
 */
export interface UserProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

/**
 * App-specific user data extensions
 */
export interface LocalUserData {
  reputation: number;
  badges: Badge[];
  followersCount: number;
  followingCount: number;
  commentsCount: number;
}

/**
 * Badge definition
 */
export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/**
 * Relationship between two users
 */
export interface Relationship {
  following: boolean;
  followedBy: boolean;
  muted: boolean;
  blocked: boolean;
}

/**
 * Combined user type for app display
 */
export interface AppUser extends UserProfile, LocalUserData {}

// Collection NSIDs
export const LEXICON_COMMENT = 'com.source-of-clarity.temp.comment' as const;
export const LEXICON_LIKE = 'com.source-of-clarity.temp.like' as const;
