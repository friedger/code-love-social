import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  createAuthenticatedAgent, 
  generateTID, 
  isTokenExpired, 
  refreshAccessToken,
  type SessionData 
} from "../_shared/atproto-agent.ts";
import { 
  checkRateLimit, 
  getClientIP, 
  rateLimitResponse, 
  RATE_LIMITS 
} from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OAUTH_ENCRYPTION_KEY = Deno.env.get("OAUTH_ENCRYPTION_KEY");

// AT Protocol collection names
const COMMENT_COLLECTION = "com.source-of-clarity.temp.comment";
const REACTION_COLLECTION = "com.source-of-clarity.temp.reaction";

// Create Supabase client with service role for database access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============= ENCRYPTION HELPERS =============
// Application-level decryption using Web Crypto API (AES-GCM)

async function getEncryptionKey(): Promise<CryptoKey> {
  if (!OAUTH_ENCRYPTION_KEY) {
    throw new Error("OAUTH_ENCRYPTION_KEY not configured");
  }
  
  // Derive a 256-bit key from the secret using SHA-256
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(OAUTH_ENCRYPTION_KEY)
  );
  
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function decryptSecret(ciphertext: string): Promise<string> {
  if (!ciphertext) return ciphertext;
  
  const key = await getEncryptionKey();
  
  // Decode base64 and split IV from ciphertext
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}

