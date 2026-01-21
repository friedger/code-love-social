-- Add auth_server_url column to track the authorization server separately from PDS
ALTER TABLE public.atproto_oauth_state 
ADD COLUMN IF NOT EXISTS auth_server_url TEXT;

ALTER TABLE public.atproto_sessions
ADD COLUMN IF NOT EXISTS auth_server_url TEXT;