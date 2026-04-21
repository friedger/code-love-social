import { getSessionToken } from "./atproto-auth";
import { getNostrSession, getNostrRelay, signEvent as nostrSignEvent } from "./nostr-auth";
import type { ContractRef, LineRange, ReplyRef, Comment } from "@/lexicon/types";
import {
  buildCommentEventTemplate,
  buildReactionEventTemplate,
  EXTERNAL_ID_STACKS_TX,
  KIND_REACTION,
  stacksTxExternalId,
  TAG_I_UPPER,
  TAG_K_UPPER,
  type EventTemplate,
  type NostrEvent,
} from "@/lexicon/nostr";

const COMMENTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comments`;
const NOSTR_COMMENTS_URL = `${COMMENTS_URL}/nostr`;

export interface CreateCommentParams {
  subject: ContractRef;
  text: string;
  lineNumber?: number;
  lineRange?: LineRange;
  reply?: ReplyRef;
}

export interface CreateCommentResponse {
  uri: string;
  cid: string;
  rkey: string;
  subject: ContractRef;
  text: string;
  lineNumber?: number;
  lineRange?: LineRange;
  reply?: ReplyRef;
  createdAt: string;
}

export interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface CommentsResponse {
  comments: CommentIndexRow[];
  profiles: Record<string, ProfileData>;
  reactionsByComment?: Record<string, { 
    counts: Record<string, number>; 
    userReaction?: { emoji: string; uri: string } 
  }>;
}

export interface CommentsWithProfiles {
  comments: Comment[];
  profiles: Record<string, ProfileData>;
}

export type AuthorType = "atproto" | "nostr";

export interface CommentIndexRow {
  id: string;
  uri: string;
  cid: string;
  author_did: string;
  /** Which protocol this comment came from. Rows written before this column
   *  existed are backfilled as "atproto". */
  author_type: AuthorType;
  principal: string;
  contract_name: string;
  tx_id: string | null;
  line_number: number | null;
  line_range_start: number | null;
  line_range_end: number | null;
  parent_uri: string | null;
  text: string;
  created_at: string;
}

export interface LikeResponse {
  uri: string;
  cid: string;
  rkey: string;
}

export interface ReactionResponse {
  uri: string;
  cid: string;
  rkey: string;
}

export interface ContractReactionsResponse {
  reactions: Record<string, number>;
  userReaction?: { emoji: string; uri: string };
}

/**
 * Get authorization headers for authenticated requests
 */
function getAuthHeaders(): HeadersInit {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error("Not authenticated");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };
}

/* ================================================================== *
 *  Nostr write path
 *
 *  When a Nostr session is active, comments/reactions/deletions are
 *  signed in the browser (via `window.nostr` or a persisted signer) and
 *  POSTed to `/comments/nostr[/...]`. The backend verifies the event
 *  signature and writes the index row with `author_type='nostr'`.
 *  Atproto sessions keep their existing paths unchanged.
 * ================================================================== */

function isNostrSession(): boolean {
  return !!getNostrSession();
}

/** Convert an AT-style ReplyRef to the Nostr EventRef shape. */
function replyRefToNostr(reply: ReplyRef | undefined) {
  if (!reply) return undefined;
  return {
    root: { id: reply.root.uri },
    parent: { id: reply.parent.uri },
  };
}

/**
 * Fire-and-forget publish of a signed event to the configured relay.
 * We don't block the UI on this — the index write is the authoritative step.
 */
function publishToNostrRelay(event: NostrEvent): void {
  try {
    const ws = new WebSocket(getNostrRelay());
    ws.onopen = () => {
      ws.send(JSON.stringify(["EVENT", event]));
      setTimeout(() => ws.close(), 2000);
    };
    ws.onerror = () => ws.close();
  } catch (err) {
    console.warn("Nostr relay publish failed:", err);
  }
}

async function postSignedEvent(
  path: string,
  event: NostrEvent,
  extra: Record<string, unknown> = {},
  errorMessage = "Request failed",
) {
  const response = await fetch(`${NOSTR_COMMENTS_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...extra }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || errorMessage);
  }
  return response.json();
}

async function signTemplate(template: EventTemplate): Promise<NostrEvent> {
  const signed = await nostrSignEvent(template);
  return signed as unknown as NostrEvent;
}

async function createNostrComment(
  params: CreateCommentParams,
): Promise<CreateCommentResponse> {
  const template = buildCommentEventTemplate(params.subject, params.text, {
    lineNumber: params.lineNumber,
    lineRange: params.lineRange,
    reply: replyRefToNostr(params.reply),
  });
  const event = await signTemplate(template);
  const result = await postSignedEvent(
    "",
    event,
    {
      principal: params.subject.principal,
      contractName: params.subject.contractName,
    },
    "Failed to create comment",
  );
  publishToNostrRelay(event);
  return {
    uri: event.id,
    cid: event.id,
    rkey: event.id,
    subject: params.subject,
    text: params.text,
    lineNumber: params.lineNumber,
    lineRange: params.lineRange,
    reply: params.reply,
    createdAt: (result as { createdAt?: string }).createdAt
      ?? new Date(event.created_at * 1000).toISOString(),
  };
}

