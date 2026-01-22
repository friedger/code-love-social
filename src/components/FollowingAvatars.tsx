import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPrioritizedFollows, PrioritizedProfile } from "@/lib/social-api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users, Star } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FollowingAvatarsProps {
  actor: string;
  limit?: number;
}

export function FollowingAvatars({ actor, limit = 30 }: FollowingAvatarsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["prioritized-following", actor, limit],
    queryFn: () => getPrioritizedFollows(actor, limit),
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
        <span>Following ({follows.length})</span>
        <span className="text-xs opacity-75">• Sorted by activity</span>
      </div>
      <TooltipProvider delayDuration={300}>
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {follows.map((profile: PrioritizedProfile) => (
              <Tooltip key={profile.did}>
                <TooltipTrigger asChild>
                  <Link
                    to={`/profile/${profile.handle}`}
                    className="shrink-0 group relative"
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary transition-all">
                      <AvatarImage
                        src={profile.avatar}
                        alt={profile.displayName || profile.handle}
                      />
                      <AvatarFallback className="text-xs">
                        {(profile.displayName || profile.handle)[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {profile.priorityScore > 0 && (
                      <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Star className="h-2.5 w-2.5 fill-current" />
                      </div>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">
                    {profile.displayName || profile.handle}
                  </p>
                  <p className="text-muted-foreground">@{profile.handle}</p>
                  {profile.priorityScore > 0 && (
                    <p className="text-primary mt-1">
                      Activity score: {Math.round(profile.priorityScore)}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </TooltipProvider>
    </div>
  );
}

export default FollowingAvatars;
