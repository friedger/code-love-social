import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCommentsByAuthor, ProfileData } from "@/lib/comments-api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, FileCode, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { formatDistanceToNow } from "date-fns";

const ProfilePage = () => {
  const { did } = useParams<{ did: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["profile-comments", did],
    queryFn: () => getCommentsByAuthor(did!),
    enabled: !!did,
  });

  const profile: ProfileData | undefined = did ? data?.profiles[did] : undefined;
  const comments = data?.comments || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Source of Clarity" className="h-8 w-8" />
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg text-foreground">Source of Clarity</h1>
              <p className="text-xs text-muted-foreground">Discuss smart contracts on the Stacks blockchain.</p>
            </div>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Back button */}
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        {/* Profile header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div>
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.avatar} alt={profile?.displayName || profile?.handle} />
                  <AvatarFallback className="text-lg">
                    {(profile?.displayName || profile?.handle || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {profile?.displayName || profile?.handle || "Unknown User"}
                  </h2>
                  <p className="text-muted-foreground">
                    @{profile?.handle || did?.slice(0, 20)}
                  </p>
                  <a
                    href={`https://bsky.app/profile/${profile?.handle || did}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    View on Bluesky <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comments list */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground mb-4">
            <MessageSquare className="h-5 w-5" />
            Comments ({comments.length})
          </h3>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Failed to load comments
              </CardContent>
            </Card>
          ) : comments.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No comments yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.uri} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <p className="text-foreground mb-2">{comment.text}</p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <Link
                        to={`/contract/${comment.subject.principal}.${comment.subject.contractName}`}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <FileCode className="h-4 w-4" />
                        <span className="truncate max-w-[200px]">
                          {comment.subject.contractName}
                        </span>
                        {comment.lineNumber && (
                          <span className="text-xs">:L{comment.lineNumber}</span>
                        )}
                      </Link>
                      <span>
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
