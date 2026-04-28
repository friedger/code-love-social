import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getComments,
  createComment,
  likeComment,
  unlikeComment,
  deleteComment,
  CreateCommentParams,
  CommentsWithProfiles,
  ProfileData,
} from "@/lib/comments-api";
import type { ContractRef, Comment } from "@/lexicon/types";

/**
 * Query key factory for comments
 */
export const commentKeys = {
  all: ["comments"] as const,
  contract: (principal: string, contractName: string) =>
    [...commentKeys.all, principal, contractName] as const,
  line: (principal: string, contractName: string, lineNumber: number) =>
    [...commentKeys.contract(principal, contractName), lineNumber] as const,
};

/**
 * Hook to fetch comments for a contract
 * Returns both comments and profiles
 *
 * Nostr author profiles are resolved asynchronously on the server: the first
 * response may omit them while the kind-0 cache is being populated from
 * relays. When that happens we poll briefly so the names + avatars fill in
 * without the user reloading.
 */
export function useComments(contractRef: ContractRef, options?: { lineNumber?: number }) {
  return useQuery({
    queryKey: options?.lineNumber
      ? commentKeys.line(contractRef.principal, contractRef.contractName, options.lineNumber)
      : commentKeys.contract(contractRef.principal, contractRef.contractName),
    queryFn: () =>
      getComments(contractRef.principal, contractRef.contractName, {
        ...options,
        txId: contractRef.txId,
      }),
    select: (data: CommentsWithProfiles) => data,
    refetchInterval: (query) => {
      const data = query.state.data as CommentsWithProfiles | undefined;
      if (!data) return false;
      const hasUnresolvedNostr = data.comments.some(
        (c) => c.authorType === "nostr" && !data.profiles[c.authorDid],
      );
      return hasUnresolvedNostr ? 3000 : false;
    },
  });
}

/**
 * Hook to fetch comments for a specific line
 */
export function useLineComments(contractRef: ContractRef, lineNumber: number) {
  return useComments(contractRef, { lineNumber });
}

// Re-export ProfileData for component usage
export type { ProfileData };

/**
 * Hook to create a new comment
 */
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createComment,
    onSuccess: (data) => {
      // Invalidate all comments for this contract
      queryClient.invalidateQueries({
        queryKey: commentKeys.contract(
          data.subject.principal,
          data.subject.contractName
        ),
      });
    },
  });
}

/**
 * Hook to like a comment
 */
export function useLikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uri, cid }: { uri: string; cid: string }) =>
      likeComment(uri, cid),
    onSuccess: () => {
      // Invalidate all comments to refresh like counts
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
    },
  });
}

/**
 * Hook to unlike a comment
 */
export function useUnlikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (likeUri: string) => unlikeComment(likeUri),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
    },
  });
}

/**
 * Hook to delete a comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
    },
  });
}

/**
 * Helper to get replies from a list of comments
 */
export function getRepliesFromComments(comments: Comment[], parentRkey: string): Comment[] {
  return comments.filter((c) => c.parentId === parentRkey);
}

/**
 * Helper to get root comments (no parent)
 */
export function getRootComments(comments: Comment[]): Comment[] {
  return comments.filter((c) => !c.parentId);
}
