import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCommentsByAuthor, ProfileData } from "@/lib/comments-api";
import { identityService } from "@/lib/identity-service";
import { useAtprotoAuth } from "@/hooks/useAtprotoAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, FileCode, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { FollowingAvatars } from "@/components/FollowingAvatars";
import { FollowButton } from "@/components/FollowButton";
import { PageHeader } from "@/components/PageHeader";
import { getContractPath } from "@/lib/utils";

const ProfilePage = () => {
  const { did: identifier } = useParams<{ did: string }>();
  const { user } = useAtprotoAuth();

  // Determine if we need to resolve the identifier
  const isHandle = identifier ? identityService.isHandle(identifier) : false;

  // Resolve handle to DID if needed
  const { data: resolvedDid, isLoading: isResolvingHandle } = useQuery({
    queryKey: ["resolve-handle", identifier],
    queryFn: () => identityService.resolveHandle(identifier!),
    enabled: !!identifier && isHandle,
    staleTime: 10 * 60 * 1000,
  });

  // The actual DID to use for fetching comments
  const did = isHandle ? resolvedDid : identifier;

  // Fetch comments by author
  const { data, isLoading: isLoadingComments, error } = useQuery({
    queryKey: ["profile-comments", did],
    queryFn: () => getCommentsByAuthor(did!),
    enabled: !!did,
  });

  // Fetch full profile from Bluesky
  const { data: bskyProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["bsky-profile", did],
    queryFn: () => identityService.getProfile(did!),
    enabled: !!did,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isResolvingHandle || isLoadingComments || isLoadingProfile;
  const profile: ProfileData | undefined = did ? data?.profiles[did] : undefined;
  const comments = data?.comments || [];
  const displayProfile = bskyProfile || profile;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </Button>

        {/* Profile header */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-4 sm:p-6">
            {isLoading && !displayProfile ? (
              <div className="flex items-center gap-3 sm:gap-4">
                <Skeleton className="h-12 w-12 sm:h-16 sm:w-16 rounded-full" />
                <div>
                  <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 mb-2" />
                  <Skeleton className="h-4 w-24 sm:w-32" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  <Avatar className="h-12 w-12 sm:h-16 sm:w-16 shrink-0">
                    <AvatarImage
                      src={displayProfile?.avatar}
                      alt={displayProfile?.displayName || displayProfile?.handle}
                    />
                    <AvatarFallback className="text-base sm:text-lg">
                      {(displayProfile?.displayName || displayProfile?.handle || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                          {displayProfile?.displayName || displayProfile?.handle || "Unknown User"}
                        </h2>
                        <p className="text-muted-foreground text-sm sm:text-base break-all">
                          @{displayProfile?.handle || did?.slice(0, 20)}
                        </p>
                      </div>
                      {did && <FollowButton targetDid={did} currentUserDid={user?.did} />}
                    </div>
                    <a
                      href={`https://bsky.app/profile/${displayProfile?.handle || did}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-2"
                    >
                      View on Bluesky <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Following section - prioritized by activity */}
                {did && <FollowingAvatars actor={did} limit={30} />}
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

          {isLoadingComments ? (
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
                        to={`/contract/${getContractPath(comment.subject.principal, comment.subject.contractName)}`}
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
