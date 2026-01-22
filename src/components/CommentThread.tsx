import { useState } from "react";
import { useLineComments, useCreateComment, useLikeComment, getRepliesFromComments, getRootComments, ProfileData } from "@/hooks/useComments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Heart, MessageCircle, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Comment } from "@/lexicon/types";

interface CommentThreadProps {
  contractId: string;
  principal: string;
  lineNumber: number;
  currentUserDid?: string;
  onClose: () => void;
}

export function CommentThread({ contractId, principal, lineNumber, currentUserDid, onClose }: CommentThreadProps) {
  const [replyTo, setReplyTo] = useState<{ uri: string; cid: string; rkey: string } | null>(null);
  const [newComment, setNewComment] = useState("");

  const { data, isLoading, error } = useLineComments(
    { principal, contractName: contractId },
    lineNumber
  );

  const allComments = data?.comments || [];
  const profiles = data?.profiles || {};

  const createCommentMutation = useCreateComment();

  // Filter to root comments (no parent) for top-level display
  const rootComments = getRootComments(allComments);

  const handlePostComment = async () => {
    if (!newComment.trim() || !currentUserDid) return;

    try {
      await createCommentMutation.mutateAsync({
        subject: { principal, contractName: contractId },
        text: newComment.trim(),
        lineNumber,
        reply: replyTo ? {
          root: { uri: replyTo.uri, cid: replyTo.cid },
          parent: { uri: replyTo.uri, cid: replyTo.cid },
        } : undefined,
      });

      setNewComment("");
      setReplyTo(null);
      toast.success("Comment posted!");
    } catch (err) {
      console.error("Failed to post comment:", err);
      toast.error("Failed to post comment");
    }
  };

  return (
    <Card className="p-4 sticky top-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Line {lineNumber} Comments</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-destructive text-sm text-center py-4">
            Failed to load comments
          </p>
        ) : rootComments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No comments on this line yet. Be the first!
          </p>
        ) : (
          rootComments.map((comment) => (
            <CommentCard
              key={comment.uri}
              comment={comment}
              allComments={allComments}
              profiles={profiles}
              currentUserDid={currentUserDid}
              onReply={(uri, cid, rkey) => setReplyTo({ uri, cid, rkey })}
              depth={0}
            />
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t">
        {replyTo && (
          <div className="text-xs text-muted-foreground mb-2">
            Replying to comment...
          </div>
        )}
        <Textarea
          placeholder={replyTo ? "Write a reply..." : "Add a comment..."}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="mb-2"
          rows={3}
        />
        <div className="flex justify-between items-center">
          {replyTo && (
            <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
              Cancel reply
            </Button>
          )}
          <Button
            size="sm"
            className="ml-auto"
            disabled={!newComment.trim() || !currentUserDid || createCommentMutation.isPending}
            onClick={handlePostComment}
          >
            {createCommentMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Posting...
              </>
            ) : currentUserDid ? (
              "Post Comment"
            ) : (
              "Sign in to comment"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface CommentCardProps {
  comment: Comment;
  allComments: Comment[];
  profiles: Record<string, ProfileData>;
  currentUserDid?: string;
  onReply: (uri: string, cid: string, rkey: string) => void;
  depth: number;
}

function CommentCard({ comment, allComments, profiles, currentUserDid, onReply, depth }: CommentCardProps) {
  const profile = profiles[comment.authorDid];
  const replies = getRepliesFromComments(allComments, extractRkeyFromUri(comment.uri) || "");
  const isLiked = currentUserDid && comment.likedBy.includes(currentUserDid);

  const likeCommentMutation = useLikeComment();

  const handleLike = async () => {
    if (!currentUserDid) return;

    try {
      await likeCommentMutation.mutateAsync({ uri: comment.uri, cid: comment.cid });
    } catch (err) {
      console.error("Failed to like:", err);
    }
  };

  const handleReply = () => {
    const rkey = extractRkeyFromUri(comment.uri) || "";
    onReply(comment.uri, comment.cid, rkey);
  };

  // Build display info from profile or fallback
  const displayName = profile?.displayName || profile?.handle || comment.authorDid.slice(-8);
  const handle = profile?.handle || comment.authorDid.slice(-12);
  const avatar = profile?.avatar;

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-border pl-4" : ""}>
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatar} />
            <AvatarFallback>{displayName?.[0] || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground">{displayName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>@{handle}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-foreground">{comment.text}</p>
        <div className="flex items-center gap-4 text-muted-foreground">
          <button
            className={`flex items-center gap-1 text-xs hover:text-primary ${isLiked ? "text-primary" : ""}`}
            onClick={handleLike}
            disabled={!currentUserDid || likeCommentMutation.isPending}
          >
            <Heart className={`h-3 w-3 ${isLiked ? "fill-current" : ""}`} />
            {comment.likes}
          </button>
          <button className="flex items-center gap-1 text-xs hover:text-primary" onClick={handleReply}>
            <MessageCircle className="h-3 w-3" />
            Reply
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentCard
              key={reply.uri}
              comment={reply}
              allComments={allComments}
              profiles={profiles}
              currentUserDid={currentUserDid}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Extract rkey from an AT URI
 */
function extractRkeyFromUri(uri: string): string | undefined {
  const match = uri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (match) {
    return match[3];
  }
  return undefined;
}
