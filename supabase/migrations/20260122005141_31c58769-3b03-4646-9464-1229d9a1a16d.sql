-- Enable RLS on atproto_sessions (if not already enabled)
ALTER TABLE public.atproto_sessions ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access - edge functions use service role and bypass RLS
CREATE POLICY "No direct client access to sessions"
ON public.atproto_sessions
FOR ALL
USING (false);

-- Also secure the oauth_state table which contains sensitive PKCE and DPoP keys
ALTER TABLE public.atproto_oauth_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to oauth state"
ON public.atproto_oauth_state
FOR ALL
USING (false);