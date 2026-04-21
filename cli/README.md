# socli

Admin CLI for Source of Clarity. Wraps the four edge functions used to
operate the ingest pipeline.

## Build

Stdlib only — no external Go modules.

```sh
cd cli
go build -o socli .
# or install into $GOBIN:
go install .
```

## First-time setup

1. Sign into the web app as an admin user (one of the DIDs in the
   `ADMIN_DIDS` secret on the Supabase project).
2. Open browser devtools → Application → Local Storage → copy the value
   of `atproto_session_token`.
3. Paste it into the CLI:

   ```sh
   socli login
   # or non-interactively:
   socli login --token <value>
   ```

   The token is stored at `~/.config/socli/config.json` (chmod 600).

4. Optional: export `SOCLI_SERVICE_ROLE_KEY` to trigger ingestors manually.
   The key lives in the Supabase dashboard → Settings → API. Add it to
   your shell rc, not the config file.

## Commands

```
socli whoami                                         # show current config
socli whitelist list                                 # admin session required
socli whitelist add    atproto did:plc:...
socli whitelist add    nostr   <64-char-hex> --note "core team"
socli whitelist remove nostr   <64-char-hex>

socli ingest nostr                                   # service_role key required
socli ingest atproto
```

Ingest responses include `eventsSeen`, `eventsIndexed`, `nextCursor`,
and any per-event errors. Empty whitelist returns a short "nothing to
ingest" note.

## Environment variables

| Variable                  | Purpose                                         |
|---------------------------|-------------------------------------------------|
| `SOCLI_SUPABASE_URL`      | Override the saved Supabase URL.                |
| `SOCLI_SESSION_TOKEN`     | Override the saved atproto session token.       |
| `SOCLI_SERVICE_ROLE_KEY`  | service_role JWT for ingest-\* triggers.        |

## Examples

```sh
# Onboard a new Bluesky admin user to the whitelist
socli whitelist add atproto did:plc:abcd1234567890 --note "reviewer"

# Trigger the Nostr ingestor now (doesn't wait for the 5-min cron)
SOCLI_SERVICE_ROLE_KEY=$(pass supabase/service_role) socli ingest nostr

# See who's on the list
socli whitelist list
```
