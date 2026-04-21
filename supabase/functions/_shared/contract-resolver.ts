// Resolve a Stacks deploy transaction id to (principal, contractName).
// Three-layer lookup: local `contracts` table first (fast, covers everything
// already ingested), then Hiro API as a fallback for unknown txs. If Hiro
// resolves, the contract is written back to the local table so the next
// lookup is a cache hit.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const HIRO_API_KEY = Deno.env.get("HIRO_API_KEY");
const HIRO_MAINNET = "https://api.hiro.so";
const HIRO_TESTNET = "https://api.testnet.hiro.so";

export interface ResolvedContract {
  principal: string;
  contractName: string;
  sourceCode?: string;
}

/** Resolve a tx id → (principal, contractName). Returns null if neither the
 *  local index nor Hiro knows it. */
export async function resolveContractByTxId(
  supabase: SupabaseClient,
  txId: string,
): Promise<ResolvedContract | null> {
  const { data: local } = await supabase
    .from("contracts")
    .select("principal, name")
    .eq("tx_id", txId)
    .maybeSingle();

  if (local) {
    return { principal: local.principal, contractName: local.name };
  }

  const hiro = await fetchHiroContract(txId);
  if (!hiro) return null;

  // Cache in the local table for future lookups. On conflict, leave the
  // existing row alone — another process may have inserted it concurrently.
  await supabase.from("contracts").upsert(
    {
      principal: hiro.principal,
      name: hiro.contractName,
      tx_id: txId,
      source_code: hiro.sourceCode ?? "",
    },
    { onConflict: "tx_id", ignoreDuplicates: true },
  );

  return hiro;
}

async function fetchHiroContract(txId: string): Promise<ResolvedContract | null> {
  // Try mainnet first (vast majority of deploys), fall back to testnet.
  for (const base of [HIRO_MAINNET, HIRO_TESTNET]) {
    const data = await fetchTx(base, txId);
    if (!data) continue;
    if (data.tx_type !== "smart_contract") return null;
    const contractId = data.smart_contract?.contract_id as string | undefined;
    const sourceCode = data.smart_contract?.source_code as string | undefined;
    if (!contractId) return null;
    const dot = contractId.lastIndexOf(".");
    if (dot <= 0) return null;
    return {
      principal: contractId.slice(0, dot),
      contractName: contractId.slice(dot + 1),
      sourceCode,
    };
  }
  return null;
}

async function fetchTx(base: string, txId: string): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (HIRO_API_KEY) headers["x-api-key"] = HIRO_API_KEY;
  try {
    const response = await fetch(`${base}/extended/v1/tx/${txId}`, { headers });
    if (response.status === 404) return null;
    if (!response.ok) {
      console.warn(`Hiro tx lookup failed on ${base}: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.warn(`Hiro tx lookup threw on ${base}:`, err);
    return null;
  }
}
