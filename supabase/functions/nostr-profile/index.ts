// Fetches a single Nostr profile (kind-0) by hex pubkey.
// Reads cached row from `nostr_profiles`; if missing or stale, drains kind-0
// from default relays, upserts the freshest event, and returns it.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchAndCacheProfiles,
  loadCachedProfiles,
} from "../_shared/nostr-profiles.ts";
import { pubkeyToDid } from "../_shared/nostr.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const HEX64 = /^[0-9a-f]{64}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const url = new URL(req.url);
  const pubkey = (url.searchParams.get("pubkey") || "").toLowerCase();
  if (!HEX64.test(pubkey)) {
    return new Response(JSON.stringify({ error: "invalid pubkey" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const did = pubkeyToDid(pubkey);
  const cached = await loadCachedProfiles(supabase, [did]);

  // If missing, fetch synchronously (blocking) so the client gets data.
  if (cached.missing.length > 0 || cached.stale.length > 0) {
    await fetchAndCacheProfiles(supabase, [pubkey]);
  }

  const { data: row } = await supabase
    .from("nostr_profiles")
    .select("pubkey, name, display_name, picture, nip05, about")
    .eq("pubkey", pubkey)
    .maybeSingle();

  return new Response(JSON.stringify({ profile: row || null }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
