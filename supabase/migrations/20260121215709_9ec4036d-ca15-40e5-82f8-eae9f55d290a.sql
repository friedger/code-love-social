-- OAuth state for PKCE flow (temporary, expires after 10 minutes)
CREATE TABLE public.atproto_oauth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  code_verifier TEXT NOT NULL,
  return_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '10 minutes'
);

-- User sessions for AT Protocol authentication
CREATE TABLE public.atproto_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  did TEXT NOT NULL,
  handle TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  pds_url TEXT NOT NULL,
  dpop_private_key_jwk TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (only Edge Functions with service role can access)
ALTER TABLE public.atproto_oauth_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atproto_sessions ENABLE ROW LEVEL SECURITY;

-- No public access policies - only service role can access these tables
-- This keeps tokens secure

-- Index for cleanup of expired states
CREATE INDEX idx_atproto_oauth_state_expires_at ON public.atproto_oauth_state(expires_at);

-- Index for session lookups
CREATE INDEX idx_atproto_sessions_session_token ON public.atproto_sessions(session_token);
CREATE INDEX idx_atproto_sessions_did ON public.atproto_sessions(did);