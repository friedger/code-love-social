import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Contract } from "@/types/contract";
import { useContracts } from "@/hooks/useContracts";
import { ContractSearch } from "@/components/ContractSearch";
import { ContractViewer } from "@/components/ContractViewer";
import { ContractHeader } from "@/components/ContractHeader";
import { AuthButton } from "@/components/AuthButton";
import { useAtprotoAuth } from "@/hooks/useAtprotoAuth";
import { Loader2, AlertTriangle, Home } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { user, isLoading: authLoading, login, logout } = useAtprotoAuth();
  const { data: contracts, isLoading, isFetching } = useContracts(debouncedSearch);

  // Debounce search - only update after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Auto-select first contract when search results change
  useEffect(() => {
    if (contracts && contracts.length > 0) {
      setSelectedContract(contracts[0]);
    } else if (contracts && contracts.length === 0) {
      setSelectedContract(null);
    }
  }, [contracts]);

  return (
    <div className="min-h-screen bg-background">
      {/* Temporary Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
        <div className="container mx-auto flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>All comments are temporary and may require migration to a new namespace in the future.</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Source of Clarity" className="h-8 w-8" />
            <div>
              <h1 className="font-bold text-lg text-foreground">Source of Clarity</h1>
              <p className="text-xs text-muted-foreground">Discuss smart contracts on the Stacks blockchain.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="gap-1.5">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>
            <AuthButton
              user={user}
              isLoading={authLoading}
              onLogin={login}
              onLogout={logout}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-80 shrink-0">
            <ContractSearch
              contracts={contracts ?? []}
              isLoading={isLoading && !contracts}
              isFetching={isFetching}
              onSelect={setSelectedContract}
              selectedId={selectedContract?.id}
              searchQuery={inputValue}
              onSearchChange={setInputValue}
            />
          </aside>

          {/* Contract Viewer */}
          <main className="flex-1 min-w-0 relative">
            {isFetching && (
              <div className="absolute top-2 right-2 z-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {isLoading && !contracts ? (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading contracts...
              </div>
            ) : selectedContract ? (
              <>
                <ContractHeader
                  principal={selectedContract.principal}
                  contractName={selectedContract.name}
                  txId={selectedContract.tx_id}
                  description={selectedContract.description}
                />
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
