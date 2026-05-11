import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ellipse a Stacks address for display
 */
export function ellipseAddress(
  address: string,
  prefixChars = 6,
  suffixChars = 6
): string {
  if (address.length <= prefixChars + suffixChars + 3) return address;
  return `${address.slice(0, prefixChars)}...${address.slice(-suffixChars)}`;
}

/**
 * Format a contract identifier for display (ellipsed principal + name)
 */
export function formatContractId(principal: string, contractName: string): string {
  return `${ellipseAddress(principal)}.${contractName}`;
}

/**
 * Format a contract identifier with a shorter address ellipse for tight spaces
 */
export function formatContractIdShort(principal: string, contractName: string): string {
  return `${ellipseAddress(principal, 4, 4)}.${contractName}`;
}

/**
 * Build a full contract path (unellipsed, for URLs/logic)
 */
export function getContractPath(principal: string, contractName: string): string {
  return `${principal}.${contractName}`;
}

/**
 * Strict typed reference to a Clarity contract.
 * Use this everywhere a contract needs to be identified visually or by URL.
 */
export interface ContractRef {
  principal: string;
  contractName: string;
}

/**
 * Single source of truth for the identicon seed.
 *
 * Always derived from `principal.contractName` so the same contract renders
 * the same identicon everywhere in the app, regardless of whether the caller
 * happens to know the source hash.
 *
 * Only accepts a typed {@link ContractRef} — never a free-form string.
 */
export function getContractIdenticonSeed(ref: ContractRef): string {
  if (!ref || typeof ref.principal !== "string" || typeof ref.contractName !== "string") {
    throw new Error("getContractIdenticonSeed: invalid ContractRef");
  }
  const principal = ref.principal.trim();
  const contractName = ref.contractName.trim();
  if (!principal || !contractName) {
    throw new Error("getContractIdenticonSeed: principal and contractName are required");
  }
  return `${principal}.${contractName}`;
}

/**
 * Determine if a Stacks address is on testnet
 * Testnet addresses start with "ST" or "SN"
 */
export function isTestnetAddress(address: string): boolean {
  return address.startsWith("ST") || address.startsWith("SN");
}

/**
 * Get the explorer URL for a contract based on the network
 */
export function getExplorerContractUrl(principal: string, contractName: string): string {
  const contractId = `${principal}.${contractName}`;
  if (isTestnetAddress(principal)) {
    return `https://explorer.hiro.so/txid/${contractId}?chain=testnet`;
  }
  return `https://explorer.stxer.xyz/txid/${contractId}`;
}
