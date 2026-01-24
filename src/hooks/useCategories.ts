import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("category")
        .not("category", "is", null);
      
      if (error) throw error;
      
      // Get unique categories and normalize
      const categories = new Set<string>();
      data.forEach((row) => {
        if (row.category) {
          categories.add(row.category);
        }
      });
      
      return Array.from(categories).sort();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
