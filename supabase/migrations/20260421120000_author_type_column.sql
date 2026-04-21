-- Make comments_index and likes_index protocol-agnostic so a comment can come
-- from either an atproto PDS or a signed Nostr event and be queried uniformly.
--
-- The existing columns `uri` / `author_did` stay as the primary identifiers
-- (an atproto at:// URI, a Nostr hex event id, or a did:pubkey:<hex> for
-- Nostr authors). Two new columns annotate *which* protocol produced the
-- row so read-side profile lookups can fan out to the right service.
--
-- Existing rows are all atproto — backfill `author_type='atproto'` before
-- applying NOT NULL.

-- ============ comments_index ============

ALTER TABLE public.comments_index
  ADD COLUMN IF NOT EXISTS author_type TEXT;

UPDATE public.comments_index
   SET author_type = 'atproto'
 WHERE author_type IS NULL;

ALTER TABLE public.comments_index
  ALTER COLUMN author_type SET NOT NULL;

ALTER TABLE public.comments_index
  ADD CONSTRAINT comments_author_type_check
  CHECK (author_type IN ('atproto', 'nostr'));

CREATE INDEX IF NOT EXISTS idx_comments_author_type
  ON public.comments_index(author_type);

-- ============ likes_index ============

ALTER TABLE public.likes_index
  ADD COLUMN IF NOT EXISTS author_type TEXT;

UPDATE public.likes_index
   SET author_type = 'atproto'
 WHERE author_type IS NULL;

ALTER TABLE public.likes_index
  ALTER COLUMN author_type SET NOT NULL;

ALTER TABLE public.likes_index
  ADD CONSTRAINT likes_author_type_check
  CHECK (author_type IN ('atproto', 'nostr'));

CREATE INDEX IF NOT EXISTS idx_likes_author_type
  ON public.likes_index(author_type);
