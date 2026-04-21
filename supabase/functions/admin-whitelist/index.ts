// Admin whitelist management.
//
// Lets a designated admin list, add, and remove entries from
// `ingest_whitelist`. Auth model:
//
//   - The admin signs in through the normal Bluesky flow and gets a
//     session token in `atproto_sessions`.
//   - Their DID must appear in the comma-separated `ADMIN_DIDS` env var.
//   - Every request must carry `Authorization: Bearer <session-token>`;
//     the function looks up the session, checks the DID against
//     ADMIN_DIDS, and only then acts.
//
// No UI is provided for MVP. curl / the Supabase dashboard is enough:
//
//   curl -s -H "Authorization: Bearer $TOKEN" \
//     $SUPABASE_URL/functions/v1/admin-whitelist
//
//   curl -s -X POST -H "Authorization: Bearer $TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"author_type":"nostr","identifier":"<hex>","note":"core team"}' \
//     $SUPABASE_URL/functions/v1/admin-whitelist
//
//   curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
//     "$SUPABASE_URL/functions/v1/admin-whitelist?author_type=nostr&identifier=<hex>"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_DIDS = (Deno.env.get("ADMIN_DIDS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdmin(req: Request): Promise<string> {
  if (ADMIN_DIDS.length === 0) {
    throw new Error("ADMIN_DIDS env var not configured");
  }
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!bearer) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from("atproto_sessions")
    .select("did")
    .eq("session_token", bearer)
    .maybeSingle();
  if (error || !data) throw new Error("Unauthorized");
  if (!ADMIN_DIDS.includes(data.did)) throw new Error("Forbidden");
  return data.did;
}

interface WhitelistInput {
  author_type: unknown;
  identifier: unknown;
  note?: unknown;
}

function validateEntry(body: WhitelistInput): {
  author_type: "atproto" | "nostr";
  identifier: string;
  note?: string;
} {
  if (body.author_type !== "atproto" && body.author_type !== "nostr") {
    throw new Error("author_type must be 'atproto' or 'nostr'");
  }
  if (typeof body.identifier !== "string" || body.identifier.length === 0) {
    throw new Error("identifier is required");
  }
  const authorType = body.author_type;
  const identifier = body.identifier.trim();

  if (authorType === "nostr" && !/^[0-9a-f]{64}$/.test(identifier)) {
    throw new Error("Nostr identifier must be a 64-char lowercase hex pubkey");
  }
  if (authorType === "atproto" && !identifier.startsWith("did:")) {
    throw new Error("Atproto identifier must be a DID");
  }

  const note = typeof body.note === "string" ? body.note : undefined;
  return { author_type: authorType, identifier, note };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminDid = await requireAdmin(req);
    const url = new URL(req.url);

    // GET /admin-whitelist — list all entries
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("ingest_whitelist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ entries: data ?? [] });
    }

    // POST /admin-whitelist — add an entry
    if (req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as WhitelistInput;
      const entry = validateEntry(body);
      const { data, error } = await supabase
        .from("ingest_whitelist")
        .upsert(
          { ...entry, added_by: adminDid },
          { onConflict: "author_type,identifier", ignoreDuplicates: false },
        )
        .select()
        .maybeSingle();
      if (error) throw error;
      return json({ entry: data });
    }

    // DELETE /admin-whitelist?author_type=...&identifier=...
    if (req.method === "DELETE") {
      const authorType = url.searchParams.get("author_type");
      const identifier = url.searchParams.get("identifier");
      if (authorType !== "atproto" && authorType !== "nostr") {
        return json({ error: "Missing or invalid author_type" }, 400);
      }
      if (!identifier) return json({ error: "Missing identifier" }, 400);
      const { error } = await supabase
        .from("ingest_whitelist")
        .delete()
        .eq("author_type", authorType)
        .eq("identifier", identifier.trim());
      if (error) throw error;
      return json({ removed: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Unauthorized"
      ? 401
      : message === "Forbidden"
        ? 403
        : message.startsWith("ADMIN_DIDS") || message.includes("must be")
          ? 400
          : 500;
    return json({ error: message }, status);
  }
});
