import { useParams, Link, useSearchParams } from "react-router-dom";
import { useContract } from "@/hooks/useContracts";
import { ContractViewer } from "@/components/ContractViewer";
import { useAtprotoAuth } from "@/hooks/useAtprotoAuth";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";

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
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-foreground">{contract.name}</h2>
              <p className="text-sm text-muted-foreground font-mono">{contract.principal}</p>
              {contract.description && (
                <p className="text-muted-foreground mt-1">{contract.description}</p>
              )}
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
