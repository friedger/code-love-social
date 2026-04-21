// Nostr event types for Clarity Social.
//
// Comments are NIP-22 comments (kind 1111) scoped to a Stacks contract
// deploy transaction via a NIP-73 external identifier (`stacks:tx:<txid>`).
// Reactions are NIP-25 kind-7 events referencing the comment event.

/** A signed Nostr event. */
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** An event that has not been signed yet (no id, no sig). */
export type UnsignedNostrEvent = Omit<NostrEvent, 'id' | 'sig'>;

/** Template used before computing id + signing (pubkey filled by signer). */
export type EventTemplate = Omit<UnsignedNostrEvent, 'pubkey'>;

// Kinds
export const KIND_METADATA = 0;
export const KIND_CONTACTS = 3;
export const KIND_REACTION = 7;
export const KIND_COMMENT = 1111;

// NIP-22 tag names (uppercase = root scope, lowercase = immediate parent)
export const TAG_E_UPPER = 'E';
export const TAG_E_LOWER = 'e';
export const TAG_I_UPPER = 'I';
export const TAG_I_LOWER = 'i';
export const TAG_K_UPPER = 'K';
export const TAG_K_LOWER = 'k';
export const TAG_P_UPPER = 'P';
export const TAG_P_LOWER = 'p';

// Line-targeting extensions (app-specific, forward-compatible with NIP-22)
export const TAG_LINE = 'line';
export const TAG_LINES = 'lines';

/**
 * NIP-73 external identifier scheme for a Stacks contract deploy tx.
 * Full identifier is `stacks:tx:<txid>`.
 */
export const EXTERNAL_ID_STACKS_TX = 'stacks:tx';

/** Build the NIP-73 external identifier for a Stacks deploy tx. */
export function stacksTxExternalId(txId: string): string {
  return `${EXTERNAL_ID_STACKS_TX}:${txId}`;
}

/** Reference to a Stacks smart contract, keyed by its deploy transaction. */
export interface ContractRef {
  principal: string;
  contractName: string;
  /** Deploy transaction id — the canonical identity of the contract. */
  txId: string;
  /** SHA-256 hash of source (optional, for identicon). */
  sourceHash?: string;
}

export interface LineRange {
  start: number;
  end: number;
}

/** Reference to another Nostr event (replies, reactions). */
export interface EventRef {
  id: string;
  pubkey?: string;
  relay?: string;
}

/** NIP-22 thread references. */
export interface ReplyRef {
  root: EventRef;
  parent: EventRef;
}

export const KNOWN_REACTIONS = ['👍', '❤️', '🔥', '👀', '🚀', '⚠️'] as const;
export type KnownReaction = typeof KNOWN_REACTIONS[number];

/**
 * Domain-model comment. Persisted as a NIP-22 kind-1111 Nostr event
 * whose root scope is the Stacks deploy tx (NIP-73 `stacks:tx:<txid>`).
 */
export interface Comment {
  /** Event id (hex). */
  id: string;
  /** Author pubkey (hex). Display as npub via nip19. */
  pubkey: string;
  /** The contract being commented on. */
  subject: ContractRef;
  /** Specific line (omit for contract-level). */
  lineNumber?: number;
  /** Line range (mutually exclusive with lineNumber). */
  lineRange?: LineRange;
  /** Comment text. */
  text: string;
  /** Reply references, if this is a reply to another comment. */
  reply?: ReplyRef;
  /** Unix seconds. */
  createdAt: number;
  /** Aggregated reaction counts by emoji. */
  reactions: Record<string, number>;
  /** Current user's reaction, if any. */
  userReaction?: { emoji: string; id: string };
  /** Reply count. */
  replyCount: number;
  /** Parent event id for tree traversal (derived from reply.parent.id). */
  parentId?: string;
}

/** User profile (NIP-01 kind 0 metadata). */
export interface UserProfile {
  pubkey: string;
  /** NIP-05 identifier (e.g. alice@example.com). */
  nip05?: string;
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
}

export interface LocalUserData {
  reputation: number;
  badges: Badge[];
  followersCount: number;
  followingCount: number;
  commentsCount: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Relationship {
  following: boolean;
  followedBy: boolean;
  muted: boolean;
  blocked: boolean;
}

export interface AppUser extends UserProfile, LocalUserData {}
