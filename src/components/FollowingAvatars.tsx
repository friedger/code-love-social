import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { identityService, ProfileView } from "@/lib/identity-service";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";

interface FollowingAvatarsProps {
  actor: string;
  limit?: number;
}

export function FollowingAvatars({ actor, limit = 30 }: FollowingAvatarsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["following", actor, limit],
    queryFn: () => identityService.getFollowing(actor, limit),
    enabled: !!actor,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const follows = data?.follows || [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (error || follows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>Following ({follows.length}{data?.cursor ? "+" : ""})</span>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {follows.map((profile: ProfileView) => (
            <Link
              key={profile.did}
              to={`/profile/${profile.handle}`}
              className="shrink-0 group"
              title={profile.displayName || profile.handle}
            >
              <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary transition-all">
                <AvatarImage src={profile.avatar} alt={profile.displayName || profile.handle} />
                <AvatarFallback className="text-xs">
                  {(profile.displayName || profile.handle)[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export default FollowingAvatars;
