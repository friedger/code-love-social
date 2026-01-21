import { useState } from "react";
import { contracts, Contract, searchContracts } from "@/data/dummyContracts";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileCode } from "lucide-react";

interface ContractSearchProps {
  onSelect: (contract: Contract) => void;
  selectedId?: string;
}

export function ContractSearch({ onSelect, selectedId }: ContractSearchProps) {
  const [query, setQuery] = useState("");
  const filtered = query ? searchContracts(query) : contracts;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contracts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        {filtered.map((contract) => (
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
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {contract.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {contract.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
