import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAuthenticatedAgent, generateTID } from "../_shared/atproto-agent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// AT Protocol collection names
const COMMENT_COLLECTION = "com.source-of-clarity.temp.comment";
const LIKE_COLLECTION = "com.source-of-clarity.temp.like";

// Create Supabase client with service role for database access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Validate session token and return session data
 */
async function getSession(sessionToken: string) {
  const { data: session, error } = await supabase
    .from("atproto_sessions")
    .select("*")
    .eq("session_token", sessionToken)
    .single();

  if (error || !session) {
    throw new Error("Invalid session");
  }

  return session;
}

/**
 * Validate comment record structure
 */
function validateCommentInput(body: unknown): {
  principal: string;
  contractName: string;
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
    // List comments for a contract
    if (req.method === "GET" && pathParts.length === 1 && pathParts[0] === "comments") {
      const principal = url.searchParams.get("principal");
      const contractName = url.searchParams.get("contractName");
      const lineNumber = url.searchParams.get("lineNumber");

      if (!principal || !contractName) {
        return new Response(
          JSON.stringify({ error: "Missing principal or contractName" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Query local index
      let query = supabase
        .from("comments_index")
        .select("*")
        .eq("principal", principal)
        .eq("contract_name", contractName)
        .order("created_at", { ascending: true });

      if (lineNumber) {
        query = query.eq("line_number", parseInt(lineNumber, 10));
      }

      const { data: comments, error: queryError } = await query;

      if (queryError) {
        console.error("Query error:", queryError);
        throw new Error("Failed to fetch comments");
      }

      return new Response(JSON.stringify({ comments: comments || [] }), {
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

      const session = await getSession(sessionToken);
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

    // ============== POST /comments/like ==============
    // Like a comment
    if (req.method === "POST" && pathParts.length === 2 && pathParts[1] === "like") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const session = await getSession(sessionToken);
      const body = await req.json();

      if (!body.uri || !body.cid) {
        return new Response(
          JSON.stringify({ error: "Missing uri or cid" }),
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

      // Build the like record
      const likeRecord = {
        $type: LIKE_COLLECTION,
        subject: {
          uri: body.uri,
          cid: body.cid,
        },
        createdAt: new Date().toISOString(),
      };

      // Generate TID for rkey
      const rkey = generateTID();

      // Write to user's PDS
      const response = await agent.com.atproto.repo.putRecord({
        repo: session.did,
        collection: LIKE_COLLECTION,
        rkey,
        record: likeRecord,
      });

      // Store in likes index
      const { error: likeIndexError } = await supabase.from("likes_index").insert({
        uri: response.data.uri,
        cid: response.data.cid,
        author_did: session.did,
        subject_uri: body.uri,
        subject_cid: body.cid,
      });

      if (likeIndexError) {
        console.error("Like index error:", likeIndexError);
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

    // ============== DELETE /comments/like ==============
    // Unlike a comment
    if (req.method === "DELETE" && pathParts.length === 2 && pathParts[1] === "like") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const session = await getSession(sessionToken);
      const likeUri = url.searchParams.get("uri");

      if (!likeUri) {
        return new Response(
          JSON.stringify({ error: "Missing like uri" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract rkey from URI
      const uriMatch = likeUri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
      if (!uriMatch) {
        return new Response(
          JSON.stringify({ error: "Invalid like uri" }),
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
        collection: LIKE_COLLECTION,
        rkey,
      });

      // Remove from index
      await supabase.from("likes_index").delete().eq("uri", likeUri);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      const session = await getSession(sessionToken);
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
