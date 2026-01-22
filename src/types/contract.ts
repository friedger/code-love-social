export interface Contract {
  id: string;
  principal: string;
  name: string;
  source_hash: string | null;
  source_code: string;
  tx_id: string | null;
  clarity_version: string | null;
  description: string | null;
  category: string | null;
  deployed_at: string | null;
  created_at: string;
  updated_at: string;
}
