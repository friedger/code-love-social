import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Contract } from "@/types/contract";
import { useComments, type ProfileData } from "@/hooks/useComments";
import { useCreateComment } from "@/hooks/useComments";
import { useContractReactions, useAddContractReaction } from "@/hooks/useContractReactions";
import { useToggleCommentReaction } from "@/hooks/useCommentReactions";
import { useClarityHighlighter } from "@/hooks/useClarityHighlighter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReactionPicker } from "@/components/ReactionPicker";
import { ContractIdenticon } from "@/components/ContractIdenticon";
import { HighlightedCodeLine } from "@/components/HighlightedCodeLine";
import { formatContractIdShort, getContractPath } from "@/lib/utils";
import { ExternalLink, MessageSquare, ChevronDown, ChevronUp, Send, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Comment } from "@/lexicon/types";

interface ContractExplorerCardProps {
  contract: Contract;
  currentUserDid?: string;
}

const MAX_LINES = 50;
const CONTEXT_LINES = 25;

export function ContractExplorerCard({ contract, currentUserDid }: ContractExplorerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ uri: string; cid: string; rkey: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  
  // Fetch comments
  const { data: commentsData } = useComments({
    principal: contract.principal,
    contractName: contract.name,
    txId: contract.tx_id || "",
  });
  
  // Fetch contract reactions
  const { data: reactionsData } = useContractReactions(contract.principal, contract.name);
  const addContractReaction = useAddContractReaction();
  const createComment = useCreateComment();
  const toggleCommentReaction = useToggleCommentReaction();
  
  const allComments = commentsData?.comments || [];
  const profiles = commentsData?.profiles || {};
  
  // Syntax highlighting
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const { highlightLines, isReady } = useClarityHighlighter();
  const lines = useMemo(() => contract.source_code.split("\n"), [contract.source_code]);
  const highlightedLines = useMemo(() => {
    return highlightLines(contract.source_code, isDark ? "dark" : "light");
  }, [contract.source_code, isDark, highlightLines]);
  
  // Find line comments to show context around
  const lineComments = useMemo(() => {
    return allComments.filter((c) => c.lineNumber && !c.parentId);
  }, [allComments]);
  
  // Calculate which lines to show
  const visibleLines = useMemo(() => {
    if (isExpanded) {
      return lines.map((_, idx) => idx);
    }
    
    if (lineComments.length === 0) {
      // No line comments - show first MAX_LINES
      return lines.slice(0, MAX_LINES).map((_, idx) => idx);
    }
    
    // Show context around comments
    const visibleSet = new Set<number>();
    lineComments.forEach((comment) => {
      if (comment.lineNumber) {
        const start = Math.max(0, comment.lineNumber - CONTEXT_LINES - 1);
        const end = Math.min(lines.length, comment.lineNumber + CONTEXT_LINES);
        for (let i = start; i < end; i++) {
          visibleSet.add(i);
        }
      }
    });
    
    // If less than MAX_LINES, fill from start
    if (visibleSet.size < MAX_LINES) {
      for (let i = 0; i < Math.min(MAX_LINES, lines.length); i++) {
        visibleSet.add(i);
      }
    }
    
    return Array.from(visibleSet).sort((a, b) => a - b);
  }, [lines, lineComments, isExpanded]);
  
  // Get root comments (contract-level only, no line number, no parent)
  const rootComments = useMemo(() => {
    return allComments.filter((c) => !c.lineNumber && !c.parentId).slice(0, 3);
  }, [allComments]);
  
  // Get comments for a specific line
  const getLineComments = (lineNum: number): Comment[] => {
    return allComments.filter((c) => c.lineNumber === lineNum && !c.parentId);
  };
  
  // Get replies for a comment
  const getReplies = (rkey: string): Comment[] => {
    return allComments.filter((c) => c.parentId === rkey);
  };
  
  const handleContractReaction = async (emoji: string) => {
    if (!currentUserDid) {
      toast.error("Sign in to react");
      return;
    }
    try {
      await addContractReaction.mutateAsync({
        principal: contract.principal,
        contractName: contract.name,
        txId: contract.tx_id ?? undefined,
        emoji,
      });
    } catch (error) {
      console.error("Reaction error:", error);
      toast.error("Failed to add reaction");
    }
  };
  
  const handleCommentReaction = async (comment: Comment, emoji: string) => {
    if (!currentUserDid) {
      toast.error("Sign in to react");
      return;
    }
    try {
      await toggleCommentReaction.mutateAsync({
        uri: comment.uri,
        cid: comment.cid,
        emoji,
        currentUserReactionUri: comment.userReaction?.uri,
        currentUserEmoji: comment.userReaction?.emoji,
      });
    } catch (error) {
      console.error("Reaction error:", error);
      toast.error("Failed to add reaction");
    }
  };
  
  const handleReply = async () => {
    if (!currentUserDid || !replyingTo || !replyText.trim()) return;
    
    try {
      await createComment.mutateAsync({
        subject: {
          principal: contract.principal,
          contractName: contract.name,
          txId: contract.tx_id || "",
        },
        text: replyText.trim(),
        reply: {
          root: { uri: replyingTo.uri, cid: replyingTo.cid },
          parent: { uri: replyingTo.uri, cid: replyingTo.cid },
        },
      });
      setReplyText("");
      setReplyingTo(null);
      toast.success("Reply posted");
    } catch (error) {
      console.error("Reply error:", error);
      toast.error("Failed to post reply");
    }
  };
  
  const contractPath = `/contract/${getContractPath(contract.principal, contract.name)}`;
  const hasMoreLines = lines.length > MAX_LINES && !isExpanded;
  
  // Find gaps in visible lines to show "..." indicators
  const renderLines = () => {
    const elements: React.ReactNode[] = [];
    let lastIdx = -1;
    
    visibleLines.forEach((idx, i) => {
      // Show gap indicator
      if (lastIdx !== -1 && idx > lastIdx + 1) {
        elements.push(
          <div key={`gap-${idx}`} className="flex items-center gap-2 py-1 px-4 bg-muted/30 text-muted-foreground text-xs">
            <span className="font-mono">...</span>
            <span>{idx - lastIdx - 1} lines hidden</span>
          </div>
        );
      }
      
      const lineNum = idx + 1;
      const lineComments = getLineComments(lineNum);
      const hasComments = lineComments.length > 0;
      
      elements.push(
        <div key={lineNum} className={`flex group ${hasComments ? "bg-accent/20" : ""}`}>
          <span className="hidden sm:flex w-8 shrink-0 items-center justify-center">
            {hasComments && (
              <div className="flex -space-x-1">
                {lineComments.slice(0, 2).map((c) => {
                  const profile = profiles[c.authorDid];
                  return (
                    <Avatar key={c.uri} className="h-4 w-4 border border-background">
                      <AvatarImage src={profile?.avatar} />
                      <AvatarFallback className="text-[8px]">
                        {profile?.displayName?.[0] || profile?.handle?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
            )}
          </span>
          <span 
            className="shrink-0 text-right pr-2 sm:pr-3 pl-1 text-muted-foreground select-none border-r border-border tabular-nums"
            style={{ width: `${Math.max(2, String(lines.length).length) + 1}ch` }}
          >
            {lineNum}
          </span>
          <code className="flex-1 px-2 sm:px-4 py-0.5 whitespace-pre font-mono text-xs">
            {isReady && highlightedLines[idx] ? (
              <HighlightedCodeLine tokens={highlightedLines[idx].tokens} />
            ) : (
              <span className="text-foreground">{lines[idx]}</span>
            )}
          </code>
        </div>
      );
      
      // Show inline comments for this line
      if (hasComments) {
        lineComments.slice(0, 2).forEach((comment) => {
          const profile = profiles[comment.authorDid];
          const replies = getReplies(extractRkeyFromUri(comment.uri) || "");
          
          elements.push(
            <div key={`comment-${comment.uri}`} className="ml-8 sm:ml-16 mr-4 my-2 pl-3 border-l-2 border-primary/30">
              <CommentInline
                comment={comment}
                profile={profile}
                replies={replies}
                profiles={profiles}
                currentUserDid={currentUserDid}
                onReact={(emoji) => handleCommentReaction(comment, emoji)}
                onReply={() => setReplyingTo({ 
                  uri: comment.uri, 
                  cid: comment.cid, 
                  rkey: extractRkeyFromUri(comment.uri) || "" 
                })}
                isReplyingTo={replyingTo?.uri === comment.uri}
              />
              {replyingTo?.uri === comment.uri && (
                <div className="mt-2 flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="min-h-[60px] text-sm"
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <Button 
                      size="sm" 
                      onClick={handleReply}
                      disabled={!replyText.trim() || createComment.isPending}
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => { setReplyingTo(null); setReplyText(""); }}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        });
        
        if (lineComments.length > 2) {
          elements.push(
            <div key={`more-${lineNum}`} className="ml-8 sm:ml-16 mr-4 mb-2">
              <Link to={`${contractPath}?line=${lineNum}`} className="text-xs text-primary hover:underline">
                +{lineComments.length - 2} more comments
              </Link>
            </div>
          );
        }
      }
      
      lastIdx = idx;
    });
    
    return elements;
  };
  
  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <ContractIdenticon value={contract.source_hash || `${contract.principal}.${contract.name}`} size={40} />
          <div className="min-w-0">
            <Link 
              to={contractPath}
              className="font-mono font-semibold text-foreground hover:text-primary truncate block"
            >
              {contract.name}
            </Link>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {formatContractIdShort(contract.principal, contract.name)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {contract.category && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded hidden sm:inline">
              {contract.category}
            </span>
          )}
          <ReactionPicker
            reactions={reactionsData?.reactions || {}}
            userReaction={reactionsData?.userReaction}
            onReact={handleContractReaction}
            disabled={!currentUserDid || addContractReaction.isPending}
            size="sm"
          />
          <Button variant="outline" size="sm" asChild>
            <Link to={contractPath}>
              <ExternalLink className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Open</span>
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Description */}
      {contract.description && (
        <div className="px-3 sm:px-4 py-2 border-b text-sm text-muted-foreground">
          {contract.description}
        </div>
      )}
      
      {/* Code viewer */}
      <div className="overflow-x-auto">
        <pre className="text-xs sm:text-sm min-w-max">
          {renderLines()}
        </pre>
      </div>
      
      {/* Expand/collapse button */}
      {(hasMoreLines || isExpanded) && lines.length > MAX_LINES && (
        <div className="border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show all {lines.length} lines
              </>
            )}
          </Button>
        </div>
      )}
      
      {/* Contract-level comments preview */}
      {rootComments.length > 0 && (
        <div className="border-t p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            Discussion
          </div>
          {rootComments.map((comment) => {
            const profile = profiles[comment.authorDid];
            return (
              <CommentInline
                key={comment.uri}
                comment={comment}
                profile={profile}
                replies={getReplies(extractRkeyFromUri(comment.uri) || "")}
                profiles={profiles}
                currentUserDid={currentUserDid}
                onReact={(emoji) => handleCommentReaction(comment, emoji)}
                onReply={() => setReplyingTo({ 
                  uri: comment.uri, 
                  cid: comment.cid, 
                  rkey: extractRkeyFromUri(comment.uri) || "" 
                })}
                isReplyingTo={replyingTo?.uri === comment.uri}
              />
            );
          })}
          {allComments.filter((c) => !c.lineNumber && !c.parentId).length > 3 && (
            <Link to={contractPath} className="text-sm text-primary hover:underline block">
              View all comments →
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}

// Helper component for inline comments
interface CommentInlineProps {
  comment: Comment;
  profile?: ProfileData;
  replies: Comment[];
  profiles: Record<string, ProfileData>;
  currentUserDid?: string;
  onReact: (emoji: string) => void;
  onReply: () => void;
  isReplyingTo: boolean;
}

function CommentInline({ 
  comment, 
  profile, 
  replies, 
  profiles,
  currentUserDid, 
  onReact, 
  onReply,
  isReplyingTo,
}: CommentInlineProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage src={profile?.avatar} />
          <AvatarFallback className="text-xs">
            {profile?.displayName?.[0] || profile?.handle?.[0] || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">
              {profile?.displayName || profile?.handle || "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground mt-0.5 break-words">{comment.text}</p>
          <div className="flex items-center gap-2 mt-1">
            <ReactionPicker
              reactions={comment.reactions || {}}
              userReaction={comment.userReaction}
              onReact={onReact}
              disabled={!currentUserDid}
              size="xs"
            />
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs"
              onClick={onReply}
              disabled={isReplyingTo}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
          </div>
        </div>
      </div>
      
      {/* Show first reply if any */}
      {replies.length > 0 && (
        <div className="ml-8 pl-3 border-l border-border/50">
          {replies.slice(0, 1).map((reply) => {
            const replyProfile = profiles[reply.authorDid];
            return (
              <div key={reply.uri} className="flex items-start gap-2">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={replyProfile?.avatar} />
                  <AvatarFallback className="text-[10px]">
                    {replyProfile?.displayName?.[0] || replyProfile?.handle?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">
                      {replyProfile?.displayName || replyProfile?.handle || "Unknown"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground mt-0.5">{reply.text}</p>
                </div>
              </div>
            );
          })}
          {replies.length > 1 && (
            <span className="text-xs text-muted-foreground ml-7">
              +{replies.length - 1} more replies
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function extractRkeyFromUri(uri: string): string | undefined {
  const parts = uri.split("/");
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}
