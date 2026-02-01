import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Contract } from "@/types/contract";
import { useContracts } from "@/hooks/useContracts";
import { useCategories } from "@/hooks/useCategories";
import { CategoryFilter } from "@/components/CategoryFilter";
import { ContractExplorerCard } from "@/components/ContractExplorerCard";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, AlertTriangle, Home, Search, Plus } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Index = () => {
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user, isLoading: authLoading, hasNostrExtension, loginWithAtproto, loginWithNostr, loginWithMatrix, logout } = useAuth();
  const { data: contracts, isLoading, isFetching } = useContracts(debouncedSearch);
  const { data: categories } = useCategories();

  // Debounce search - only update after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Filter contracts by category
  const filteredContracts = useMemo(() => {
    if (!contracts) return [];
    if (!selectedCategory) return contracts;
    return contracts.filter((c) => c.category === selectedCategory);
  }, [contracts, selectedCategory]);

  // Get user ID based on auth type
  const currentUserId = user?.id;

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
        <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={logo} alt="Source of Clarity" className="h-7 w-7 sm:h-8 sm:w-8" />
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg text-foreground">Source of Clarity</h1>
              <p className="text-xs text-muted-foreground">Discuss smart contracts on the Stacks blockchain.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="gap-1.5">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/add" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Contract</span>
              </Link>
            </Button>
            <AuthButton
              user={user}
              isLoading={authLoading}
              hasNostrExtension={hasNostrExtension}
              onLoginAtproto={loginWithAtproto}
              onLoginNostr={loginWithNostr}
              onLoginMatrix={loginWithMatrix}
              onLogout={logout}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contracts by name, description, or category..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-10 pr-10"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          
          {categories && categories.length > 0 && (
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          )}
        </div>

        {/* Contract Cards */}
        {isLoading && !contracts ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading contracts...
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center px-4">
            <p className="mb-4">
              {contracts && contracts.length === 0
                ? "No contracts found"
                : "No contracts in this category"}
            </p>
            <Button variant="outline" asChild>
              <Link to="/add">
                <Plus className="h-4 w-4 mr-2" />
                Add a Contract
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredContracts.map((contract) => (
              <ContractExplorerCard
                key={contract.id}
                contract={contract}
                currentUserDid={currentUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
