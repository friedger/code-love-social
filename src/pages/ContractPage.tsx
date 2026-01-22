import { useParams, Link, useSearchParams } from "react-router-dom";
import { useContract } from "@/hooks/useContracts";
import { ContractViewer } from "@/components/ContractViewer";
import { useAtprotoAuth } from "@/hooks/useAtprotoAuth";
import { Loader2, ArrowLeft, AlertCircle, ExternalLink, SmilePlus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { ContractIdenticon } from "@/components/ContractIdenticon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatContractId, getContractPath } from "@/lib/utils";

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👀', '🚀', '⚠️'] as const;

const ContractPage = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAtprotoAuth();

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
            <div className="mb-6 flex items-start justify-between gap-4">
              {/* Left: Contract identity */}
              <div className="flex items-start gap-3 min-w-0">
                <ContractIdenticon 
                  value={getContractPath(contract.principal, contract.name)} 
                  size={48} 
                  className="shrink-0 rounded" 
                />
                <div className="min-w-0">
                  <h2 className="font-mono text-lg text-foreground truncate">
                    {formatContractId(contract.principal, contract.name)}
                  </h2>
                  {contract.tx_id && (
                    <a
                      href={`https://explorer.stxer.xyz/txid/${contract.tx_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <span>View on Explorer</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {contract.description && (
                    <p className="text-muted-foreground text-sm mt-1">{contract.description}</p>
                  )}
                </div>
              </div>

              {/* Right: Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Popover>
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
                          className="p-2 hover:bg-muted rounded text-xl"
                          onClick={() => {/* TODO: Add contract-level reaction */}}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="sm" className="gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Comment</span>
                </Button>
              </div>
            </div>
            <ContractViewer
              contract={contract}
              currentUserDid={user?.did}
              initialSelectedLine={initialLine}
              initialLineRange={initialRange}
            />
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
