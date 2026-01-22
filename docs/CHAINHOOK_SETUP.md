# Chainhook v2 Setup for Source of Clarity

## Overview

These Chainhook v2 predicates automatically sync all Clarity smart contract deployments from Stacks mainnet and testnet to the Source of Clarity database.

## Prerequisites

- Hiro API key from [platform.hiro.so](https://platform.hiro.so)
- `CHAINHOOK_AUTH_TOKEN` secret configured in your backend

## Register Chainhooks via API

The `docs/chainhooks.json` file contains both mainnet and testnet predicates. Register each one separately:

```bash
# Extract and register mainnet predicate
jq '.[0]' docs/chainhooks.json | curl -X POST https://api.hiro.so/chainhooks/v1/me/ \
  -H "x-api-key: YOUR_HIRO_API_KEY" \
  -H "content-type: application/json" \
  -d @-

# Extract and register testnet predicate
jq '.[1]' docs/chainhooks.json | curl -X POST https://api.hiro.so/chainhooks/v1/me/ \
  -H "x-api-key: YOUR_HIRO_API_KEY" \
  -H "content-type: application/json" \
  -d @-
```

## Configure Webhook Authentication

After registration, rotate the consumer secret to get the auth token:

```bash
curl -X POST https://api.hiro.so/chainhooks/v1/me/{uuid}/rotate_consumer_secret \
  -H "x-api-key: YOUR_HIRO_API_KEY"
```

Store the returned secret as `CHAINHOOK_AUTH_TOKEN` in your backend secrets.

## Verify Integration

Check the chainhook status:

```bash
curl https://api.hiro.so/chainhooks/v1/me/{uuid} \
  -H "x-api-key: YOUR_HIRO_API_KEY"
```

Monitor edge function logs to confirm events are being received.

## Reference

- [Chainhooks v2 Migration Guide](https://docs.hiro.so/en/tools/chainhooks/migration)
- [Filter Reference](https://docs.hiro.so/tools/chainhooks/reference/filters)
