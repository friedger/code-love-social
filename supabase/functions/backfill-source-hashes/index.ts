import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Compute SHA-256 hash of source code for identicon generation
 */
async function computeSourceHash(sourceCode: string): Promise<string> {
  const data = new TextEncoder().encode(sourceCode);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const hexBytes = encodeHex(hashArray);
  return new TextDecoder().decode(hexBytes);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify bearer token for authentication
  const authHeader = req.headers.get("Authorization");
  const expectedToken = Deno.env.get("CHAINHOOK_AUTH_TOKEN");
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    console.error("Unauthorized: Invalid or missing CHAINHOOK_AUTH_TOKEN");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch all contracts with null source_hash
  const { data: contracts, error: fetchError } = await supabase
    .from("contracts")
    .select("id, source_code")
    .is("source_hash", null);

  if (fetchError) {
    console.error("Failed to fetch contracts:", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!contracts || contracts.length === 0) {
    return new Response(JSON.stringify({ 
      message: "No contracts need backfill",
      updated: 0 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Backfilling source_hash for ${contracts.length} contracts`);

  let updated = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const contract of contracts) {
    try {
      const sourceHash = await computeSourceHash(contract.source_code);
      
      const { error: updateError } = await supabase
        .from("contracts")
        .update({ source_hash: sourceHash })
        .eq("id", contract.id);

      if (updateError) {
        errors.push({ id: contract.id, error: updateError.message });
      } else {
        updated++;
      }
    } catch (err) {
      errors.push({ id: contract.id, error: String(err) });
    }
  }

  console.log(`Backfill complete: ${updated} updated, ${errors.length} errors`);

  return new Response(JSON.stringify({ 
    message: "Backfill complete",
    total: contracts.length,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
