import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { ContractIdenticon } from "./ContractIdenticon";

interface ContractMatchCardProps {
  principal: string;
  contractName: string;
  txId?: string;
}

/**
 * Ellipse a Stacks address for display
 */
function ellipseAddress(address: string, prefixChars = 6, suffixChars = 4): string {
  if (address.length <= prefixChars + suffixChars + 3) return address;
  return `${address.slice(0, prefixChars)}...${address.slice(-suffixChars)}`;
}

export function ContractMatchCard({ principal, contractName, txId }: ContractMatchCardProps) {
  const contractPath = `${principal}.${contractName}`;

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className="p-3">
        <Link
          to={`/contract/${contractPath}`}
          className="flex items-center gap-2"
        >
          <ContractIdenticon
            value={contractPath}
            size={24}
            className="shrink-0 rounded-sm"
          />
          <div className="font-mono text-sm text-muted-foreground truncate">
            {ellipseAddress(principal)}.{contractName}
          </div>
        </Link>
        {txId && (
          <a
            href={`https://explorer.stxer.xyz/txid/${txId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-2 ml-8"
            onClick={(e) => e.stopPropagation()}
          >
            <span>View TX</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export default ContractMatchCard;