async function addNostrReaction(
  targetEventId: string,
  targetPubkey: string,
  emoji: string,
): Promise<ReactionResponse> {
  const template = buildReactionEventTemplate(
    { id: targetEventId, pubkey: targetPubkey },
    emoji,
  );
  const event = await signTemplate(template);
  await postSignedEvent("/reaction", event, {}, "Failed to add reaction");
  publishToNostrRelay(event);
  return { uri: event.id, cid: event.id, rkey: event.id };
}

async function addNostrContractReaction(
  txId: string,
  emoji: string,
): Promise<{ uri: string }> {
  // A contract-level reaction has no target event; it scopes to the same
  // NIP-73 Stacks deploy-tx root that comments use.
  const template: EventTemplate = {
    kind: KIND_REACTION,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      [TAG_I_UPPER, stacksTxExternalId(txId)],
      [TAG_K_UPPER, EXTERNAL_ID_STACKS_TX],
    ],
    content: emoji,
  };
  const event = await signTemplate(template);
  await postSignedEvent(
    "/contract-reaction",
    event,
    {},
    "Failed to add contract reaction",
  );
  publishToNostrRelay(event);
  return { uri: event.id };
}

async function publishNostrDeletion(
  eventId: string,
  errorMessage: string,
): Promise<void> {
  const template: EventTemplate = {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["e", eventId]],
    content: "",
  };
  const event = await signTemplate(template);
  await postSignedEvent("/delete", event, {}, errorMessage);
  publishToNostrRelay(event);
}

/**
 * Convert a CommentIndexRow to a Comment for UI consumption
 */
export function indexRowToComment(
  row: CommentIndexRow,
  reactions: Record<string, number> = {},
  userReaction?: { emoji: string; uri: string },
  replyCount = 0
): Comment {
  const comment: Comment = {
    uri: row.uri,
    cid: row.cid,
    subject: {
      principal: row.principal,
      contractName: row.contract_name,
      txId: row.tx_id || "", // Default to empty for legacy comments
    },
    authorDid: row.author_did,
    authorType: row.author_type ?? "atproto",
    text: row.text,
    createdAt: row.created_at,
    reactions,
    userReaction,
    replyCount,
  };

  if (row.line_number !== null) {
    comment.lineNumber = row.line_number;
  }

  if (row.line_range_start !== null && row.line_range_end !== null) {
    comment.lineRange = {
      start: row.line_range_start,
      end: row.line_range_end,
    };
  }

  if (row.parent_uri) {
    // Extract rkey from parent URI for local threading
    const match = row.parent_uri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
    if (match) {
      comment.parentId = match[3];
    }
  }

  return comment;
}

/**
 * Fetch comments for a contract
 */
