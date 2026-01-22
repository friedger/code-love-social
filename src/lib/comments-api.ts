import { getSessionToken } from "./atproto-auth";
import type { ContractRef, LineRange, ReplyRef, Comment } from "@/lexicon/types";

const COMMENTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comments`;

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
}

export interface CommentsWithProfiles {
  comments: Comment[];
  profiles: Record<string, ProfileData>;
}

export interface CommentIndexRow {
  id: string;
  uri: string;
  cid: string;
  author_did: string;
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

  const response = await fetch(`${COMMENTS_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch comments");
  }

  const data: CommentsResponse = await response.json();
  
  // TODO: Aggregate like counts from likes_index
  // For now, return with 0 likes
  return {
    comments: data.comments.map((row) => indexRowToComment(row)),
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
 * Create a new comment
 */
export async function createComment(params: CreateCommentParams): Promise<CreateCommentResponse> {
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
 * Add a reaction to a comment
 */
export async function addReaction(uri: string, cid: string, emoji: string): Promise<ReactionResponse> {
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
 * Remove a reaction from a comment
 */
export async function removeReaction(reactionUri: string): Promise<void> {
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
 * Delete a comment
 */
export async function deleteComment(rkey: string): Promise<void> {
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
  const response = await fetch(`${COMMENTS_URL}/contract-reactions?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    // Return empty reactions on error
    return { reactions: {} };
  }

  return response.json();
}

/**
 * Add a reaction to a contract (not a comment)
 */
export async function addContractReaction(
  principal: string,
  contractName: string,
  txId: string | undefined,
  emoji: string
): Promise<{ uri?: string; removed?: boolean }> {
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
