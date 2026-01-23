import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink, MessageSquare, SmilePlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Comment, KNOWN_REACTIONS } from "@/lexicon/types";
import type { ProfileData } from "@/lib/comments-api";
import { ContractIdenticon } from "./ContractIdenticon";
import { formatContractId, getContractPath, getExplorerContractUrl } from "@/lib/utils";

interface StreamCardProps {
  comment: Comment;
  profile?: ProfileData;
}

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👀', '🚀', '⚠️'] as const;

export function StreamCard({ comment, profile }: StreamCardProps) {
  const contractPath = getContractPath(comment.subject.principal, comment.subject.contractName);
  const txId = comment.subject.txId;
  const sourceHash = comment.subject.sourceHash;
  const isReply = !!comment.parentId;
  const reactions = comment.reactions || {};

  const getContractLink = () => {
    let url = `/contract/${contractPath}`;
    if (comment.lineNumber) {
      url += `?line=${comment.lineNumber}`;
    } else if (comment.lineRange) {
      url += `?lines=${comment.lineRange.start}-${comment.lineRange.end}`;
    }
    return url;
  };

  return (
    <Card className="hover:bg-accent/30 transition-colors">
      <CardContent className="p-3 sm:p-4">
        {/* Header: Contract info on left, Author on right - stacks on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ContractIdenticon value={sourceHash || contractPath} size={20} className="shrink-0 rounded-sm" />
              <Link
                to={getContractLink()}
                className="font-mono text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors break-all"
              >
                {formatContractId(comment.subject.principal, comment.subject.contractName)}
              </Link>
              {comment.lineNumber && (
                <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                  L{comment.lineNumber}
                </span>
              )}
              {comment.lineRange && (
                <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                  L{comment.lineRange.start}-{comment.lineRange.end}
                </span>
              )}
            </div>
            <a
              href={getExplorerContractUrl(comment.subject.principal, comment.subject.contractName)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/profile/${profile?.handle || comment.authorDid}`}>
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8 hover:ring-2 hover:ring-primary transition-all">
                <AvatarImage src={profile?.avatar} alt={profile?.displayName || profile?.handle} />
                <AvatarFallback className="text-xs">
                  {(profile?.displayName || profile?.handle || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="text-left sm:text-right">
              <Link
                to={`/profile/${profile?.handle || comment.authorDid}`}
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                @{profile?.handle || comment.authorDid.slice(0, 15)}
              </Link>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="space-y-2">
          {isReply && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>Reply</span>
            </div>
          )}
          <p className="text-foreground leading-relaxed">{comment.text}</p>
        </div>

        {/* Footer: Reactions and Reply */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
          {/* Reaction counts */}
          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(reactions).map(([emoji, count]) => (
              <span
                key={emoji}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-muted/50"
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground">{count}</span>
              </span>
            ))}
          </div>

          {/* Add reaction button */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <SmilePlus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex gap-1">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className="p-1.5 hover:bg-muted rounded text-lg"
                    onClick={() => {/* TODO: Call addReaction */}}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" asChild>
            <Link to={getContractLink()}>
              <MessageSquare className="h-3 w-3 mr-1" />
              Reply
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default StreamCard;
