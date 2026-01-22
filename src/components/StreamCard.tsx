import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Comment } from "@/lexicon/types";
import type { ProfileData } from "@/lib/comments-api";

interface StreamCardProps {
  comment: Comment;
  profile?: ProfileData;
}

/**
 * Ellipse a Stacks address for display
 * SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9 -> SP3K8B...A0KBR9
 */
function ellipseAddress(address: string, prefixChars = 6, suffixChars = 6): string {
  if (address.length <= prefixChars + suffixChars + 3) return address;
  return `${address.slice(0, prefixChars)}...${address.slice(-suffixChars)}`;
}

export function StreamCard({ comment, profile }: StreamCardProps) {
  const contractPath = `${comment.subject.principal}.${comment.subject.contractName}`;
  const txId = comment.subject.txId;
  const isReply = !!comment.parentId;

  return (
    <Card className="hover:bg-accent/30 transition-colors">
      <CardContent className="p-4">
        {/* Header: Contract info on left, Author on right */}
        <div className="flex items-start justify-between gap-4 mb-3">
          {/* Left: Contract identity */}
          <div className="min-w-0 flex-1">
            <Link
              to={`/contract/${contractPath}`}
              className="group flex items-baseline gap-1.5 text-foreground hover:text-primary transition-colors"
            >
              <span className="font-mono text-sm text-muted-foreground">
                {ellipseAddress(comment.subject.principal)}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold truncate">
                {comment.subject.contractName}
              </span>
            </Link>
            {txId && (
              <a
                href={`https://explorer.stxer.xyz/txid/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5"
              >
                <span>View TX</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Right: Author info */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <Link
                to={`/profile/${profile?.handle || comment.authorDid}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                @{profile?.handle || comment.authorDid.slice(0, 15)}
              </Link>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </div>
            </div>
            <Link to={`/profile/${profile?.handle || comment.authorDid}`}>
              <Avatar className="h-8 w-8 hover:ring-2 hover:ring-primary transition-all">
                <AvatarImage src={profile?.avatar} alt={profile?.displayName || profile?.handle} />
                <AvatarFallback className="text-xs">
                  {(profile?.displayName || profile?.handle || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        {/* Main content: Comment text */}
        <div className="space-y-2">
          {isReply && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>Reply</span>
            </div>
          )}
          <p className="text-foreground leading-relaxed">{comment.text}</p>
          
          {/* Line indicator */}
          {comment.lineNumber && (
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
              Line {comment.lineNumber}
            </div>
          )}
          {comment.lineRange && (
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
              Lines {comment.lineRange.start}-{comment.lineRange.end}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default StreamCard;
