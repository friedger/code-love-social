import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Compute SHA-512/256 hash of source code for identicon generation.
 * SHA-512/256 uses SHA-512 with a different IV and truncates to 256 bits.
 * Since Web Crypto doesn't support SHA-512/256 directly, we use SHA-512
 * and truncate to the first 256 bits (32 bytes).
 */
async function computeSourceHash(sourceCode: string): Promise<string> {
  const data = new TextEncoder().encode(sourceCode);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  // Take first 32 bytes (256 bits) of SHA-512 output
  const truncated = new Uint8Array(hashBuffer).slice(0, 32);
  const hexBytes = encodeHex(truncated);
  return new TextDecoder().decode(hexBytes);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify bearer token for authentication
  const authHeader = req.headers.get("Authorization");
  const chainhookToken = Deno.env.get("CHAINHOOK_AUTH_TOKEN");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  const isValidChainhook = chainhookToken && authHeader === `Bearer ${chainhookToken}`;
  const isValidServiceRole = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;
  
  const isValidChainhook = chainhookToken && authHeader === `Bearer ${chainhookToken}`;
  const isValidServiceRole = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;
  
  if (!isValidChainhook && !isValidServiceRole) {
    console.error("Unauthorized: Invalid or missing auth token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch all contracts to re-hash with SHA-512/256
  const { data: contracts, error: fetchError } = await supabase
    .from("contracts")
    .select("id, source_code");

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
