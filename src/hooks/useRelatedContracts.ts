import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Contract } from "@/types/contract";

export type RelatedContract = Pick<Contract, "id" | "principal" | "name" | "source_hash" | "description" | "category">;

interface UseRelatedContractsParams {
  sourceHash: string | null;
  currentPrincipal?: string;
  currentName?: string;
}

export function useRelatedContracts({ sourceHash, currentPrincipal, currentName }: UseRelatedContractsParams) {
  return useQuery({
    queryKey: ["contracts", "related", sourceHash],
    queryFn: async () => {
      if (!sourceHash) return [];
      
      const { data, error } = await supabase
        .from("contracts")
        .select("id, principal, name, source_hash, description, category")
        .eq("source_hash", sourceHash)
        .order("name");

      if (error) throw error;
      
      // Filter out the current contract by principal + name
      return (data as RelatedContract[]).filter(
        c => !(c.principal === currentPrincipal && c.name === currentName)
      );
    },
    enabled: !!sourceHash,
  });
}
