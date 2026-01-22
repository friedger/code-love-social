-- Create contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal text NOT NULL,
  name text NOT NULL,
  source_hash text,
  source_code text NOT NULL,
  tx_id text,
  clarity_version text,
  description text,
  category text,
  deployed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(principal, name)
);

-- Enable RLS with public read access
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contracts are publicly readable" 
  ON public.contracts FOR SELECT USING (true);

-- Search index for full-text search
CREATE INDEX idx_contracts_search ON public.contracts 
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(category, '')));

-- Index for principal/name lookup
CREATE INDEX idx_contracts_principal_name ON public.contracts (principal, name);