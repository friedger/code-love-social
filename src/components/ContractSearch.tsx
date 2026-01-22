import { Contract } from "@/types/contract";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileCode, Loader2 } from "lucide-react";

interface ContractSearchProps {
  contracts: Contract[];
  isLoading: boolean;
  onSelect: (contract: Contract) => void;
  selectedId?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ContractSearch({ contracts, isLoading, onSelect, selectedId, searchQuery, onSearchChange }: ContractSearchProps) {

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading contracts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contracts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No contracts found
          </p>
        ) : (
          contracts.map((contract) => (
            <Card
              key={contract.id}
              className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                selectedId === contract.id ? "bg-accent border-primary" : ""
              }`}
              onClick={() => onSelect(contract)}
            >
              <div className="flex items-start gap-3">
                <FileCode className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-sm text-foreground truncate">
                      {contract.name}
                    </span>
                    {contract.category && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {contract.category}
                      </Badge>
                    )}
                  </div>
                  {contract.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {contract.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
