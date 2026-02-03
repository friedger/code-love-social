import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Contract } from "@/types/contract";

export function useRelatedContracts(sourceHash: string | null, currentContractId?: string) {
  return useQuery({
    queryKey: ["contracts", "related", sourceHash],
    queryFn: async () => {
      if (!sourceHash) return [];
      
      let query = supabase
        .from("contracts")
        .select("id, principal, name, source_hash, description, category")
        .eq("source_hash", sourceHash)
        .order("name");

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter out the current contract
      return (data as Pick<Contract, "id" | "principal" | "name" | "source_hash" | "description" | "category">[])
        .filter(c => c.id !== currentContractId);
    },
    enabled: !!sourceHash,
  });
}
