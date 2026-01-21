-- Add missing columns to atproto_oauth_state table for BFF flow
ALTER TABLE public.atproto_oauth_state 
ADD COLUMN IF NOT EXISTS dpop_private_key_jwk TEXT,
ADD COLUMN IF NOT EXISTS dpop_public_key_jwk TEXT,
ADD COLUMN IF NOT EXISTS did TEXT,
ADD COLUMN IF NOT EXISTS pds_url TEXT;