import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { getContractPath } from "@/lib/utils";
import { ContractListItem } from "./ContractListItem";

interface ContractMatchCardProps {
  principal: string;
  contractName: string;
  txId?: string;
}

export function ContractMatchCard({ principal, contractName, txId }: ContractMatchCardProps) {
  const contractPath = getContractPath(principal, contractName);

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className="p-3">
        <Link to={`/contract/${contractPath}`}>
          <ContractListItem
            principal={principal}
            contractName={contractName}
            txId={txId}
            showTxLink
            size="sm"
          />
        </Link>
      </CardContent>
    </Card>
  );
}

export default ContractMatchCard;
