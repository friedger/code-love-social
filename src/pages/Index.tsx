import { useState, useEffect } from "react";
import { Contract } from "@/types/contract";
import { useContracts } from "@/hooks/useContracts";
import { ContractSearch } from "@/components/ContractSearch";
import { ContractViewer } from "@/components/ContractViewer";
import { AuthButton } from "@/components/AuthButton";
import { useAtprotoAuth } from "@/hooks/useAtprotoAuth";
import { FileCode, Loader2 } from "lucide-react";

const Index = () => {
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const { user, isLoading: authLoading, login, logout } = useAtprotoAuth();
  const { data: contracts, isLoading: contractsLoading } = useContracts();

  // Auto-select first contract when loaded
  useEffect(() => {
    if (contracts && contracts.length > 0 && !selectedContract) {
      setSelectedContract(contracts[0]);
    }
  }, [contracts, selectedContract]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCode className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-bold text-lg text-foreground">Clarity Social</h1>
              <p className="text-xs text-muted-foreground">Discuss smart contracts on AT Protocol</p>
            </div>
          </div>
          <AuthButton
            user={user}
            isLoading={authLoading}
            onLogin={login}
            onLogout={logout}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-80 shrink-0">
            <ContractSearch
              contracts={contracts ?? []}
              isLoading={contractsLoading}
              onSelect={setSelectedContract}
              selectedId={selectedContract?.id}
            />
          </aside>

          {/* Contract Viewer */}
          <main className="flex-1 min-w-0">
            {contractsLoading ? (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading contracts...
              </div>
            ) : selectedContract ? (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground">{selectedContract.name}</h2>
                  <p className="text-muted-foreground">{selectedContract.description}</p>
                </div>
                <ContractViewer contract={selectedContract} currentUserDid={user?.did} />
              </>
            ) : (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                {contracts && contracts.length === 0
                  ? "No contracts found"
                  : "Select a contract to view"}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;
