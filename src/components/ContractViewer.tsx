import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Contract } from "@/types/contract";
import { useComments } from "@/hooks/useComments";
import { useClarityHighlighter } from "@/hooks/useClarityHighlighter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { CommentThread } from "./CommentThread";
import { ContractComments, type ContractCommentsRef } from "./ContractComments";
import { HighlightedCodeLine } from "./HighlightedCodeLine";
import type { Comment } from "@/lexicon/types";

interface ContractViewerProps {
  contract: Contract;
  currentUserDid?: string;
  initialSelectedLine?: number;
  initialLineRange?: { start: number; end: number };
}

export interface ContractViewerRef {
  focusComments: () => void;
}

export const ContractViewer = forwardRef<ContractViewerRef, ContractViewerProps>(
  function ContractViewer({
    contract,
    currentUserDid,
    initialSelectedLine,
    initialLineRange,
  }, ref) {
  const [selectedLine, setSelectedLine] = useState<number | null>(
    initialSelectedLine ?? initialLineRange?.start ?? null
  );
  
  const contractCommentsRef = useRef<ContractCommentsRef>(null);
  
  useImperativeHandle(ref, () => ({
    focusComments: () => {
      const section = document.getElementById("contract-comments-section");
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        contractCommentsRef.current?.focus();
      }, 500);
    },
  }));

  // Scroll to line on mount when deep-linked
  useEffect(() => {
    if (initialSelectedLine || initialLineRange) {
      const lineNum = initialSelectedLine || initialLineRange?.start;
      if (lineNum) {
        // Small delay to ensure DOM is rendered
        setTimeout(() => {
          const element = document.getElementById(`line-${lineNum}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    }
  }, [initialSelectedLine, initialLineRange]);
  const lines = contract.source_code.split("\n");

  // Detect theme - check if dark class is on html element
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  // Syntax highlighting
  const { highlightLines, isReady } = useClarityHighlighter();
  const highlightedLines = useMemo(() => {
    return highlightLines(contract.source_code, isDark ? "dark" : "light");
  }, [contract.source_code, isDark, highlightLines]);

  // Fetch all comments for this contract
  const { data } = useComments({
    principal: contract.principal,
    contractName: contract.name,
    txId: contract.tx_id || "",
  });

  const allComments = data?.comments || [];
  const profiles = data?.profiles || {};

  // Group comments by line number for display
  const getLineComments = (lineNum: number): Comment[] => {
    return allComments.filter(
      (c) => c.lineNumber === lineNum && !c.parentId
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1 bg-card rounded-lg border overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b flex items-center justify-between">
            <div>
              <h2 className="font-mono font-semibold text-foreground">{contract.name}.clar</h2>
              <p className="text-xs text-muted-foreground">{contract.principal}</p>
            </div>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{contract.category}</span>
          </div>
          <div className="overflow-x-auto">
            <pre className="text-sm">
              {lines.map((line, idx) => {
                const lineNum = idx + 1;
                const lineComments = getLineComments(lineNum);
                const hasComments = lineComments.length > 0;
                const isSelected = selectedLine === lineNum;

                return (
                  <div
                    key={lineNum}
                    id={`line-${lineNum}`}
                    className={`flex group hover:bg-muted/50 cursor-pointer ${
                      isSelected ? "bg-primary/10" : ""
                    } ${hasComments ? "bg-accent/20" : ""}`}
                    onClick={() => setSelectedLine(isSelected ? null : lineNum)}
                  >
                    {/* Avatar column - fixed width */}
                    <span className="w-8 shrink-0 flex items-center justify-center">
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
                    {/* Line number column - fixed width based on max digits */}
                    <span 
                      className="shrink-0 text-right pr-3 pl-1 text-muted-foreground select-none border-r border-border tabular-nums"
                      style={{ width: `${Math.max(2, String(lines.length).length) + 1}ch` }}
                    >
                      {lineNum}
                    </span>
                    <code className="flex-1 px-4 py-0.5 whitespace-pre font-mono">
                      {isReady && highlightedLines[idx] ? (
                        <HighlightedCodeLine tokens={highlightedLines[idx].tokens} />
                      ) : (
                        <span className="text-foreground">{line}</span>
                      )}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(lineNum);
                      }}
                    >
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </pre>
          </div>
        </div>

        {selectedLine && (
          <div className="w-96 shrink-0">
            <CommentThread
              contractId={contract.name}
              principal={contract.principal}
              txId={contract.tx_id || ""}
              lineNumber={selectedLine}
              currentUserDid={currentUserDid}
              onClose={() => setSelectedLine(null)}
            />
          </div>
        )}
      </div>

      {/* Contract-level comments section */}
      <div id="contract-comments-section">
        <ContractComments
          ref={contractCommentsRef}
          contractId={contract.name}
          principal={contract.principal}
          txId={contract.tx_id || ""}
          currentUserDid={currentUserDid}
        />
      </div>
    </div>
  );
});
