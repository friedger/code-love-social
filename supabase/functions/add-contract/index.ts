import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Compute SHA-512/256 hash of source code for identicon generation.
 * Uses SHA-512 truncated to first 256 bits.
 */
async function computeSourceHash(sourceCode: string): Promise<string> {
  const data = new TextEncoder().encode(sourceCode);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const truncated = new Uint8Array(hashBuffer).slice(0, 32);
  const hexBytes = encodeHex(truncated);
  return new TextDecoder().decode(hexBytes);
}

interface AddContractRequest {
  network: "mainnet" | "testnet";
  txId: string;
  description?: string;
  category?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse request body
    const body: AddContractRequest = await req.json();
    const { network, txId, description, category } = body;

    // Validate required fields
    if (!network || !txId) {
      return new Response(
        JSON.stringify({ error: "network and txId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate network
    if (network !== "mainnet" && network !== "testnet") {
      return new Response(
        JSON.stringify({ error: "network must be 'mainnet' or 'testnet'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate txId format (should be 0x followed by 64 hex chars)
    const txIdRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!txIdRegex.test(txId)) {
      return new Response(
        JSON.stringify({ error: "Invalid transaction ID format. Expected 0x followed by 64 hex characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine API base URL
    const baseUrl = network === "testnet" 
      ? "https://api.testnet.hiro.so" 
      : "https://api.hiro.so";

    console.log(`Fetching transaction ${txId} from ${network}`);

    // Fetch transaction details
    const txResponse = await fetch(`${baseUrl}/extended/v1/tx/${txId}`, {
      headers: { "Accept": "application/json" },
    });

    if (!txResponse.ok) {
      if (txResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: `Transaction not found on ${network}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Hiro API error: ${txResponse.status}`);
    }

    const txData = await txResponse.json();

    // Check if it's a contract deployment
    if (txData.tx_type !== "smart_contract") {
      return new Response(
        JSON.stringify({ error: "Transaction is not a contract deployment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contractId = txData.smart_contract?.contract_id;
    if (!contractId) {
      return new Response(
        JSON.stringify({ error: "Could not extract contract ID from transaction" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching contract source for ${contractId}`);

    // Fetch contract source code
    const contractResponse = await fetch(`${baseUrl}/extended/v1/contract/${contractId}`, {
      headers: { "Accept": "application/json" },
    });

    if (!contractResponse.ok) {
      throw new Error(`Failed to fetch contract source: ${contractResponse.status}`);
    }

    const contractData = await contractResponse.json();
    const sourceCode = contractData.source_code;

    if (!sourceCode) {
      return new Response(
        JSON.stringify({ error: "Contract has no source code available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse contract ID into principal and name
    const [principal, name] = contractId.split(".");
    if (!principal || !name) {
      return new Response(
        JSON.stringify({ error: "Invalid contract ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute source hash
    const sourceHash = await computeSourceHash(sourceCode);

    // Extract additional metadata from tx
    const clarityVersion = txData.smart_contract?.clarity_version 
      ? `clarity ${txData.smart_contract.clarity_version}` 
      : null;
    const deployedAt = txData.burn_block_time_iso || null;

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if contract already exists
    const { data: existing } = await supabase
      .from("contracts")
      .select("id")
      .eq("principal", principal)
      .eq("name", name)
      .eq("tx_id", txId)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Contract already indexed", contractId }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert contract
    const { data: contract, error: insertError } = await supabase
      .from("contracts")
      .insert({
        principal,
        name,
        source_code: sourceCode,
        source_hash: sourceHash,
        tx_id: txId,
        clarity_version: clarityVersion,
        description: description || null,
        category: category || null,
        deployed_at: deployedAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Failed to insert contract: ${insertError.message}`);
    }

    console.log(`Successfully added contract ${contractId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contract,
        message: `Contract ${contractId} added successfully`
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error adding contract:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
