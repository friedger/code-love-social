import { useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useContract } from "@/hooks/useContracts";
import { useRelatedContracts } from "@/hooks/useRelatedContracts";
import { ContractViewer, type ContractViewerRef } from "@/components/ContractViewer";
import { RelatedContractsList } from "@/components/RelatedContractsList";
import { RelatedContractsIcons } from "@/components/RelatedContractsIcons";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowLeft, AlertCircle, SmilePlus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { ContractHeader } from "@/components/ContractHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useContractReactions, useAddContractReaction } from "@/hooks/useContractReactions";
import { toast } from "sonner";

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👀', '🚀', '⚠️'] as const;

const ContractPage = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const viewerRef = useRef<ContractViewerRef>(null);
  const [reactionPopoverOpen, setReactionPopoverOpen] = useState(false);

  // Parse principal.name format
  const lastDotIndex = contractId?.lastIndexOf(".") ?? -1;
  const principal = lastDotIndex > 0 ? contractId!.slice(0, lastDotIndex) : "";
  const name = lastDotIndex > 0 ? contractId!.slice(lastDotIndex + 1) : "";

  // Parse line parameters for deep linking
  const lineParam = searchParams.get("line");
  const linesParam = searchParams.get("lines");

  const initialLine = lineParam ? parseInt(lineParam, 10) : undefined;
  const initialRange = linesParam
    ? {
        start: parseInt(linesParam.split("-")[0], 10),
        end: parseInt(linesParam.split("-")[1], 10),
      }
    : undefined;

  const { data: contract, isLoading, error } = useContract(principal, name);
  const { data: relatedContracts } = useRelatedContracts({
    sourceHash: contract?.source_hash ?? null,
    currentPrincipal: principal,
    currentName: name,
  });
  const { data: reactions } = useContractReactions(principal, name);
  const addReactionMutation = useAddContractReaction();

  const handleCommentClick = () => {
    viewerRef.current?.focusComments();
  };

  const handleReaction = async (emoji: string) => {
    if (!user) {
      toast.error("Sign in to react");
      return;
    }
    if (!contract) return;

    try {
      await addReactionMutation.mutateAsync({
        principal: contract.principal,
        contractName: contract.name,
        txId: contract.tx_id || undefined,
        emoji,
      });
      setReactionPopoverOpen(false);
    } catch (err) {
      console.error("Failed to add reaction:", err);
      toast.error("Failed to add reaction");
    }
  };

  // Get sorted reactions with counts > 0
  const reactionEntries = Object.entries(reactions?.reactions || {}).filter(
    ([, count]) => count > 0
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to contracts
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-96 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading contract...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-96 text-destructive">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>Error loading contract</p>
          </div>
        ) : contract ? (
          <>
            <ContractHeader
              principal={contract.principal}
              contractName={contract.name}
              txId={contract.tx_id}
              sourceHash={contract.source_hash}
              description={contract.description}
              actions={
                <>
                  {/* Show aggregated reactions */}
                  {reactionEntries.length > 0 && (
                    <div className="flex items-center gap-1">
                      {reactionEntries.map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(emoji)}
                          disabled={addReactionMutation.isPending}
                          className={cn(
                            "inline-flex items-center gap-0.5 px-2 py-1 rounded text-sm transition-colors",
                            reactions?.userReaction?.emoji === emoji
                              ? "bg-primary/20 text-primary"
                              : "bg-muted/50 hover:bg-muted"
                          )}
                        >
                          <span>{emoji}</span>
                          <span className="text-xs">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <Popover open={reactionPopoverOpen} onOpenChange={setReactionPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <SmilePlus className="h-4 w-4" />
                        <span className="hidden sm:inline">React</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="end">
                      <div className="flex gap-1">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            className={cn(
                              "p-2 hover:bg-muted rounded text-xl transition-colors",
                              reactions?.userReaction?.emoji === emoji && "bg-primary/20"
                            )}
                            onClick={() => handleReaction(emoji)}
                            disabled={addReactionMutation.isPending}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleCommentClick}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Comment</span>
                  </Button>
                </>
              }
            />
            {/* Related contracts icons above the viewer */}
            {relatedContracts && relatedContracts.length > 0 && (
              <RelatedContractsIcons contracts={relatedContracts} />
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <ContractViewer
                ref={viewerRef}
                contract={contract}
                currentUserDid={user?.id}
                initialSelectedLine={initialLine}
                initialLineRange={initialRange}
              />
              {relatedContracts && relatedContracts.length > 0 && (
                <aside className="space-y-4">
                  <RelatedContractsList contracts={relatedContracts} />
                </aside>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>Contract not found</p>
            <p className="text-sm mt-1 font-mono">{contractId}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractPage;
