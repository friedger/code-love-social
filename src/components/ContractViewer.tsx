import { useState } from "react";
import { Contract } from "@/types/contract";
import { useComments } from "@/hooks/useComments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { CommentThread } from "./CommentThread";
import { ContractComments } from "./ContractComments";
import type { Comment } from "@/lexicon/types";

interface ContractViewerProps {
  contract: Contract;
  currentUserDid?: string;
}

export function ContractViewer({ contract, currentUserDid }: ContractViewerProps) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const lines = contract.source_code.split("\n");

  // Fetch all comments for this contract
  const { data } = useComments({
    principal: contract.principal,
    contractName: contract.name,
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
                    className={`flex group hover:bg-muted/50 cursor-pointer ${
                      isSelected ? "bg-primary/10" : ""
                    } ${hasComments ? "bg-accent/20" : ""}`}
                    onClick={() => setSelectedLine(isSelected ? null : lineNum)}
                  >
                    <span className="w-12 text-right pr-4 text-muted-foreground select-none border-r border-border flex items-center justify-end gap-1">
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
                      {lineNum}
                    </span>
                    <code className="flex-1 px-4 py-0.5 text-foreground whitespace-pre">{line}</code>
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
              lineNumber={selectedLine}
              currentUserDid={currentUserDid}
              onClose={() => setSelectedLine(null)}
            />
          </div>
        )}
      </div>

      {/* Contract-level comments section */}
      <ContractComments
        contractId={contract.name}
        principal={contract.principal}
        currentUserDid={currentUserDid}
      />
    </div>
  );
}
