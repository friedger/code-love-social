import { getSessionToken } from "./atproto-auth";

const SOCIAL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social`;

export interface PrioritizedProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  priorityScore: number;
}

export interface PriorityConfig {
  commentWeight: number;
  likeReceivedWeight: number;
  likeGivenWeight: number;
  recentActivityMultiplier: number;
  recentDays: number;
}

export interface PrioritizedFollowsResponse {
  follows: PrioritizedProfile[];
  config: PriorityConfig;
}

export interface RelationshipResponse {
  following: boolean;
  followedBy: boolean;
  followUri?: string;
  authenticated: boolean;
  viewerDid?: string;
}

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
 * Get prioritized follows for a user, ordered by activity on this platform
 */
export async function getPrioritizedFollows(
  actor: string,
  limit: number = 50
): Promise<PrioritizedFollowsResponse> {
  const params = new URLSearchParams({ actor, limit: limit.toString() });
  
  const response = await fetch(`${SOCIAL_URL}/follows?${params}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch follows");
  }

  return response.json();
}

/**
 * Get the relationship between the current user and a target user
 */
export async function getRelationship(
  targetDid: string
): Promise<RelationshipResponse> {
  const sessionToken = getSessionToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const params = new URLSearchParams({ target: targetDid });
  const response = await fetch(`${SOCIAL_URL}/relationship?${params}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to check relationship");
  }

  return response.json();
}

/**
 * Follow a user
 */
export async function followUser(
  did: string
): Promise<{ uri: string; cid: string }> {
  const response = await fetch(`${SOCIAL_URL}/follow`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ did }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to follow user");
  }

  return response.json();
}

/**
 * Unfollow a user
 */
export async function unfollowUser(followUri: string): Promise<void> {
  const response = await fetch(
    `${SOCIAL_URL}/follow?uri=${encodeURIComponent(followUri)}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to unfollow user");
  }
}
