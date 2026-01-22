import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContractIdenticon } from "./ContractIdenticon";
import { ellipseAddress, getContractPath } from "@/lib/utils";

interface ContractListItemProps {
  principal: string;
  contractName: string;
  txId?: string;
  sourceHash?: string;
  category?: string;
  description?: string;
  showDescription?: boolean;
  showTxLink?: boolean;
  size?: "sm" | "md";
  asLink?: boolean;
}

export function ContractListItem({
  principal,
  contractName,
  txId,
  sourceHash,
  category,
  description,
  showDescription = false,
  showTxLink = false,
  size = "sm",
  asLink = false,
}: ContractListItemProps) {
  const contractPath = getContractPath(principal, contractName);
  const identiconSize = size === "sm" ? 24 : 32;
  
  const content = (
    <div className="flex items-start gap-3">
      <ContractIdenticon
        value={sourceHash || contractPath}
        size={identiconSize}
        className="shrink-0 rounded-sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <span className="font-mono font-medium text-sm text-foreground block">
              {contractName}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {ellipseAddress(principal, 4, 4)}
            </span>
          </div>
          {category && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {category}
            </Badge>
          )}
        </div>
        {showDescription && description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {description}
          </p>
        )}
        {showTxLink && txId && (
          <a
            href={`https://explorer.stxer.xyz/txid/${txId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span>View TX</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link to={`/contract/${contractPath}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default ContractListItem;
