-- Add tx_id column to comments_index to bind comments to specific contract deployments
ALTER TABLE public.comments_index 
ADD COLUMN tx_id text;

-- Create index for efficient querying by tx_id
CREATE INDEX idx_comments_index_tx_id ON public.comments_index(tx_id);

-- Add unique constraint on contracts including tx_id
-- This allows multiple deployments with same principal.name but different tx_ids
ALTER TABLE public.contracts 
ADD CONSTRAINT contracts_principal_name_txid_unique 
UNIQUE (principal, name, tx_id);