async function encryptSecret(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Validate session token, refresh if needed, and return session data with fresh token
 */
async function getValidSession(sessionToken: string): Promise<{
  session: SessionData & { id: string; did: string; handle: string };
  refreshed: boolean;
}> {
  const { data: session, error } = await supabase
    .from("atproto_sessions")
    .select("*")
    .eq("session_token", sessionToken)
    .single();

  if (error || !session) {
    throw new Error("Invalid session");
  }

  // Decrypt sensitive fields
  const decryptedAccessToken = await decryptSecret(session.access_token);
  const decryptedRefreshToken = session.refresh_token 
    ? await decryptSecret(session.refresh_token) 
    : null;
  const decryptedDpopKey = session.dpop_private_key_jwk 
    ? await decryptSecret(session.dpop_private_key_jwk) 
    : null;

  // Check if token is expired or about to expire
  if (isTokenExpired(session.token_expires_at)) {
    console.log("Access token expired, refreshing...");
    
    if (!decryptedRefreshToken || !session.auth_server_url) {
      throw new Error("Session cannot be refreshed - missing refresh token or auth server URL");
    }

    try {
      const newTokens = await refreshAccessToken(
        {
          did: session.did,
          pds_url: session.pds_url,
          access_token: decryptedAccessToken,
          dpop_private_key_jwk: decryptedDpopKey || "",
          auth_server_url: session.auth_server_url,
        },
        decryptedRefreshToken,
        session.auth_server_url
      );

      // Encrypt new tokens before storing
      const encryptedAccessToken = await encryptSecret(newTokens.accessToken);
      const encryptedRefreshToken = await encryptSecret(newTokens.refreshToken);

      // Update session in database
      const { error: updateError } = await supabase
        .from("atproto_sessions")
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: newTokens.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (updateError) {
        console.error("Failed to update session:", updateError);
      }

      console.log("Token refreshed successfully");

      return {
        session: {
          ...session,
          access_token: newTokens.accessToken,
          refresh_token: newTokens.refreshToken,
          dpop_private_key_jwk: decryptedDpopKey,
          token_expires_at: newTokens.expiresAt.toISOString(),
        },
        refreshed: true,
      };
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      throw new Error("Session expired and refresh failed");
    }
  }

  return { 
    session: {
      ...session,
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken,
      dpop_private_key_jwk: decryptedDpopKey || "",
    }, 
    refreshed: false 
  };
}

/**
 * Validate comment record structure
 */
function validateCommentInput(body: unknown): {
  principal: string;
  contractName: string;
  txId?: string;
  text: string;
  lineNumber?: number;
  lineRange?: { start: number; end: number };
  reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } };
} {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body");
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.principal !== "string" || !obj.principal) {
    throw new Error("Missing or invalid principal");
  }
  if (typeof obj.contractName !== "string" || !obj.contractName) {
    throw new Error("Missing or invalid contractName");
  }
  if (typeof obj.text !== "string" || !obj.text || obj.text.length > 10000) {
    throw new Error("Missing or invalid text (max 10000 chars)");
  }

  // Validate lineNumber if present
  if (obj.lineNumber !== undefined) {
    if (typeof obj.lineNumber !== "number" || obj.lineNumber < 1 || !Number.isInteger(obj.lineNumber)) {
      throw new Error("Invalid lineNumber");
    }
  }

  // Validate lineRange if present
  if (obj.lineRange !== undefined) {
    const lr = obj.lineRange as Record<string, unknown>;
    if (
      typeof lr.start !== "number" ||
      typeof lr.end !== "number" ||
      lr.start < 1 ||
      lr.end < lr.start
    ) {
      throw new Error("Invalid lineRange");
    }
  }

  // Cannot have both lineNumber and lineRange
  if (obj.lineNumber !== undefined && obj.lineRange !== undefined) {
    throw new Error("Cannot specify both lineNumber and lineRange");
  }

  return {
    principal: obj.principal as string,
    contractName: obj.contractName as string,
    txId: obj.txId as string | undefined,
    text: obj.text as string,
    lineNumber: obj.lineNumber as number | undefined,
    lineRange: obj.lineRange as { start: number; end: number } | undefined,
    reply: obj.reply as { root: { uri: string; cid: string }; parent: { uri: string; cid: string } } | undefined,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // pathParts: ["comments"] or ["comments", "like"] or ["comments", "<rkey>"]

  try {
    // ============== GET /comments ==============
    // List comments for a contract, by author, or all (stream)
    if (req.method === "GET" && pathParts.length === 1 && pathParts[0] === "comments") {
      // Rate limit read operations by IP
      const clientIP = getClientIP(req);
      const rateLimitResult = checkRateLimit(clientIP, RATE_LIMITS.commentRead);
      if (!rateLimitResult.success) {
        return rateLimitResponse(rateLimitResult, corsHeaders);
      }
      const principal = url.searchParams.get("principal");
      const contractName = url.searchParams.get("contractName");
      const lineNumber = url.searchParams.get("lineNumber");
      const txId = url.searchParams.get("txId");
      const authorDid = url.searchParams.get("authorDid");
      const stream = url.searchParams.get("stream");
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);

      const search = url.searchParams.get("search");

      let query = supabase
        .from("comments_index")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, 100));

      // Search mode - search comments by text content
      if (search) {
        query = query.ilike("text", `%${search}%`);
      }
      // Stream mode - get all recent comments
      else if (stream === "true") {
        // No additional filters, just get latest
      }
      // Author mode - get comments by specific user
      else if (authorDid) {
        query = query.eq("author_did", authorDid);
      }
      // Contract mode - get comments for specific contract
      else if (principal && contractName) {
        query = query
          .eq("principal", principal)
          .eq("contract_name", contractName)
          .order("created_at", { ascending: true });

        if (lineNumber) {
          query = query.eq("line_number", parseInt(lineNumber, 10));
        }

        if (txId) {
          query = query.eq("tx_id", txId);
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Missing required parameters: provide principal+contractName, authorDid, search, or stream=true" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: comments, error: queryError } = await query;

      if (queryError) {
        console.error("Query error:", queryError);
        throw new Error("Failed to fetch comments");
      }

      // Fetch reaction counts for all comments
      const commentUris = (comments || []).map((c: { uri: string }) => c.uri);
      let reactionsByComment: Record<string, { counts: Record<string, number>; userReaction?: { emoji: string; uri: string } }> = {};
      
      if (commentUris.length > 0) {
        const { data: reactionsData } = await supabase
          .from("likes_index")
          .select("*")
          .in("subject_uri", commentUris);
        
        // Aggregate reactions by comment URI
        for (const reaction of reactionsData || []) {
          if (!reactionsByComment[reaction.subject_uri]) {
            reactionsByComment[reaction.subject_uri] = { counts: {} };
          }
          const emoji = reaction.emoji || "👍";
          reactionsByComment[reaction.subject_uri].counts[emoji] = 
            (reactionsByComment[reaction.subject_uri].counts[emoji] || 0) + 1;
        }
        
        // Check for current user's reactions if authenticated
        const authHeader = req.headers.get("Authorization");
        const sessionToken = authHeader?.replace("Bearer ", "");
        
        if (sessionToken) {
          try {
            const { session } = await getValidSession(sessionToken);
            for (const reaction of reactionsData || []) {
              if (reaction.author_did === session.did && reactionsByComment[reaction.subject_uri]) {
                reactionsByComment[reaction.subject_uri].userReaction = {
                  emoji: reaction.emoji || "👍",
                  uri: reaction.uri,
                };
              }
            }
          } catch {
            // Ignore auth errors - just don't include user reactions
          }
        }
      }

      // Fetch AT Protocol profiles for all unique authors
      const authorDids = [...new Set((comments || []).map((c: { author_did: string }) => c.author_did))];
      const profiles: Record<string, { did: string; handle: string; displayName?: string; avatar?: string }> = {};

      // Batch fetch profiles in groups of 25 (AppView limit)
      for (let i = 0; i < authorDids.length; i += 25) {
        const batch = authorDids.slice(i, i + 25);
        const params = new URLSearchParams();
        batch.forEach((did) => params.append("actors", did));

        try {
          const profilesResponse = await fetch(
            `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${params.toString()}`
          );

          if (profilesResponse.ok) {
            const data = await profilesResponse.json();
            for (const profile of data.profiles) {
              profiles[profile.did] = {
                did: profile.did,
                handle: profile.handle,
                displayName: profile.displayName,
                avatar: profile.avatar,
              };
            }
          }
        } catch (profileError) {
          console.error("Failed to fetch profiles:", profileError);
          // Continue without profiles - not fatal
        }
      }

      return new Response(JSON.stringify({ comments: comments || [], profiles, reactionsByComment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============== POST /comments ==============
    // Create a new comment
    if (req.method === "POST" && pathParts.length === 1 && pathParts[0] === "comments") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get session first to use user DID for rate limiting
      const { session } = await getValidSession(sessionToken);
      
      // Rate limit create operations by user DID
      const rateLimitResult = checkRateLimit(session.did, RATE_LIMITS.commentCreate);
      if (!rateLimitResult.success) {
        return rateLimitResponse(rateLimitResult, corsHeaders);
      }

      const body = await req.json();
      const input = validateCommentInput(body);

      // Create authenticated agent
      const agent = await createAuthenticatedAgent({
        did: session.did,
        pds_url: session.pds_url,
        access_token: session.access_token,
        dpop_private_key_jwk: session.dpop_private_key_jwk,
      });

      // Build the comment record
      const record: Record<string, unknown> = {
        $type: COMMENT_COLLECTION,
        subject: {
          principal: input.principal,
          contractName: input.contractName,
          txId: input.txId,
        },
        text: input.text,
        createdAt: new Date().toISOString(),
      };

      if (input.lineNumber !== undefined) {
        record.lineNumber = input.lineNumber;
      }
      if (input.lineRange !== undefined) {
        record.lineRange = input.lineRange;
      }
      if (input.reply !== undefined) {
        record.reply = input.reply;
      }

      // Generate TID for rkey
      const rkey = generateTID();

      // Write to user's PDS using putRecord
      const response = await agent.com.atproto.repo.putRecord({
        repo: session.did,
        collection: COMMENT_COLLECTION,
        rkey,
        record,
      });

      // Store in local index for querying
      const { error: indexError } = await supabase.from("comments_index").insert({
        uri: response.data.uri,
        cid: response.data.cid,
        author_did: session.did,
        principal: input.principal,
        contract_name: input.contractName,
        tx_id: input.txId,
        line_number: input.lineNumber,
        line_range_start: input.lineRange?.start,
        line_range_end: input.lineRange?.end,
        parent_uri: input.reply?.parent.uri,
        text: input.text,
      });

      if (indexError) {
        console.error("Index insert error:", indexError);
        // Don't fail - the record is in the PDS, just not indexed
      }

      return new Response(
        JSON.stringify({
          uri: response.data.uri,
          cid: response.data.cid,
          rkey,
          ...record,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============== POST /comments/reaction ==============
    // Add a reaction to a comment
    if (req.method === "POST" && pathParts.length === 2 && pathParts[1] === "reaction") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { session } = await getValidSession(sessionToken);
      
      // Rate limit reaction operations by user DID
      const rateLimitResult = checkRateLimit(session.did, RATE_LIMITS.commentReaction);
      if (!rateLimitResult.success) {
        return rateLimitResponse(rateLimitResult, corsHeaders);
      }

      const body = await req.json();

      if (!body.uri || !body.cid || !body.emoji) {
        return new Response(
          JSON.stringify({ error: "Missing uri, cid, or emoji" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create authenticated agent
      const agent = await createAuthenticatedAgent({
        did: session.did,
        pds_url: session.pds_url,
        access_token: session.access_token,
        dpop_private_key_jwk: session.dpop_private_key_jwk,
      });

      // Build the reaction record
      const reactionRecord = {
        $type: REACTION_COLLECTION,
        subject: {
          uri: body.uri,
          cid: body.cid,
        },
        emoji: body.emoji,
        createdAt: new Date().toISOString(),
      };

      // Generate TID for rkey
      const rkey = generateTID();

      // Write to user's PDS
      const response = await agent.com.atproto.repo.putRecord({
        repo: session.did,
        collection: REACTION_COLLECTION,
        rkey,
        record: reactionRecord,
      });

      // Store in likes index with emoji
      const { error: likeIndexError } = await supabase.from("likes_index").insert({
        uri: response.data.uri,
        cid: response.data.cid,
        author_did: session.did,
        subject_uri: body.uri,
        subject_cid: body.cid,
        emoji: body.emoji,
      });

      if (likeIndexError) {
        console.error("Reaction index error:", likeIndexError);
      }

      return new Response(
        JSON.stringify({
          uri: response.data.uri,
          cid: response.data.cid,
          rkey,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============== DELETE /comments/reaction ==============
    // Remove a reaction
    if (req.method === "DELETE" && pathParts.length === 2 && pathParts[1] === "reaction") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { session } = await getValidSession(sessionToken);
      
      // Rate limit reaction operations by user DID
      const rateLimitResult = checkRateLimit(session.did, RATE_LIMITS.commentReaction);
      if (!rateLimitResult.success) {
        return rateLimitResponse(rateLimitResult, corsHeaders);
      }

      const reactionUri = url.searchParams.get("uri");

      if (!reactionUri) {
        return new Response(
          JSON.stringify({ error: "Missing reaction uri" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract rkey from URI
      const uriMatch = reactionUri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
      if (!uriMatch) {
        return new Response(
          JSON.stringify({ error: "Invalid reaction uri" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [, , , rkey] = uriMatch;

      // Create authenticated agent
      const agent = await createAuthenticatedAgent({
        did: session.did,
        pds_url: session.pds_url,
        access_token: session.access_token,
        dpop_private_key_jwk: session.dpop_private_key_jwk,
      });

      // Delete from user's PDS
      await agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: REACTION_COLLECTION,
        rkey,
      });

      // Remove from index
      await supabase.from("likes_index").delete().eq("uri", reactionUri);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============== GET /comments/contract-reactions ==============
    // Get reactions for a contract (not a comment)
    if (req.method === "GET" && pathParts.length === 2 && pathParts[1] === "contract-reactions") {
      // Rate limit read operations by IP
      const clientIP = getClientIP(req);
      const rateLimitResult = checkRateLimit(clientIP, RATE_LIMITS.commentRead);
      if (!rateLimitResult.success) {
        return rateLimitResponse(rateLimitResult, corsHeaders);
      }
      const principal = url.searchParams.get("principal");
      const contractName = url.searchParams.get("contractName");

      if (!principal || !contractName) {
        return new Response(
          JSON.stringify({ error: "Missing principal or contractName" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build synthetic subject URI
      const subjectUri = `contract://${principal}.${contractName}`;

      // Fetch all reactions for this contract
      const { data: reactionsData, error: reactionsError } = await supabase
        .from("likes_index")
        .select("*")
        .eq("subject_uri", subjectUri);

      if (reactionsError) {
        console.error("Failed to fetch contract reactions:", reactionsError);
        return new Response(
          JSON.stringify({ reactions: {} }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Aggregate reactions by emoji
      const reactions: Record<string, number> = {};
      for (const r of reactionsData || []) {
        reactions[r.emoji] = (reactions[r.emoji] || 0) + 1;
      }

      // Check if current user has reacted (if auth header present)
      let userReaction: { emoji: string; uri: string } | undefined;
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (sessionToken) {
        try {
          const { session } = await getValidSession(sessionToken);
          const userReactionRow = (reactionsData || []).find(
            (r) => r.author_did === session.did
          );
          if (userReactionRow) {
            userReaction = { emoji: userReactionRow.emoji, uri: userReactionRow.uri };
          }
        } catch {
          // Ignore auth errors for GET - just don't include userReaction
        }
      }

      return new Response(
        JSON.stringify({ reactions, userReaction }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============== POST /comments/contract-reaction ==============
    // Add/toggle a reaction to a contract
    if (req.method === "POST" && pathParts.length === 2 && pathParts[1] === "contract-reaction") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { session } = await getValidSession(sessionToken);
      
      // Rate limit reaction operations by user DID
      const rateLimitResult = checkRateLimit(session.did, RATE_LIMITS.commentReaction);
      if (!rateLimitResult.success) {
        return rateLimitResponse(rateLimitResult, corsHeaders);
      }

      const body = await req.json();

      const { principal, contractName, txId, emoji } = body;

      if (!principal || !contractName || !emoji) {
        return new Response(
          JSON.stringify({ error: "Missing principal, contractName, or emoji" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build synthetic subject
      const subjectUri = `contract://${principal}.${contractName}`;
      const subjectCid = txId || "";

      // Check for existing reaction from this user on this contract
      const { data: existing } = await supabase
        .from("likes_index")
        .select("*")
        .eq("author_did", session.did)
        .eq("subject_uri", subjectUri)
        .single();

      // Create authenticated agent
      const agent = await createAuthenticatedAgent({
        did: session.did,
        pds_url: session.pds_url,
        access_token: session.access_token,
        dpop_private_key_jwk: session.dpop_private_key_jwk,
      });

      // If same emoji exists, toggle off (remove)
      if (existing && existing.emoji === emoji) {
        // Extract rkey from existing URI
        const uriMatch = existing.uri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
        if (uriMatch) {
          const [, , , rkey] = uriMatch;
          await agent.com.atproto.repo.deleteRecord({
            repo: session.did,
            collection: REACTION_COLLECTION,
            rkey,
          });
        }
        await supabase.from("likes_index").delete().eq("id", existing.id);
        return new Response(
          JSON.stringify({ removed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If different emoji exists, remove old first
      if (existing) {
        const uriMatch = existing.uri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
        if (uriMatch) {
          const [, , , rkey] = uriMatch;
          await agent.com.atproto.repo.deleteRecord({
            repo: session.did,
            collection: REACTION_COLLECTION,
            rkey,
          });
        }
        await supabase.from("likes_index").delete().eq("id", existing.id);
      }

      // Create new reaction record
      const reactionRecord = {
        $type: REACTION_COLLECTION,
        subject: {
          uri: subjectUri,
          cid: subjectCid,
        },
        emoji,
        createdAt: new Date().toISOString(),
      };

      const rkey = generateTID();

      const response = await agent.com.atproto.repo.putRecord({
        repo: session.did,
        collection: REACTION_COLLECTION,
        rkey,
        record: reactionRecord,
      });

      // Store in likes index
      const { error: indexError } = await supabase.from("likes_index").insert({
        uri: response.data.uri,
        cid: response.data.cid,
        author_did: session.did,
        subject_uri: subjectUri,
        subject_cid: subjectCid,
        emoji,
      });

      if (indexError) {
        console.error("Contract reaction index error:", indexError);
      }

      return new Response(
        JSON.stringify({
          uri: response.data.uri,
          cid: response.data.cid,
          rkey,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============== DELETE /comments/:rkey ==============
    // Delete own comment
    if (req.method === "DELETE" && pathParts.length === 2 && pathParts[0] === "comments" && pathParts[1] !== "like") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { session } = await getValidSession(sessionToken);
      
      // Rate limit delete operations by user DID
      const rateLimitResult = checkRateLimit(session.did, RATE_LIMITS.commentDelete);
      if (!rateLimitResult.success) {
        return rateLimitResponse(rateLimitResult, corsHeaders);
      }

      const rkey = pathParts[1];

      // Create authenticated agent
      const agent = await createAuthenticatedAgent({
        did: session.did,
        pds_url: session.pds_url,
        access_token: session.access_token,
        dpop_private_key_jwk: session.dpop_private_key_jwk,
      });

      // Delete from user's PDS
      await agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: COMMENT_COLLECTION,
        rkey,
      });

      // Remove from index
      const commentUri = `at://${session.did}/${COMMENT_COLLECTION}/${rkey}`;
      await supabase.from("comments_index").delete().eq("uri", commentUri);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const status = errorMessage === "Unauthorized" || errorMessage === "Invalid session" ? 401 : 500;
    return new Response(JSON.stringify({ error: errorMessage }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
