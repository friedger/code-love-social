import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addReaction, removeReaction } from "@/lib/comments-api";
import { commentKeys } from "./useComments";
import { toast } from "sonner";

interface ToggleReactionParams {
  uri: string;
  cid: string;
  emoji: string;
  currentUserReactionUri?: string;
  currentUserEmoji?: string;
}

export function useToggleCommentReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ToggleReactionParams) => {
      const { uri, cid, emoji, currentUserReactionUri, currentUserEmoji } = params;
      
      // If user already has this same emoji reaction, remove it
      if (currentUserReactionUri && currentUserEmoji === emoji) {
        await removeReaction(currentUserReactionUri);
        return { removed: true };
      }
      
      // If user has a different reaction, remove it first then add new
      if (currentUserReactionUri) {
        await removeReaction(currentUserReactionUri);
      }
      
      // Add the new reaction
      return addReaction(uri, cid, emoji);
    },
    onSuccess: () => {
      // Invalidate all comments to refresh reaction counts
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
    },
    onError: (error) => {
      console.error("Reaction error:", error);
      toast.error("Failed to update reaction");
    },
  });
}

export function useAddCommentReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uri, cid, emoji }: { uri: string; cid: string; emoji: string }) =>
      addReaction(uri, cid, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
    },
    onError: (error) => {
      console.error("Reaction error:", error);
      toast.error("Failed to add reaction");
    },
  });
}

export function useRemoveCommentReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reactionUri: string) => removeReaction(reactionUri),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
    },
    onError: (error) => {
      console.error("Remove reaction error:", error);
      toast.error("Failed to remove reaction");
    },
  });
}
