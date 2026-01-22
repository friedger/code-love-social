import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Contract } from "@/types/contract";

export const contractKeys = {
  all: ["contracts"] as const,
  list: (search?: string) => [...contractKeys.all, "list", search] as const,
  detail: (principal: string, name: string) => [...contractKeys.all, "detail", principal, name] as const,
};

export function useContracts(searchQuery?: string) {
  return useQuery({
    queryKey: contractKeys.list(searchQuery),
    queryFn: async () => {
      let query = supabase
        .from("contracts")
        .select("*")
        .order("name");

      if (searchQuery) {
        query = query.or(
          `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contract[];
    },
  });
}

export function useContract(principal: string, name: string) {
  return useQuery({
    queryKey: contractKeys.detail(principal, name),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("principal", principal)
        .eq("name", name)
        .maybeSingle();

      if (error) throw error;
      return data as Contract | null;
    },
    enabled: !!principal && !!name,
  });
}
