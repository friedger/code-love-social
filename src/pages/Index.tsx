import { useState } from "react";
import { contracts, Contract } from "@/data/dummyContracts";
import { ContractSearch } from "@/components/ContractSearch";
import { ContractViewer } from "@/components/ContractViewer";
import { AuthButton } from "@/components/AuthButton";
import { useAtprotoAuth } from "@/hooks/useAtprotoAuth";
import { FileCode } from "lucide-react";

const Index = () => {
  const [selectedContract, setSelectedContract] = useState<Contract>(contracts[0]);
  const { user, isLoading, login, logout } = useAtprotoAuth();

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
            isLoading={isLoading}
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
            <ContractSearch onSelect={setSelectedContract} selectedId={selectedContract?.id} />
          </aside>

          {/* Contract Viewer */}
          <main className="flex-1 min-w-0">
            {selectedContract ? (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground">{selectedContract.name}</h2>
                  <p className="text-muted-foreground">{selectedContract.description}</p>
                </div>
                <ContractViewer contract={selectedContract} currentUserDid={user?.did} />
              </>
            ) : (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                Select a contract to view
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;
