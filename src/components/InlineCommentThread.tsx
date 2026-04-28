import { useState } from "react";
import { useLineComments, useCreateComment, getRepliesFromComments, getRootComments, ProfileData } from "@/hooks/useComments";
import { useToggleCommentReaction } from "@/hooks/useCommentReactions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Loader2, Link2, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Comment } from "@/lexicon/types";
import { ReactionPicker } from "./ReactionPicker";
import { canInteractWith, crossProtocolMessage, type AuthType } from "@/lib/auth-utils";

interface InlineCommentThreadProps {
  contractId: string;
  principal: string;
  txId: string;
  lineNumber: number;
  currentUserDid?: string;
  currentUserAuthType?: AuthType | null;
  onClose: () => void;
}

export function InlineCommentThread({ contractId, principal, txId, lineNumber, currentUserDid, currentUserAuthType, onClose }: InlineCommentThreadProps) {
  const [replyTo, setReplyTo] = useState<{ uri: string; cid: string; rkey: string } | null>(null);
  const [newComment, setNewComment] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/contract/${principal}.${contractId}?line=${lineNumber}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied to clipboard!");
  };

  const { data, isLoading, error } = useLineComments(
    { principal, contractName: contractId, txId },
    lineNumber
  );

  const allComments = data?.comments || [];
  const profiles = data?.profiles || {};
  const createCommentMutation = useCreateComment();
  const rootComments = getRootComments(allComments);

  const handlePostComment = async () => {
    if (!newComment.trim() || !currentUserDid) return;
    try {
      await createCommentMutation.mutateAsync({
        subject: { principal, contractName: contractId, txId },
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
    <div className="bg-card border border-border rounded-md mx-2 my-1 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50 rounded-t-md">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">Line {lineNumber}</span>
          <Button variant="ghost" size="sm" onClick={handleCopyLink} className="h-5 w-5 p-0">
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Link2 className="h-3 w-3" />}
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-5 w-5 p-0">
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Comments */}
      <div className="px-3 py-2 space-y-3 max-h-[40vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-destructive text-xs text-center py-2">Failed to load comments</p>
        ) : rootComments.length === 0 ? (
          <p className="text-muted-foreground text-xs text-center py-2">No comments on this line yet.</p>
        ) : (
          rootComments.map((comment) => (
            <InlineCommentCard
              key={comment.uri}
              comment={comment}
              allComments={allComments}
              profiles={profiles}
              currentUserDid={currentUserDid}
              currentUserAuthType={currentUserAuthType}
              onReply={(uri, cid, rkey) => setReplyTo({ uri, cid, rkey })}
              depth={0}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-border">
        {replyTo && (
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            Replying to comment...
            <button className="text-primary hover:underline" onClick={() => setReplyTo(null)}>Cancel</button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder={currentUserDid ? "Write a comment..." : "Sign in to comment"}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="text-xs min-h-[2rem] resize-none"
            rows={1}
            disabled={!currentUserDid}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handlePostComment();
              }
            }}
          />
          <Button
            size="sm"
            className="shrink-0 h-8 text-xs"
            disabled={!newComment.trim() || !currentUserDid || createCommentMutation.isPending}
            onClick={handlePostComment}
          >
            {createCommentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface InlineCommentCardProps {
  comment: Comment;
  allComments: Comment[];
  profiles: Record<string, ProfileData>;
  currentUserDid?: string;
  currentUserAuthType?: AuthType | null;
  onReply: (uri: string, cid: string, rkey: string) => void;
  depth: number;
}

function InlineCommentCard({ comment, allComments, profiles, currentUserDid, currentUserAuthType, onReply, depth }: InlineCommentCardProps) {
  const profile = profiles[comment.authorDid];
  const replies = getRepliesFromComments(allComments, extractRkeyFromUri(comment.uri) || "");
  const reactions = comment.reactions || {};
  const userReaction = comment.userReaction;
  const toggleReactionMutation = useToggleCommentReaction();
  const canInteract = canInteractWith(currentUserAuthType, comment.authorType);

  const handleReaction = (emoji: string) => {
    if (!currentUserDid) { toast.error("Sign in to react"); return; }
    if (!canInteract) { toast.error(crossProtocolMessage(comment.authorType)); return; }
    toggleReactionMutation.mutate({
      uri: comment.uri, cid: comment.cid, emoji,
      currentUserReactionUri: userReaction?.uri, currentUserEmoji: userReaction?.emoji,
    });
  };

  const handleReply = () => {
    if (!canInteract) { toast.error(crossProtocolMessage(comment.authorType)); return; }
    onReply(comment.uri, comment.cid, extractRkeyFromUri(comment.uri) || "");
  };

  // Nostr profiles are resolved asynchronously: the server returns comments
  // immediately and refreshes the kind-0 cache after. While we're waiting on
  // that first fill, show a skeleton instead of a meaningless DID suffix.
  const isNostr = comment.authorType === "nostr";
  const profilePending = !profile && isNostr;
  const displayName = profile?.displayName || profile?.handle || comment.authorDid.slice(-8);
  const handle = profile?.handle || comment.authorDid.slice(-12);

  return (
    <div className={depth > 0 ? "ml-4 border-l-2 border-border pl-3" : ""}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {profilePending ? (
            <>
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2.5 w-14" />
            </>
          ) : (
            <>
              <Avatar className="h-5 w-5">
                <AvatarImage src={profile?.avatar} />
                <AvatarFallback className="text-[8px]">{displayName?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-xs text-foreground">{displayName}</span>
              <span className="text-[10px] text-muted-foreground">@{handle}</span>
            </>
          )}
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-xs text-foreground pl-7">{comment.text}</p>
        <div className="flex items-center gap-2 text-muted-foreground pl-7">
          <ReactionPicker
            reactions={reactions} userReaction={userReaction}
            onReact={handleReaction}
            disabled={!currentUserDid || !canInteract || toggleReactionMutation.isPending}
            size="sm"
          />
          <button
            className="flex items-center gap-1 text-[10px] hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleReply}
            disabled={!!currentUserDid && !canInteract}
            title={currentUserDid && !canInteract ? crossProtocolMessage(comment.authorType) : undefined}
          >
            <MessageCircle className="h-2.5 w-2.5" /> Reply
          </button>
        </div>
      </div>
      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <InlineCommentCard key={reply.uri} comment={reply} allComments={allComments}
              profiles={profiles} currentUserDid={currentUserDid} currentUserAuthType={currentUserAuthType}
              onReply={onReply} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function extractRkeyFromUri(uri: string): string | undefined {
  const match = uri.match(/at:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
  return match ? match[3] : undefined;
}
