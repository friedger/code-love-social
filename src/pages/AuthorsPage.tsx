import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageSquare } from "lucide-react";
import { ProfileData } from "@/lib/comments-api";

interface AuthorWithCount {
  did: string;
  commentCount: number;
}

const COMMENTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comments`;

async function fetchAuthors(): Promise<{ authors: AuthorWithCount[]; profiles: Record<string, ProfileData> }> {
  // Get distinct authors with comment counts from the index
  const { data, error } = await supabase
    .from("comments_index")
    .select("author_did");

  if (error) throw error;

  // Aggregate counts client-side
  const countMap = new Map<string, number>();
  for (const row of data || []) {
    countMap.set(row.author_did, (countMap.get(row.author_did) || 0) + 1);
  }

  const authors: AuthorWithCount[] = Array.from(countMap.entries())
    .map(([did, commentCount]) => ({ did, commentCount }))
    .sort((a, b) => b.commentCount - a.commentCount);

  // Fetch profiles for all authors
  const dids = authors.map((a) => a.did);
  let profiles: Record<string, ProfileData> = {};

  if (dids.length > 0) {
    try {
      const res = await fetch(`${COMMENTS_URL}/profiles?dids=${dids.join(",")}`);
      if (res.ok) {
        profiles = await res.json();
      }
    } catch {
      // Profiles are optional, continue without them
    }
  }

  return { authors, profiles };
}

const AuthorsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["authors"],
    queryFn: fetchAuthors,
  });

  const authors = data?.authors || [];
  const profiles = data?.profiles || {};

  return (
    <PageLayout>
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Comment Authors</h1>
        <span className="text-sm text-muted-foreground">({authors.length})</span>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : authors.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comment authors found.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((author) => {
            const profile = profiles[author.did];
            const displayName = profile?.displayName || profile?.handle || author.did.slice(0, 20) + "…";
            const handle = profile?.handle || author.did;

            return (
              <Link key={author.did} to={`/profile/${author.did}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{handle}</p>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{author.commentCount}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};

export default AuthorsPage;
