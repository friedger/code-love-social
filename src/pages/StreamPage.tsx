import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCommentsStream } from "@/lib/comments-api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, FileCode, ArrowLeft, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/PageHeader";

const StreamPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["comments-stream"],
    queryFn: () => getCommentsStream(50),
    refetchInterval: 30000,
  });

  const comments = data?.comments || [];
  const profiles = data?.profiles || {};

  return (
    <div className="min-h-screen bg-background">
      <PageHeader />

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        {/* Stream header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Rss className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Activity Stream</h2>
            <p className="text-sm text-muted-foreground">Latest comments across all contracts</p>
          </div>
        </div>

        {/* Comments stream */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Failed to load activity stream</p>
            </CardContent>
          </Card>
        ) : comments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No comments yet. Be the first to discuss a contract!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const profile = profiles[comment.authorDid];
              return (
                <Card key={comment.uri} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Link to={`/profile/${profile?.handle || comment.authorDid}`}>
                        <Avatar className="h-10 w-10 hover:ring-2 hover:ring-primary transition-all">
                          <AvatarImage src={profile?.avatar} alt={profile?.displayName || profile?.handle} />
                          <AvatarFallback>
                            {(profile?.displayName || profile?.handle || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            to={`/profile/${profile?.handle || comment.authorDid}`}
                            className="font-medium text-foreground hover:underline truncate"
                          >
                            {profile?.displayName || profile?.handle || "Unknown"}
                          </Link>
                          <span className="text-muted-foreground text-sm">
                            @{profile?.handle || comment.authorDid.slice(0, 15)}
                          </span>
                          <span className="text-muted-foreground text-sm">·</span>
                          <span className="text-muted-foreground text-sm whitespace-nowrap">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-foreground mb-2">{comment.text}</p>
                        <Link
                          to={`/contract/${comment.subject.principal}.${comment.subject.contractName}`}
                          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors bg-muted/50 px-2 py-1 rounded"
                        >
                          <FileCode className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[200px]">
                            {comment.subject.contractName}
                          </span>
                          {comment.lineNumber && (
                            <span className="text-xs opacity-75">:L{comment.lineNumber}</span>
                          )}
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default StreamPage;
