import { Link } from "react-router-dom";
import { getContractPath, formatContractIdShort } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border mb-4 overflow-x-auto">
        <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground shrink-0">
          Identical:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {visible.map((contract) => {
            const contractPath = getContractPath(contract.principal, contract.name);
            
            return (
              <Tooltip key={contract.id}>
                <TooltipTrigger asChild>
                  <Link to={`/contract/${contractPath}`}>
                    <Badge 
                      variant="secondary" 
                      className="font-mono text-xs hover:bg-primary/20 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {contract.name}
                    </Badge>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-mono text-xs">{formatContractIdShort(contract.principal, contract.name)}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {hiddenCount > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{hiddenCount} more
            </Badge>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
