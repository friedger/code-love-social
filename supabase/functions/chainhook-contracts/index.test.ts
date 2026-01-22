import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/chainhook-contracts`;

/**
 * Hiro Chainhook Payload Structure (from docs.hiro.so)
 * 
 * Root structure:
 * - event: { apply: Block[], rollback: Block[], chain, network }
 * - chainhook: { name, uuid }
 * 
 * Block structure:
 * - block_identifier: { index, hash }
 * - parent_block_identifier: { index, hash }
 * - timestamp: Unix seconds
 * - transactions: Transaction[]
 * 
 * ContractDeployment Transaction:
 * - transaction_identifier: { hash }  <- This is the tx_id
 * - metadata: {
 *     kind: "ContractDeployment",
 *     contract_identifier: "PRINCIPAL.name",
 *     source_code: "...",
 *     sender: "...",
 *     status: "success"
 *   }
 */

const SAMPLE_APPLY_PAYLOAD = {
  event: {
    apply: [{
      block_identifier: { index: 150000, hash: "0xblock123abc" },
      parent_block_identifier: { index: 149999, hash: "0xblock122abc" },
      timestamp: 1705920000,
      transactions: [{
        transaction_identifier: { 
          hash: "0xtx123abc456def789ghi"  // This becomes tx_id
        },
        metadata: {
          kind: "ContractDeployment",
          contract_identifier: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.chainhook-test-contract",
          source_code: `;; Test Contract for Chainhook
(define-public (hello) (ok "world"))
(define-read-only (get-value) u42)
`,
          sender: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9",
          status: "success",
        },
      }],
    }],
    rollback: [],
    chain: "stacks",
    network: "mainnet",
  },
  chainhook: {
    name: "contract-deployment-indexer",
    uuid: "be4ab3ed-b606-4fe0-97c4-6c0b1ac9b185",
  },
};

const SAMPLE_ROLLBACK_PAYLOAD = {
  event: {
    apply: [],
    rollback: [{
      block_identifier: { index: 150000, hash: "0xblock123abc" },
      timestamp: 1705920000,
      transactions: [{
        transaction_identifier: { 
          hash: "0xtx123abc456def789ghi"  // Must match the tx_id to delete
        },
        metadata: {
          kind: "ContractDeployment",
          contract_identifier: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.chainhook-test-contract",
          source_code: "(define-public (hello) (ok \"world\"))",
          sender: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9",
        },
      }],
    }],
    chain: "stacks",
    network: "mainnet",
  },
  chainhook: {
    name: "contract-deployment-indexer",
    uuid: "be4ab3ed-b606-4fe0-97c4-6c0b1ac9b185",
  },
};

// Test: Reject requests without auth token
Deno.test("rejects requests without auth token", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(SAMPLE_APPLY_PAYLOAD),
  });
  assertEquals(response.status, 401);
  const result = await response.json();
  assertEquals(result.error, "Unauthorized");
});

// Test: Reject requests with invalid auth token
Deno.test("rejects requests with invalid auth token", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify(SAMPLE_APPLY_PAYLOAD),
  });
  assertEquals(response.status, 401);
  await response.text();
});

// Test: Process contract with tx_id (requires CHAINHOOK_AUTH_TOKEN)
Deno.test({
  name: "processes contract deployment with tx_id from transaction_identifier.hash",
  ignore: !Deno.env.get("CHAINHOOK_AUTH_TOKEN"),
  async fn() {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("CHAINHOOK_AUTH_TOKEN")}`,
      },
      body: JSON.stringify(SAMPLE_APPLY_PAYLOAD),
    });
    assertEquals(response.status, 200);
    const result = await response.json();
    assertEquals(result.applied, 1);
    assertEquals(result.errors.length, 0);
    assertExists(result.chainhookUuid);
  },
});

// Test: Rollback deletes contract by tx_id (requires CHAINHOOK_AUTH_TOKEN)
Deno.test({
  name: "rollback deletes contract by specific tx_id",
  ignore: !Deno.env.get("CHAINHOOK_AUTH_TOKEN"),
  async fn() {
    // First apply the contract
    const applyResponse = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("CHAINHOOK_AUTH_TOKEN")}`,
      },
      body: JSON.stringify(SAMPLE_APPLY_PAYLOAD),
    });
    assertEquals(applyResponse.status, 200);
    await applyResponse.text();

    // Then rollback - must delete by matching tx_id
    const rollbackResponse = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("CHAINHOOK_AUTH_TOKEN")}`,
      },
      body: JSON.stringify(SAMPLE_ROLLBACK_PAYLOAD),
    });
    assertEquals(rollbackResponse.status, 200);
    const result = await rollbackResponse.json();
    assertExists(result.rolledBack);
    assertEquals(result.errors.length, 0);
  },
});

// Test: Handles empty payload gracefully
Deno.test({
  name: "handles empty event payload gracefully",
  ignore: !Deno.env.get("CHAINHOOK_AUTH_TOKEN"),
  async fn() {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("CHAINHOOK_AUTH_TOKEN")}`,
      },
      body: JSON.stringify({ event: { apply: [], rollback: [] } }),
    });
    assertEquals(response.status, 200);
    const result = await response.json();
    assertEquals(result.applied, 0);
    assertEquals(result.rolledBack, 0);
  },
});