export async function getComments(
  principal: string,
  contractName: string,
  options?: { lineNumber?: number; txId?: string }
): Promise<CommentsWithProfiles> {
  const params = new URLSearchParams({
    principal,
    contractName,
  });

  if (options?.lineNumber !== undefined) {
    params.set("lineNumber", options.lineNumber.toString());
  }

  if (options?.txId !== undefined) {
    params.set("txId", options.txId);
  }

  // Include auth header if available to get user's reactions
  const headers: HeadersInit = { "Content-Type": "application/json" };
  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const response = await fetch(`${COMMENTS_URL}?${params.toString()}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch comments");
  }

  const data: CommentsResponse = await response.json();
  const reactionsByComment = data.reactionsByComment || {};
  
  return {
    comments: data.comments.map((row) => {
      const reactions = reactionsByComment[row.uri]?.counts || {};
      const userReaction = reactionsByComment[row.uri]?.userReaction;
      return indexRowToComment(row, reactions, userReaction);
    }),
    profiles: data.profiles || {},
  };
}

/**
 * Fetch comments by author DID
 */
export async function getCommentsByAuthor(authorDid: string): Promise<CommentsWithProfiles> {
  const params = new URLSearchParams({ authorDid });

  const response = await fetch(`${COMMENTS_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch comments");
  }

  const data: CommentsResponse = await response.json();
  return {
    comments: data.comments.map((row) => indexRowToComment(row)),
    profiles: data.profiles || {},
  };
}

/**
 * Fetch recent comments stream
 */
export async function getCommentsStream(limit = 50): Promise<CommentsWithProfiles> {
  const params = new URLSearchParams({ stream: "true", limit: limit.toString() });

  const response = await fetch(`${COMMENTS_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch comments");
  }

  const data: CommentsResponse = await response.json();
  return {
    comments: data.comments.map((row) => indexRowToComment(row)),
    profiles: data.profiles || {},
  };
}

/**
 * Search comments by text content
 */
export async function searchComments(query: string, limit = 50): Promise<CommentsWithProfiles> {
  const params = new URLSearchParams({ search: query, limit: limit.toString() });

  const response = await fetch(`${COMMENTS_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to search comments");
  }

  const data: CommentsResponse = await response.json();
  return {
    comments: data.comments.map((row) => indexRowToComment(row)),
    profiles: data.profiles || {},
  };
}

/**
 * Create a new comment. Dispatches to the Nostr signed-event path when the
 * active session is Nostr; falls back to the atproto BFF path otherwise.
 */
export async function createComment(params: CreateCommentParams): Promise<CreateCommentResponse> {
  if (isNostrSession()) {
    return createNostrComment(params);
  }

  const response = await fetch(COMMENTS_URL, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      principal: params.subject.principal,
      contractName: params.subject.contractName,
      txId: params.subject.txId,
      text: params.text,
      lineNumber: params.lineNumber,
      lineRange: params.lineRange,
      reply: params.reply,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create comment");
  }

  return response.json();
}

/**
 * Add a reaction to a comment.
 *
 * For Nostr sessions, `uri` is the target event id (hex) and `cid` is
 * repurposed to carry the target author's pubkey (also hex) so the client
 * can build a NIP-25 `p` tag. Callers that already use hex event ids (all
 * Nostr-authored comments) can pass `comment.pubkey` as the `cid`
 * argument. For atproto sessions, `uri` / `cid` keep their AT meanings.
 */
export async function addReaction(uri: string, cid: string, emoji: string): Promise<ReactionResponse> {
  if (isNostrSession()) {
    return addNostrReaction(uri, cid, emoji);
  }

  const response = await fetch(`${COMMENTS_URL}/reaction`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ uri, cid, emoji }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to add reaction");
  }

  return response.json();
}

/**
 * Remove a reaction from a comment.
 *
 * Nostr uses NIP-09 kind-5 deletion events; atproto does a direct
 * `deleteRecord`. `reactionUri` is the Nostr event id for Nostr sessions
 * or the at:// URI of the reaction record for atproto sessions.
 */
export async function removeReaction(reactionUri: string): Promise<void> {
  if (isNostrSession()) {
    return publishNostrDeletion(reactionUri, "Failed to remove reaction");
  }

  const response = await fetch(`${COMMENTS_URL}/reaction?uri=${encodeURIComponent(reactionUri)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to remove reaction");
  }
}

/** @deprecated Use addReaction instead */
export async function likeComment(uri: string, cid: string): Promise<LikeResponse> {
  return addReaction(uri, cid, "👍");
}

/** @deprecated Use removeReaction instead */
export async function unlikeComment(likeUri: string): Promise<void> {
  return removeReaction(likeUri);
}

/**
 * Delete a comment. For Nostr sessions, `rkey` is the comment event id
 * and deletion is published as a NIP-09 kind-5 event.
 */
export async function deleteComment(rkey: string): Promise<void> {
  if (isNostrSession()) {
    return publishNostrDeletion(rkey, "Failed to delete comment");
  }

  const response = await fetch(`${COMMENTS_URL}/${rkey}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete comment");
  }
}

/**
 * Get reactions for a contract (not a comment)
 */
export async function getContractReactions(
  principal: string,
  contractName: string
): Promise<ContractReactionsResponse> {
  const params = new URLSearchParams({ principal, contractName });
  
  // Include auth header if available to get user's reaction
  const headers: HeadersInit = { "Content-Type": "application/json" };
  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  
  const response = await fetch(`${COMMENTS_URL}/contract-reactions?${params.toString()}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    // Return empty reactions on error
    return { reactions: {} };
  }

  return response.json();
}

/**
 * Add a reaction to a contract (not a comment). For Nostr this requires
 * a txId so the event can carry the NIP-73 stacks:tx root; atproto has no
 * such requirement.
 */
export async function addContractReaction(
  principal: string,
  contractName: string,
  txId: string | undefined,
  emoji: string
): Promise<{ uri?: string; removed?: boolean }> {
  if (isNostrSession()) {
    if (!txId) {
      throw new Error("Contract reactions on Nostr require a deploy txId");
    }
    return addNostrContractReaction(txId, emoji);
  }

  const response = await fetch(`${COMMENTS_URL}/contract-reaction`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ principal, contractName, txId, emoji }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to add reaction");
  }

  return response.json();
}
