# Hiro Chainhooks Integration

This document explains how Source of Clarity ingests Clarity smart-contract
deployments from the Stacks blockchain (mainnet and testnet) using
[Hiro Chainhooks v2](https://docs.hiro.so/tools/chainhooks). Whenever a new
contract is deployed on-chain, Hiro POSTs the event to our backend, the
contract is upserted into the `contracts` table, and reviewers can immediately
open it and start commenting.

---

## High-level flow

```
   ┌────────────────────────┐
   │  Stacks node           │
   │  (mainnet / testnet)   │
   └───────────┬────────────┘
               │  contract_deploy event
               ▼
   ┌────────────────────────┐
   │  Hiro Chainhook v2     │  predicates registered via
   │  (predicate)           │  the Hiro Platform API
   └───────────┬────────────┘
               │  HTTP POST  (Bearer CHAINHOOK_AUTH_TOKEN)
               ▼
   ┌──────────────────────────────────────────────┐
   │  Edge function: chainhook-contracts          │
   │  supabase/functions/chainhook-contracts      │
   │  - verifies bearer token                     │
   │  - rate-limits by IP                         │
   │  - applies new deploys → upsert contracts    │
   │  - rolls back reorged deploys → delete       │
   └───────────────────┬──────────────────────────┘
                       │
                       ▼
              ┌────────────────────┐
              │ contracts table    │
              │ (RLS: public read) │
              └────────────────────┘
```

Once a row lands in `contracts`, the contract becomes browsable, searchable,
and commentable across the app — no manual indexing step needed.

---

## Predicates

Two predicates are maintained in this repo, one per network. They share the
same shape: subscribe to all `contract_deploy` events and POST them to the
edge function.

| File | Network | Webhook target |
| --- | --- | --- |
| [`docs/chainhooks-mainnet.json`](./chainhooks-mainnet.json) | `mainnet` | `…/functions/v1/chainhook-contracts` |
| [`docs/chainhooks-testnet.json`](./chainhooks-testnet.json) | `testnet` | `…/functions/v1/chainhook-contracts` |

The combined registration payload also lives in `docs/chainhooks.json` for
convenience when registering both at once.

---

## The edge function

Source: [`supabase/functions/chainhook-contracts/index.ts`](../supabase/functions/chainhook-contracts/index.ts)

Configured in [`supabase/config.toml`](../supabase/config.toml) with
`verify_jwt = false` because Chainhooks authenticate with their own bearer
token rather than a Supabase JWT.

### Request handling

1. **CORS preflight** — short-circuits `OPTIONS` requests.
2. **Rate limiting** — `checkRateLimit(getClientIP(req), RATE_LIMITS.chainhook)`
   throttles any single IP that goes wild before any auth work.
3. **Bearer auth** — the function compares the `Authorization` header against
   the `CHAINHOOK_AUTH_TOKEN` secret. Any mismatch returns 401. This is the
   only thing that prevents random callers from injecting fake deployments,
   so the token must be kept secret and rotated if leaked.
4. **Method check** — only `POST` is accepted.

### Payload model

Hiro sends a single JSON body shaped like:

```jsonc
{
  "chainhook": { "uuid": "…", "predicate": { … } },
  "event": {
    "apply":    [ { "block_identifier": …, "timestamp": 1700000000, "transactions": [ … ] } ],
    "rollback": [ { … } ]
  }
}
```

- **`apply`** blocks contain newly mined transactions to add.
- **`rollback`** blocks contain transactions that were dropped by a chain
  reorganization and must be removed from our view of state.

We iterate transactions and only act on those with
`metadata.kind === "ContractDeployment"`.

### Rollbacks first, then applies

Rollbacks are processed **before** applies in the same batch so a reorg that
drops a transaction and re-includes it under a new tx hash can't accidentally
delete the freshly applied row. For each rolled-back deployment we
`DELETE FROM contracts WHERE principal = … AND name = … AND tx_id = …` — the
`tx_id` filter ensures we never touch a different deployment of the same
`principal.name` pair.

### Apply: upsert with source hash

For each applied deployment we:

1. Split `metadata.contract_identifier` (e.g. `SP123…ABC.my-token`) into
   `principal` and `name`.
2. Compute a **SHA-512/256 hash of the source code** (`computeSourceHash`).
   This is the hash that powers the contract identicons and the
   "related contracts" feature — different deployments of byte-identical
   source share an identicon.
3. Upsert into `contracts`:

   ```ts
   await supabase.from("contracts").upsert({
     principal,
     name,
     source_code,
     source_hash,
     tx_id,
     deployed_at: new Date(block.timestamp * 1000).toISOString(),
     updated_at: new Date().toISOString(),
   }, { onConflict: "principal,name,tx_id" });
   ```

   The composite `principal,name,tx_id` conflict target means each
   on-chain deployment is a distinct row. Re-deploys under the same
   `principal.name` (a different `tx_id`) are kept side-by-side rather than
   silently overwriting each other.

### Response

The function returns a JSON summary so logs and Hiro's delivery view stay
useful when something is off:

```json
{
  "applied": 3,
  "rolledBack": 0,
  "errors": [],
  "chainhookUuid": "…"
}
```

Per-row failures are logged and pushed into `errors` instead of failing the
whole batch — losing one row to a transient DB error is preferable to
NACKing the entire delivery and replaying every contract in it.

---

## Setup

Detailed registration steps (creating the predicate, rotating the consumer
secret to obtain `CHAINHOOK_AUTH_TOKEN`, verifying delivery) live in
[`docs/CHAINHOOK_SETUP.md`](./CHAINHOOK_SETUP.md).

The short version:

1. Get a Hiro API key from <https://platform.hiro.so>.
2. `POST` each predicate JSON to `https://api.hiro.so/chainhooks/v1/me/`.
3. Rotate the consumer secret; store the returned token as
   `CHAINHOOK_AUTH_TOKEN` in the project secrets.
4. Watch the `chainhook-contracts` edge function logs for `applied: N`
   entries to confirm contracts are flowing in.

---

## Operational notes

- **Authentication** is purely a shared bearer token (`CHAINHOOK_AUTH_TOKEN`).
  If you suspect it is compromised, call the Hiro
  `rotate_consumer_secret` endpoint and update the secret in Lovable Cloud —
  no code change is required.
- **Rate limiting** uses the shared in-memory limiter from
  `supabase/functions/_shared/rate-limiter.ts` (`RATE_LIMITS.chainhook`).
  Hiro normally talks to us from a small set of IPs, so the limit is sized
  to protect against accidental loops or replay storms rather than to throttle
  legitimate traffic.
- **Reorg safety** is provided by always processing `rollback` blocks before
  `apply` blocks and by keying writes/deletes on `(principal, name, tx_id)`.
- **Manual submissions** (`supabase/functions/add-contract`) and the
  Chainhook ingestor write to the same `contracts` table with the same
  upsert semantics, so a contract that was added manually before its
  Chainhook event arrived will simply be confirmed by the on-chain event.
- **Comments** live in `comments_index` and reference `(principal, name)`,
  so as soon as the Chainhook upsert lands, every existing UI surface
  (contract page, comment threads, search) can resolve the new contract.

---

## References

- Hiro Chainhooks docs: <https://docs.hiro.so/tools/chainhooks>
- Migration to v2: <https://docs.hiro.so/en/tools/chainhooks/migration>
- Filter reference: <https://docs.hiro.so/tools/chainhooks/reference/filters>
- Edge function source: [`supabase/functions/chainhook-contracts/index.ts`](../supabase/functions/chainhook-contracts/index.ts)
- Predicates: [`docs/chainhooks-mainnet.json`](./chainhooks-mainnet.json), [`docs/chainhooks-testnet.json`](./chainhooks-testnet.json)
