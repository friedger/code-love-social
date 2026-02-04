import { useQuery } from "@tanstack/react-query";
import { searchComments, CommentsWithProfiles } from "@/lib/comments-api";

export const searchCommentKeys = {
  all: ["searchComments"] as const,
  search: (query: string) => [...searchCommentKeys.all, query] as const,
};

export function useSearchComments(searchQuery: string) {
  return useQuery({
    queryKey: searchCommentKeys.search(searchQuery),
    queryFn: () => searchComments(searchQuery, 20),
    enabled: searchQuery.length > 0,
  });
}
