import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify bearer token for Chainhook authentication
  const authHeader = req.headers.get("Authorization");
  const expectedToken = Deno.env.get("CHAINHOOK_AUTH_TOKEN");
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    console.error("Unauthorized: Invalid or missing CHAINHOOK_AUTH_TOKEN");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const payload = await req.json();
  const results = { 
    applied: 0, 
    rolledBack: 0, 
    errors: [] as Array<{ contract_identifier: string; error: string }>,
    chainhookUuid: payload.chainhook?.uuid,
  };

  // Hiro Chainhook payload structure:
  // - event.apply: Array of blocks with new transactions
  // - event.rollback: Array of blocks being rolled back (reorg)
  const applyBlocks = payload.event?.apply || [];
  const rollbackBlocks = payload.event?.rollback || [];

  console.log(`Processing chainhook event: ${applyBlocks.length} apply blocks, ${rollbackBlocks.length} rollback blocks`);

  // Process ROLLBACK events FIRST (remove contracts from reorged blocks)
  // This ensures data consistency during chain reorganizations
  for (const block of rollbackBlocks) {
    for (const tx of block.transactions || []) {
      if (tx.metadata?.kind === "ContractDeployment") {
        const txId = tx.transaction_identifier?.hash;
        const contractIdentifier = tx.metadata.contract_identifier;
        const [principal, name] = contractIdentifier.split(".");
        
        console.log(`Rolling back contract: ${contractIdentifier} (tx: ${txId})`);
        
        // Delete by tx_id to ensure we only remove the specific deployment
        const { error } = await supabase
          .from("contracts")
          .delete()
          .eq("principal", principal)
          .eq("name", name)
          .eq("tx_id", txId);

        if (error) {
          console.error(`Rollback error for ${contractIdentifier}:`, error);
          results.errors.push({ contract_identifier: contractIdentifier, error: error.message });
        } else {
          results.rolledBack++;
        }
      }
    }
  }

  // Process APPLY events (new contract deployments)
  for (const block of applyBlocks) {
    for (const tx of block.transactions || []) {
      if (tx.metadata?.kind === "ContractDeployment") {
        const contractIdentifier = tx.metadata.contract_identifier;
        const sourceCode = tx.metadata.source_code;
        const [principal, name] = contractIdentifier.split(".");
        const txId = tx.transaction_identifier?.hash;
        
        console.log(`Applying contract: ${contractIdentifier} (tx: ${txId})`);
        
        const { error } = await supabase.from("contracts").upsert({
          principal,
          name,
          source_code: sourceCode,
          tx_id: txId,
          deployed_at: block.timestamp 
            ? new Date(block.timestamp * 1000).toISOString() 
            : null,
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: "principal,name,tx_id"
        });

        if (error) {
          console.error(`Apply error for ${contractIdentifier}:`, error);
          results.errors.push({ contract_identifier: contractIdentifier, error: error.message });
        } else {
          results.applied++;
        }
      }
    }
  }

  console.log(`Chainhook processing complete:`, results);

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
