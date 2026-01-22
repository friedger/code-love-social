import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCommentsStream, searchComments } from "@/lib/comments-api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search, AlertTriangle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StreamCard } from "@/components/StreamCard";
import { ContractMatchCard } from "@/components/ContractMatchCard";

const StreamPage = () => {
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Normal stream (no search)
  const streamQuery = useQuery({
    queryKey: ["comments-stream"],
    queryFn: () => getCommentsStream(50),
    enabled: !debouncedSearch,
    refetchInterval: 30000,
  });

  // Search results (when searching)
  const searchQuery = useQuery({
    queryKey: ["search-comments", debouncedSearch],
    queryFn: () => searchComments(debouncedSearch),
    enabled: !!debouncedSearch,
  });

  // Extract unique contracts from search results (top 3)
  const matchedContracts = useMemo(() => {
    if (!searchQuery.data?.comments) return [];
    const seen = new Set<string>();
    const contracts: { principal: string; contractName: string; txId?: string }[] = [];

    for (const comment of searchQuery.data.comments) {
      const key = `${comment.subject.principal}.${comment.subject.contractName}`;
      if (!seen.has(key) && contracts.length < 3) {
        seen.add(key);
        contracts.push({
          principal: comment.subject.principal,
          contractName: comment.subject.contractName,
          txId: comment.subject.txId,
        });
      }
    }
    return contracts;
  }, [searchQuery.data?.comments]);

  const isSearching = !!debouncedSearch;
  const isLoading = isSearching ? searchQuery.isLoading : streamQuery.isLoading;
  const isFetching = isSearching ? searchQuery.isFetching : streamQuery.isFetching;
  const error = isSearching ? searchQuery.error : streamQuery.error;
  const comments = isSearching ? searchQuery.data?.comments : streamQuery.data?.comments;
  const profiles = isSearching ? searchQuery.data?.profiles : streamQuery.data?.profiles;

  return (
    <div className="min-h-screen bg-background">
      {/* Temporary Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
        <div className="container mx-auto flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>All comments are temporary and may require migration to a new namespace in the future.</span>
        </div>
      </div>

      <PageHeader />

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search comments and contracts..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="pl-10 pr-10"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Search results: Matched contracts */}
        {isSearching && matchedContracts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Matching Contracts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {matchedContracts.map((contract) => (
                <ContractMatchCard
                  key={`${contract.principal}.${contract.contractName}`}
                  principal={contract.principal}
                  contractName={contract.contractName}
                  txId={contract.txId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search result count (only when searching) */}
        {isSearching && (
          <p className="text-sm text-muted-foreground mb-4">
            {comments?.length || 0} results for "{debouncedSearch}"
          </p>
        )}

        {/* Comments stream/results */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <Skeleton className="h-3 w-20 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Failed to load {isSearching ? "search results" : "activity stream"}</p>
            </CardContent>
          </Card>
        ) : !comments || comments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>
                {isSearching
                  ? `No comments found matching "${debouncedSearch}"`
                  : "No comments yet. Be the first to discuss a contract!"}
              </p>
              {isSearching && (
                <Link
                  to="/contracts"
                  className="inline-block mt-3 text-sm text-primary hover:underline"
                >
                  Browse contracts →
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <StreamCard
                key={comment.uri}
                comment={comment}
                profile={profiles?.[comment.authorDid]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default StreamPage;
