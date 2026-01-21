import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getComments,
  createComment,
  likeComment,
  unlikeComment,
  deleteComment,
  CreateCommentParams,
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
 */
export function useComments(contractRef: ContractRef, options?: { lineNumber?: number }) {
  return useQuery({
    queryKey: options?.lineNumber
      ? commentKeys.line(contractRef.principal, contractRef.contractName, options.lineNumber)
      : commentKeys.contract(contractRef.principal, contractRef.contractName),
    queryFn: () =>
      getComments(contractRef.principal, contractRef.contractName, options),
  });
}

/**
 * Hook to fetch comments for a specific line
 */
export function useLineComments(contractRef: ContractRef, lineNumber: number) {
  return useComments(contractRef, { lineNumber });
}

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
