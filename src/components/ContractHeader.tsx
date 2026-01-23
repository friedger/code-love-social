import { ContractIdenticon } from "./ContractIdenticon";
import { formatContractId, getContractPath, getExplorerContractUrl } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface ContractHeaderProps {
  principal: string;
  contractName: string;
  txId?: string | null;
  sourceHash?: string | null;
  description?: string | null;
  actions?: React.ReactNode;
}

export function ContractHeader({
  principal,
  contractName,
  txId,
  sourceHash,
  description,
  actions,
}: ContractHeaderProps) {
  return (
    <div className="mb-4 sm:mb-6">
      {/* Stack on mobile, side-by-side on larger screens */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        {/* Left: Contract identity */}
        <div className="flex items-start gap-2 sm:gap-3 min-w-0">
          <ContractIdenticon 
            value={sourceHash || getContractPath(principal, contractName)} 
            size={40} 
            className="shrink-0 rounded sm:hidden" 
          />
          <ContractIdenticon 
            value={sourceHash || getContractPath(principal, contractName)} 
            size={48} 
            className="shrink-0 rounded hidden sm:block" 
          />
          <div className="min-w-0">
            <h2 className="font-mono text-base sm:text-lg text-foreground break-all">
              {formatContractId(principal, contractName)}
            </h2>
            <a
              href={getExplorerContractUrl(principal, contractName)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </a>
            {description && (
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">{description}</p>
            )}
          </div>
        </div>

        {/* Right: Action buttons - full width row on mobile */}
        {actions && (
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContractHeader;
