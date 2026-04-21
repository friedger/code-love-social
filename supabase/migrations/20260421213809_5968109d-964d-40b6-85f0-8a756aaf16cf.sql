ALTER TABLE public.comments_index
  ADD COLUMN IF NOT EXISTS author_type text NOT NULL DEFAULT 'atproto';

ALTER TABLE public.likes_index
  ADD COLUMN IF NOT EXISTS author_type text NOT NULL DEFAULT 'atproto';

CREATE INDEX IF NOT EXISTS comments_index_author_type_idx
  ON public.comments_index (author_type);

CREATE INDEX IF NOT EXISTS likes_index_author_type_idx
  ON public.likes_index (author_type);