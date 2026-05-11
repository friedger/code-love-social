CREATE TABLE IF NOT EXISTS public.nostr_profiles (
  pubkey TEXT PRIMARY KEY,
  name TEXT,
  display_name TEXT,
  picture TEXT,
  nip05 TEXT,
  about TEXT,
  event_created_at BIGINT NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nostr_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nostr profiles are publicly readable"
  ON public.nostr_profiles
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS nostr_profiles_nip05_idx ON public.nostr_profiles (nip05);
