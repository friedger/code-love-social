-- Create comments_index table for efficient querying
CREATE TABLE public.comments_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uri TEXT NOT NULL UNIQUE,
  cid TEXT NOT NULL,
  author_did TEXT NOT NULL,
  principal TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  line_number INTEGER,
  line_range_start INTEGER,
  line_range_end INTEGER,
  parent_uri TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure line targeting is mutually exclusive
  CONSTRAINT valid_line_targeting CHECK (
    (line_number IS NULL) OR 
    (line_range_start IS NULL AND line_range_end IS NULL)
  )
);

-- Create indexes for efficient querying
CREATE INDEX idx_comments_contract ON public.comments_index(principal, contract_name);
CREATE INDEX idx_comments_line ON public.comments_index(principal, contract_name, line_number);
CREATE INDEX idx_comments_author ON public.comments_index(author_did);
CREATE INDEX idx_comments_parent ON public.comments_index(parent_uri);

-- Enable Row Level Security
ALTER TABLE public.comments_index ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments (public data)
CREATE POLICY "Comments are publicly readable"
  ON public.comments_index
  FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (via edge functions)
-- No user-level policies needed since all writes go through edge functions

-- Create likes_index table for tracking likes
CREATE TABLE public.likes_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uri TEXT NOT NULL UNIQUE,
  cid TEXT NOT NULL,
  author_did TEXT NOT NULL,
  subject_uri TEXT NOT NULL,
  subject_cid TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for likes
CREATE INDEX idx_likes_subject ON public.likes_index(subject_uri);
CREATE INDEX idx_likes_author ON public.likes_index(author_did);
CREATE INDEX idx_likes_author_subject ON public.likes_index(author_did, subject_uri);

-- Enable Row Level Security
ALTER TABLE public.likes_index ENABLE ROW LEVEL SECURITY;

-- Anyone can read likes (public data)
CREATE POLICY "Likes are publicly readable"
  ON public.likes_index
  FOR SELECT
  USING (true);