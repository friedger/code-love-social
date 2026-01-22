import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  createAuthenticatedAgent, 
  isTokenExpired, 
  refreshAccessToken,
} from "../_shared/atproto-agent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_BSKY_API = "https://public.api.bsky.app/xrpc";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============= Priority Algorithm Configuration =============
// Easy to modify - change these weights to adjust the ranking algorithm

interface PriorityConfig {
  // Points per comment by a followed user
  commentWeight: number;
  // Points per like received by a followed user's comments  
  likeReceivedWeight: number;
  // Points per like given by a followed user
  likeGivenWeight: number;
  // Recent activity bonus multiplier (for activity in last 30 days)
  recentActivityMultiplier: number;
  // Days considered "recent" for the multiplier
  recentDays: number;
}

const PRIORITY_CONFIG: PriorityConfig = {
  commentWeight: 10,
  likeReceivedWeight: 2,
  likeGivenWeight: 1,
  recentActivityMultiplier: 1.5,
  recentDays: 30,
};

// ============= Types =============

interface ProfileView {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

interface PrioritizedProfile extends ProfileView {
  priorityScore: number;
}

// ============= Session Helpers =============

async function getValidSession(sessionToken: string) {
  const { data: session, error } = await supabase
    .from("atproto_sessions")
    .select("*")
    .eq("session_token", sessionToken)
    .single();

  if (error || !session) {
    throw new Error("Invalid session");
  }

  if (isTokenExpired(session.token_expires_at)) {
    console.log("Access token expired, refreshing...");
    
    if (!session.refresh_token || !session.auth_server_url) {
      throw new Error("Session cannot be refreshed");
    }

    const newTokens = await refreshAccessToken(
      {
        did: session.did,
        pds_url: session.pds_url,
        access_token: session.access_token,
        dpop_private_key_jwk: session.dpop_private_key_jwk,
        auth_server_url: session.auth_server_url,
      },
      session.refresh_token,
      session.auth_server_url
    );

    await supabase
      .from("atproto_sessions")
      .update({
        access_token: newTokens.accessToken,
        refresh_token: newTokens.refreshToken,
        token_expires_at: newTokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    return {
      ...session,
      access_token: newTokens.accessToken,
    };
  }

  return session;
}

// ============= Priority Score Calculation =============

async function calculatePriorityScores(
  followsDids: string[],
  config: PriorityConfig = PRIORITY_CONFIG
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  
  // Initialize all with 0
  for (const did of followsDids) {
    scores.set(did, 0);
  }

  if (followsDids.length === 0) return scores;

  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - config.recentDays);
  const recentCutoffStr = recentCutoff.toISOString();

  // Count comments by each followed user
  const { data: commentCounts } = await supabase
    .from("comments_index")
    .select("author_did, created_at")
    .in("author_did", followsDids);

  if (commentCounts) {
    for (const comment of commentCounts) {
      const current = scores.get(comment.author_did) || 0;
      const isRecent = comment.created_at >= recentCutoffStr;
      const points = config.commentWeight * (isRecent ? config.recentActivityMultiplier : 1);
      scores.set(comment.author_did, current + points);
    }
  }

  // Count likes received by each followed user's comments
  // First get comment URIs by followed users
  const { data: userComments } = await supabase
    .from("comments_index")
    .select("uri, author_did")
    .in("author_did", followsDids);

  if (userComments && userComments.length > 0) {
    const commentUris = userComments.map(c => c.uri);
    const uriToAuthor = new Map(userComments.map(c => [c.uri, c.author_did]));

    // Get likes on those comments
    const { data: likesReceived } = await supabase
      .from("likes_index")
      .select("subject_uri, created_at")
      .in("subject_uri", commentUris);

    if (likesReceived) {
      for (const like of likesReceived) {
        const authorDid = uriToAuthor.get(like.subject_uri);
        if (authorDid) {
          const current = scores.get(authorDid) || 0;
          const isRecent = like.created_at >= recentCutoffStr;
          const points = config.likeReceivedWeight * (isRecent ? config.recentActivityMultiplier : 1);
          scores.set(authorDid, current + points);
        }
      }
    }
  }

  // Count likes given by each followed user
  const { data: likesGiven } = await supabase
    .from("likes_index")
    .select("author_did, created_at")
    .in("author_did", followsDids);

  if (likesGiven) {
    for (const like of likesGiven) {
      const current = scores.get(like.author_did) || 0;
      const isRecent = like.created_at >= recentCutoffStr;
      const points = config.likeGivenWeight * (isRecent ? config.recentActivityMultiplier : 1);
      scores.set(like.author_did, current + points);
    }
  }

  return scores;
}

// ============= Bluesky API Helpers =============

async function getFollowingFromBsky(actor: string, limit: number = 100): Promise<ProfileView[]> {
  const params = new URLSearchParams({ actor, limit: limit.toString() });
  const response = await fetch(`${PUBLIC_BSKY_API}/app.bsky.graph.getFollows?${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch follows: ${response.status}`);
  }

  const data = await response.json();
  return data.follows.map((f: Record<string, unknown>) => ({
    did: f.did,
    handle: f.handle,
    displayName: f.displayName,
    avatar: f.avatar,
    description: f.description,
  }));
}

async function getRelationship(viewerDid: string, targetDid: string): Promise<{
  following: boolean;
  followedBy: boolean;
  followUri?: string;
}> {
  const params = new URLSearchParams({ actor: viewerDid, "actors[]": targetDid });
  // Use getRelationships endpoint
  const response = await fetch(`${PUBLIC_BSKY_API}/app.bsky.graph.getRelationships?${params}`);
  
  if (!response.ok) {
    // Fall back to checking via profile
    return { following: false, followedBy: false };
  }

  const data = await response.json();
  const relationship = data.relationships?.[0];
  
  return {
    following: !!relationship?.following,
    followedBy: !!relationship?.followedBy,
    followUri: relationship?.following,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // ["social"] or ["social", "follows"] or ["social", "follow"]

  try {
    // ============== GET /social/follows?actor=... ==============
    // Get prioritized follows for a user
    if (req.method === "GET" && pathParts[1] === "follows") {
      const actor = url.searchParams.get("actor");
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);

      if (!actor) {
        return new Response(
          JSON.stringify({ error: "Missing actor parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get follows from Bluesky
      const follows = await getFollowingFromBsky(actor, Math.min(limit, 100));
      
      if (follows.length === 0) {
        return new Response(
          JSON.stringify({ follows: [], config: PRIORITY_CONFIG }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calculate priority scores
      const followsDids = follows.map(f => f.did);
      const scores = await calculatePriorityScores(followsDids);

      // Add scores and sort
      const prioritizedFollows: PrioritizedProfile[] = follows.map(f => ({
        ...f,
        priorityScore: scores.get(f.did) || 0,
      }));

      prioritizedFollows.sort((a, b) => b.priorityScore - a.priorityScore);

      return new Response(
        JSON.stringify({ 
          follows: prioritizedFollows,
          config: PRIORITY_CONFIG,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============== GET /social/relationship?target=... ==============
    // Check if current user follows a target
    if (req.method === "GET" && pathParts[1] === "relationship") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");
      const target = url.searchParams.get("target");

      if (!target) {
        return new Response(
          JSON.stringify({ error: "Missing target parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!sessionToken) {
        // Not logged in - return unknown relationship
        return new Response(
          JSON.stringify({ following: false, followedBy: false, authenticated: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const session = await getValidSession(sessionToken);
      const relationship = await getRelationship(session.did, target);

      return new Response(
        JSON.stringify({ ...relationship, authenticated: true, viewerDid: session.did }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============== POST /social/follow ==============
    // Follow a user
    if (req.method === "POST" && pathParts[1] === "follow") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const session = await getValidSession(sessionToken);
      const body = await req.json();
      const { did: targetDid } = body;

      if (!targetDid) {
        return new Response(
          JSON.stringify({ error: "Missing did" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const agent = await createAuthenticatedAgent({
        did: session.did,
        pds_url: session.pds_url,
        access_token: session.access_token,
        dpop_private_key_jwk: session.dpop_private_key_jwk,
      });

      // Create follow record using app.bsky.graph.follow
      const result = await agent.app.bsky.graph.follow.create(
        { repo: session.did },
        { subject: targetDid, createdAt: new Date().toISOString() }
      );

      return new Response(
        JSON.stringify({ uri: result.uri, cid: result.cid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============== DELETE /social/follow ==============
    // Unfollow a user
    if (req.method === "DELETE" && pathParts[1] === "follow") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const session = await getValidSession(sessionToken);
      const followUri = url.searchParams.get("uri");

      if (!followUri) {
        return new Response(
          JSON.stringify({ error: "Missing follow uri" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract rkey from URI: at://did:plc:xxx/app.bsky.graph.follow/rkey
      const uriMatch = followUri.match(/at:\/\/([^/]+)\/app\.bsky\.graph\.follow\/([^/]+)/);
      if (!uriMatch) {
        return new Response(
          JSON.stringify({ error: "Invalid follow uri" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [, , rkey] = uriMatch;

      const agent = await createAuthenticatedAgent({
        did: session.did,
        pds_url: session.pds_url,
        access_token: session.access_token,
        dpop_private_key_jwk: session.dpop_private_key_jwk,
      });

      await agent.app.bsky.graph.follow.delete({ repo: session.did, rkey });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Social function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
