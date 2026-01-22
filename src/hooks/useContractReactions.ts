import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContractReactions, addContractReaction, type ContractReactionsResponse } from "@/lib/comments-api";

export const contractReactionKeys = {
  all: ["contract-reactions"] as const,
  contract: (principal: string, contractName: string) =>
    [...contractReactionKeys.all, principal, contractName] as const,
};

export function useContractReactions(principal: string, contractName: string) {
  return useQuery({
    queryKey: contractReactionKeys.contract(principal, contractName),
    queryFn: () => getContractReactions(principal, contractName),
    enabled: !!principal && !!contractName,
  });
}

export function useAddContractReaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: {
      principal: string;
      contractName: string;
      txId?: string;
      emoji: string;
    }) => addContractReaction(params.principal, params.contractName, params.txId, params.emoji),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: contractReactionKeys.contract(vars.principal, vars.contractName),
      });
    },
  });
}

export type { ContractReactionsResponse };
