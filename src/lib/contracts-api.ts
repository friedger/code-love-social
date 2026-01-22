import { Contract } from "@/types/contract";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface AddContractParams {
  network: "mainnet" | "testnet";
  txId: string;
  description?: string;
  category?: string;
}

export interface AddContractResponse {
  success: boolean;
  contract: Contract;
  message: string;
}

export async function addContract(params: AddContractParams): Promise<AddContractResponse> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/add-contract`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to add contract");
  }

  return data;
}
