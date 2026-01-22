import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getRelationship, followUser, unfollowUser } from "@/lib/social-api";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FollowButtonProps {
  targetDid: string;
  currentUserDid?: string | null;
}

export function FollowButton({ targetDid, currentUserDid }: FollowButtonProps) {
  const queryClient = useQueryClient();
  const [localFollowUri, setLocalFollowUri] = useState<string | null>(null);

  // Check relationship
  const { data: relationship, isLoading } = useQuery({
    queryKey: ["relationship", targetDid, currentUserDid],
    queryFn: () => getRelationship(targetDid),
    enabled: !!currentUserDid && targetDid !== currentUserDid,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: () => followUser(targetDid),
    onSuccess: (data) => {
      setLocalFollowUri(data.uri);
      queryClient.invalidateQueries({ queryKey: ["relationship", targetDid] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
      toast.success("Following!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to follow");
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: () => {
      const uri = localFollowUri || relationship?.followUri;
      if (!uri) throw new Error("No follow URI found");
      return unfollowUser(uri);
    },
    onSuccess: () => {
      setLocalFollowUri(null);
      queryClient.invalidateQueries({ queryKey: ["relationship", targetDid] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
      toast.success("Unfollowed");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to unfollow");
    },
  });

  // Don't show if not logged in or viewing own profile
  if (!currentUserDid || targetDid === currentUserDid) {
    return null;
  }

  const isFollowing = localFollowUri || relationship?.following;
  const isPending = followMutation.isPending || unfollowMutation.isPending;

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (isFollowing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => unfollowMutation.mutate()}
        disabled={isPending}
        className="gap-1.5"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserMinus className="h-4 w-4" />
        )}
        Unfollow
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={() => followMutation.mutate()}
      disabled={isPending}
      className="gap-1.5"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      Follow
    </Button>
  );
}

export default FollowButton;
