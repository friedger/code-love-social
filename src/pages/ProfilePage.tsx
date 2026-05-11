import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { nip19 } from "nostr-tools";
import { getCommentsByAuthor, ProfileData } from "@/lib/comments-api";
import { identityService } from "@/lib/identity-service";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileCode, ExternalLink, ArrowLeft, BadgeCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FollowingAvatars } from "@/components/FollowingAvatars";
import { FollowButton } from "@/components/FollowButton";
import { PageLayout } from "@/components/PageLayout";
import { getContractPath } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const NOSTR_DID_PREFIX = "did:pubkey:";

type ProtocolKind = "nostr" | "atproto";

function isNostrIdentifier(id: string | undefined): boolean {
  if (!id) return false;
  return id.startsWith(NOSTR_DID_PREFIX) || id.startsWith("npub1");
}

interface ResolvedProfile extends ProfileData {
  nip05?: string;
  about?: string;
  protocol: ProtocolKind;
}

const ProfilePage = () => {
  const { did: identifier } = useParams<{ did: string }>();
  const { user } = useAuth();

  const protocol: ProtocolKind = isNostrIdentifier(identifier) ? "nostr" : "atproto";

  // Normalize Nostr identifier (npub or did:pubkey:hex) into hex pubkey + canonical DID.
  let nostrPubkey: string | undefined;
  let nostrDid: string | undefined;
  if (protocol === "nostr" && identifier) {
    try {
      if (identifier.startsWith("npub1")) {
        const decoded = nip19.decode(identifier);
        if (decoded.type === "npub") nostrPubkey = decoded.data as string;
      } else if (identifier.startsWith(NOSTR_DID_PREFIX)) {
        nostrPubkey = identifier.slice(NOSTR_DID_PREFIX.length);
      }
    } catch {
      // invalid npub
    }
    if (nostrPubkey) nostrDid = `${NOSTR_DID_PREFIX}${nostrPubkey}`;
  }

  // ===== AT Protocol resolution =====
  const isHandle = identifier && protocol === "atproto"
    ? identityService.isHandle(identifier)
    : false;

  const { data: resolvedDid, isLoading: isResolvingHandle } = useQuery({
    queryKey: ["resolve-handle", identifier],
    queryFn: () => identityService.resolveHandle(identifier!),
    enabled: !!identifier && isHandle,
    staleTime: 10 * 60 * 1000,
  });

  const did = protocol === "nostr"
    ? nostrDid
    : (isHandle ? resolvedDid : identifier);

  // ===== Comments (works for both protocols) =====
  const { data, isLoading: isLoadingComments, error } = useQuery({
    queryKey: ["profile-comments", did],
    queryFn: () => getCommentsByAuthor(did!),
    enabled: !!did,
  });

  // ===== AT Proto profile =====
  const { data: bskyProfile, isLoading: isLoadingAtproto } = useQuery({
    queryKey: ["bsky-profile", did],
    queryFn: () => identityService.getProfile(did!),
    enabled: !!did && protocol === "atproto",
    staleTime: 5 * 60 * 1000,
  });

  // ===== Nostr profile =====
  // Calls the `nostr-profile` edge function, which checks the `nostr_profiles`
  // cache and, if missing/stale, drains kind-0 from default relays before
  // returning the freshest version.
  const { data: nostrProfile, isLoading: isLoadingNostr } = useQuery({
    queryKey: ["nostr-profile", nostrPubkey],
    queryFn: async (): Promise<ResolvedProfile | null> => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nostr-profile?pubkey=${nostrPubkey}`;
      const resp = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!resp.ok) return null;
      const json = await resp.json() as {
        profile: {
          pubkey: string;
          name: string | null;
          display_name: string | null;
          picture: string | null;
          nip05: string | null;
          about: string | null;
        } | null;
      };
      const row = json.profile;
      if (!row) return null;
      return {
        did: nostrDid!,
        handle: row.nip05 || row.name || nostrPubkey!.slice(0, 12),
        displayName: row.display_name || row.name || undefined,
        avatar: row.picture || undefined,
        nip05: row.nip05 || undefined,
        about: row.about || undefined,
        protocol: "nostr",
      };
    },
    enabled: !!nostrPubkey && protocol === "nostr",
    staleTime: 5 * 60 * 1000,
  });

  const isLoading =
    isResolvingHandle ||
    isLoadingComments ||
    (protocol === "atproto" ? isLoadingAtproto : isLoadingNostr);

  const commentProfile: ProfileData | undefined = did ? data?.profiles[did] : undefined;
  const comments = data?.comments || [];

  const displayProfile: ResolvedProfile | undefined = (() => {
    if (protocol === "nostr") {
      if (nostrProfile) return nostrProfile;
      if (commentProfile) return { ...commentProfile, protocol: "nostr" };
      return undefined;
    }
    const base = bskyProfile || commentProfile;
    return base ? { ...base, protocol: "atproto" } : undefined;
  })();

  return (
    <PageLayout maxWidth="narrow">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>
      </Button>

      {/* Profile header */}
      <Card className="mb-4 sm:mb-6 overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          {isLoading && !displayProfile ? (
            <ProfileSkeleton />
          ) : (
            <ProfileHeader
              profile={displayProfile}
              did={did}
              protocol={protocol}
              currentUserDid={user?.id}
            />
          )}
        </CardContent>
      </Card>

      {/* Comments list */}
      <CommentsList
        comments={comments}
        isLoading={isLoadingComments}
        error={error}
      />
    </PageLayout>
  );
};

function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <Skeleton className="h-12 w-12 sm:h-16 sm:w-16 rounded-full" />
      <div>
        <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 mb-2" />
        <Skeleton className="h-4 w-24 sm:w-32" />
      </div>
    </div>
  );
}

interface ProfileHeaderProps {
  profile?: ResolvedProfile;
  did?: string;
  protocol: ProtocolKind;
  currentUserDid?: string;
}

function ProfileHeader({ profile, did, protocol, currentUserDid }: ProfileHeaderProps) {
  const isNostr = protocol === "nostr";
  const hexPubkey = isNostr && did ? did.slice(NOSTR_DID_PREFIX.length) : undefined;
  const npub = hexPubkey ? nip19.npubEncode(hexPubkey) : undefined;

  const externalUrl = isNostr
    ? `https://njump.me/${npub || hexPubkey}`
    : `https://bsky.app/profile/${profile?.handle || did}`;
  const externalLabel = isNostr ? "View on njump" : "View on Bluesky";
  const ExternalIcon = isNostr ? Zap : ExternalLink;

  const fallbackHandle = isNostr
    ? (npub ? `${npub.slice(0, 12)}…${npub.slice(-4)}` : did)
    : did?.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <Avatar className="h-12 w-12 sm:h-16 sm:w-16 shrink-0">
          <AvatarImage
            src={profile?.avatar}
            alt={profile?.displayName || profile?.handle}
          />
          <AvatarFallback className="text-base sm:text-lg">
            {(profile?.displayName || profile?.handle || "?")[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {profile?.displayName || profile?.handle || "Unknown User"}
                </h2>
                <Badge
                  variant="secondary"
                  className="text-[10px] uppercase tracking-wide font-medium"
                >
                  {isNostr ? "Nostr" : "AT Protocol"}
                </Badge>
              </div>

              {isNostr && profile?.nip05 ? (
                <p className="text-muted-foreground text-sm sm:text-base break-all inline-flex items-center gap-1 mt-0.5">
                  <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                  @{profile.nip05}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm sm:text-base break-all mt-0.5">
                  @{profile?.handle || fallbackHandle}
                </p>
              )}

              {isNostr && npub && (
                <p className="text-xs text-muted-foreground/70 font-mono break-all mt-1">
                  {npub}
                </p>
              )}

              {profile?.about && (
                <p className="text-sm text-foreground/80 mt-3 whitespace-pre-line">
                  {profile.about}
                </p>
              )}
            </div>
            {did && !isNostr && (
              <FollowButton targetDid={did} currentUserDid={currentUserDid} />
            )}
          </div>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-3"
          >
            {externalLabel} <ExternalIcon className="h-3 w-3" />
          </a>
        </div>
      </div>

      {did && !isNostr && <FollowingAvatars actor={did} limit={30} />}
    </div>
  );
}

interface CommentsListProps {
  comments: Array<{
    uri: string;
    text: string;
    subject: { principal: string; contractName: string };
    lineNumber?: number;
    createdAt: string;
  }>;
  isLoading: boolean;
  error: unknown;
}

function CommentsList({ comments, isLoading, error }: CommentsListProps) {
  return (
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
                  <Link
                    to={`/contract/${getContractPath(comment.subject.principal, comment.subject.contractName)}${comment.lineNumber ? `?line=${comment.lineNumber}` : ""}`}
                    className="hover:text-primary transition-colors"
                  >
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
