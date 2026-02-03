import { Link } from "react-router-dom";
import { Copy, ExternalLink } from "lucide-react";
import { ContractIdenticon } from "@/components/ContractIdenticon";
import { formatContractIdShort, getContractPath } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RelatedContract } from "@/hooks/useRelatedContracts";

interface RelatedContractsListProps {
  contracts: RelatedContract[];
}

export function RelatedContractsList({ contracts }: RelatedContractsListProps) {
  if (contracts.length === 0) return null;

  return (
    <div className="border rounded-lg bg-card">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">
            Identical Contracts ({contracts.length})
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Other contracts with the same source code
        </p>
      </div>
      <div className="divide-y max-h-80 overflow-y-auto">
        {contracts.map((contract) => {
          const contractPath = getContractPath(contract.principal, contract.name);
          const identiconValue = contract.source_hash || contractPath;
          
          return (
            <Link
              key={contract.id}
              to={`/contract/${contractPath}`}
              className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
            >
              <ContractIdenticon
                value={identiconValue}
                size={32}
              />
            <div className="flex-1 min-w-0">
              <div className="font-mono font-medium text-sm truncate">
                {contract.name}
              </div>
              <div className="font-mono text-xs text-muted-foreground truncate">
                {formatContractIdShort(contract.principal, contract.name)}
              </div>
            </div>
            {contract.category && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {contract.category}
              </Badge>
            )}
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        );
        })}
      </div>
    </div>
  );
}
