import { Link } from "react-router-dom";
import { ContractIdenticon } from "@/components/ContractIdenticon";
import { getContractPath } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy } from "lucide-react";
import type { RelatedContract } from "@/hooks/useRelatedContracts";

interface RelatedContractsIconsProps {
  contracts: RelatedContract[];
  maxVisible?: number;
}

export function RelatedContractsIcons({ contracts, maxVisible = 5 }: RelatedContractsIconsProps) {
  if (contracts.length === 0) return null;

  const visible = contracts.slice(0, maxVisible);
  const hiddenCount = contracts.length - maxVisible;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border mb-4">
        <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground shrink-0">
          {contracts.length} identical contract{contracts.length !== 1 ? "s" : ""}:
        </span>
        <div className="flex items-center gap-1 overflow-x-auto">
          {visible.map((contract) => {
            const contractPath = getContractPath(contract.principal, contract.name);
            const identiconValue = contract.source_hash || contractPath;
            
            return (
              <Tooltip key={contract.id}>
                <TooltipTrigger asChild>
                  <Link
                    to={`/contract/${contractPath}`}
                    className="shrink-0 rounded hover:ring-2 hover:ring-primary/50 transition-all"
                  >
                    <ContractIdenticon value={identiconValue} size={28} className="rounded" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-mono text-xs">{contract.name}</p>
                  <p className="text-xs text-muted-foreground">{contract.principal.slice(0, 8)}…</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {hiddenCount > 0 && (
            <span className="text-xs text-muted-foreground px-2">
              +{hiddenCount} more
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
