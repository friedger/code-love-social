import { useState } from "react";
import { getCommentsForLine, getReplies, Comment } from "@/data/dummyComments";
import { getUserByDid, getRelationship, User } from "@/data/dummyUsers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, X, UserCheck, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommentThreadProps {
  contractId: string;
  lineNumber: number;
  currentUserDid?: string;
  onClose: () => void;
}

export function CommentThread({ contractId, lineNumber, currentUserDid, onClose }: CommentThreadProps) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const comments = getCommentsForLine(contractId, lineNumber);

  return (
    <Card className="p-4 sticky top-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Line {lineNumber} Comments</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No comments on this line yet. Be the first!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              currentUserDid={currentUserDid}
              onReply={() => setReplyTo(comment.id)}
              depth={0}
            />
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t">
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
          <Button size="sm" className="ml-auto" disabled={!newComment.trim() || !currentUserDid}>
            {currentUserDid ? "Post Comment" : "Sign in to comment"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface CommentCardProps {
  comment: Comment;
  currentUserDid?: string;
  onReply: () => void;
  depth: number;
}

function CommentCard({ comment, currentUserDid, onReply, depth }: CommentCardProps) {
  const user = getUserByDid(comment.authorDid);
  const replies = getReplies(comment.id);
  const relationship = currentUserDid ? getRelationship(currentUserDid, comment.authorDid) : null;
  const isLiked = currentUserDid && comment.likedBy.includes(currentUserDid);

  if (!user) return null;

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-border pl-4" : ""}>
      <div className="space-y-2">
        <UserHeader user={user} relationship={relationship} timestamp={comment.createdAt} />
        <p className="text-sm text-foreground">{comment.content}</p>
        <div className="flex items-center gap-4 text-muted-foreground">
          <button className={`flex items-center gap-1 text-xs hover:text-primary ${isLiked ? "text-primary" : ""}`}>
            <Heart className={`h-3 w-3 ${isLiked ? "fill-current" : ""}`} />
            {comment.likes}
          </button>
          <button className="flex items-center gap-1 text-xs hover:text-primary" onClick={onReply}>
            <MessageCircle className="h-3 w-3" />
            Reply
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
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

interface UserHeaderProps {
  user: User;
  relationship: ReturnType<typeof getRelationship> | null;
  timestamp: string;
}

function UserHeader({ user, relationship, timestamp }: UserHeaderProps) {
  const reputationColor = user.reputation >= 80 ? "text-green-500" : user.reputation >= 50 ? "text-yellow-500" : "text-muted-foreground";

  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={user.avatar} />
        <AvatarFallback>{user.displayName[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground">{user.displayName}</span>
          {user.badges.slice(0, 2).map((badge) => (
            <span key={badge.id} title={badge.name} className="text-xs">
              {badge.icon}
            </span>
          ))}
          <span className={`text-xs font-medium ${reputationColor}`}>
            {user.reputation}%
          </span>
          {relationship?.followedBy && (
            <Badge variant="secondary" className="text-[10px] h-4">
              <UserCheck className="h-2 w-2 mr-1" /> Follows you
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>@{user.handle}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>
        </div>
      </div>
      {relationship && !relationship.following && (
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <UserPlus className="h-3 w-3 mr-1" /> Follow
        </Button>
      )}
    </div>
  );
}
