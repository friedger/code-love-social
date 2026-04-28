-- Cache of Nostr kind-0 (set_metadata) events, keyed by lowercase hex pubkey.
-- The /comments GET handler reads from here to render Nostr authors with a
-- name + avatar; a background fetch refreshes stale or missing rows from
-- the default relay set.

CREATE TABLE public.nostr_profiles (
  pubkey            TEXT PRIMARY KEY,
  name              TEXT,
  display_name      TEXT,
  picture           TEXT,
  nip05             TEXT,
  about             TEXT,
  -- created_at of the source kind-0 event, so we keep the newest version
  event_created_at  BIGINT NOT NULL,
  -- when we last wrote this row, used for TTL on background refresh
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT nostr_profiles_pubkey_hex
    CHECK (pubkey ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_nostr_profiles_fetched_at ON public.nostr_profiles(fetched_at);

ALTER TABLE public.nostr_profiles ENABLE ROW LEVEL SECURITY;

-- Profiles are public Nostr metadata; anyone can read. Service role writes.
CREATE POLICY "Nostr profiles are publicly readable"
  ON public.nostr_profiles
  FOR SELECT
  USING (true);
