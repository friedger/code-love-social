import { ContractIdenticon } from "./ContractIdenticon";
import { formatContractId, getContractPath } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface ContractHeaderProps {
  principal: string;
  contractName: string;
  txId?: string | null;
  description?: string | null;
  actions?: React.ReactNode;
}

export function ContractHeader({
  principal,
  contractName,
  txId,
  description,
  actions,
}: ContractHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      {/* Left: Contract identity */}
      <div className="flex items-start gap-3 min-w-0">
        <ContractIdenticon 
          value={getContractPath(principal, contractName)} 
          size={48} 
          className="shrink-0 rounded" 
        />
        <div className="min-w-0">
          <h2 className="font-mono text-lg text-foreground truncate">
            {formatContractId(principal, contractName)}
          </h2>
          {txId && (
            <a
              href={`https://explorer.stxer.xyz/txid/${txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {description && (
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* Right: Action buttons */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

export default ContractHeader;
