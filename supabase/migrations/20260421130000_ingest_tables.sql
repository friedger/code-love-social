-- Ingestion plumbing. Two small tables plus indexes so a scheduled edge
-- function can pull comments from Bluesky firehose / Nostr relays into
-- the same `comments_index` the UI writes to.
--
-- `ingest_state` is a key/value store for each ingestor's resume cursor.
-- `ingest_whitelist` gates what gets indexed from external sources: only
-- authors on the list have their externally-authored comments pulled in.
-- UI-path writes (the existing /comments and /comments/nostr POST
-- handlers) are unaffected — those already require a signed request from
-- the author themselves.

-- ============ ingest_state ============

CREATE TABLE public.ingest_state (
  source TEXT PRIMARY KEY,
  cursor TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ingest_state ENABLE ROW LEVEL SECURITY;
-- No policies: service role bypasses RLS; end-users never see these rows.

-- ============ ingest_whitelist ============

CREATE TABLE public.ingest_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'atproto' → identifier is a DID (e.g. did:plc:...)
  -- 'nostr'   → identifier is a 32-byte pubkey in lowercase hex
  author_type TEXT NOT NULL,
  identifier TEXT NOT NULL,
  added_by TEXT,                     -- admin DID that added the entry
  note TEXT,                         -- free-form, e.g. "core maintainer"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ingest_whitelist_author_type_check
    CHECK (author_type IN ('atproto', 'nostr')),
  CONSTRAINT ingest_whitelist_unique UNIQUE (author_type, identifier)
);

CREATE INDEX idx_ingest_whitelist_author_type ON public.ingest_whitelist(author_type);

ALTER TABLE public.ingest_whitelist ENABLE ROW LEVEL SECURITY;
-- Anyone can read the whitelist (useful so the UI can hint that an external
-- author is a trusted contributor). Only service role writes.
CREATE POLICY "Whitelist is publicly readable"
  ON public.ingest_whitelist
  FOR SELECT
  USING (true);
