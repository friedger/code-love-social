-- Drop the old unique constraint that only uses principal+name
-- This allows storing multiple deployments of the same contract (needed for rollback handling)
ALTER TABLE public.contracts 
DROP CONSTRAINT IF EXISTS contracts_principal_name_key;