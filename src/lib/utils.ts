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
