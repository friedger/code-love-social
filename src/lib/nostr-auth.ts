// Nostr authentication using NIP-07 browser extension
// Supports extensions like Alby, nos2x, and other NIP-07 compatible signers

import { nip19 } from "nostr-tools";
import { getStoredSession, setStoredSession, clearStoredSession } from "./auth-utils";

const NOSTR_SESSION_KEY = "nostr_session";

// Default relay - can be overridden via VITE_NOSTR_RELAY env variable
export const DEFAULT_NOSTR_RELAY = "wss://relay.damus.io";

export function getNostrRelay(): string {
  return import.meta.env.VITE_NOSTR_RELAY || DEFAULT_NOSTR_RELAY;
}

export interface NostrUser {
  pubkey: string; // hex public key
  npub: string; // bech32 encoded public key
  displayName: string;
  avatar?: string;
  authType: "nostr";
}

// Check if NIP-07 extension is available
export function hasNostrExtension(): boolean {
  return typeof window !== "undefined" && "nostr" in window;
}

// Wait for NIP-07 extension to be available (some extensions load async)
export async function waitForNostrExtension(
  timeout = 3000
): Promise<boolean> {
  if (hasNostrExtension()) return true;

  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (hasNostrExtension()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

// Get the nostr extension object with proper typing
function getNostrExtension(): Window["nostr"] {
  if (!hasNostrExtension()) {
    throw new Error("Nostr extension not found. Please install a NIP-07 compatible extension like Alby or nos2x.");
  }
  return window.nostr!;
}

// Login with NIP-07 extension
export async function nostrLogin(): Promise<NostrUser> {
  const nostr = getNostrExtension();
  
  // Request public key from extension
  const pubkey = await nostr.getPublicKey();
  
  if (!pubkey) {
    throw new Error("Failed to get public key from Nostr extension");
  }
  
  // Convert to npub format
  const npub = nip19.npubEncode(pubkey);
  
  // Create user object
  const user: NostrUser = {
    pubkey,
    npub,
    displayName: npub.slice(0, 12) + "...",
    authType: "nostr",
  };
  
  // Try to fetch profile from relay
  try {
    const profile = await fetchNostrProfile(pubkey);
    if (profile) {
      user.displayName = profile.name || profile.display_name || user.displayName;
      user.avatar = profile.picture;
    }
  } catch (err) {
    console.warn("Failed to fetch Nostr profile:", err);
  }
  
  // Store session
  setNostrSession(user);
  
  return user;
}

// Fetch profile from Nostr relay
async function fetchNostrProfile(pubkey: string): Promise<NostrProfile | null> {
  const relay = getNostrRelay();
  
  return new Promise((resolve) => {
    const ws = new WebSocket(relay);
    const subId = Math.random().toString(36).substring(2);
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        resolve(null);
      }
    }, 5000);
    
    ws.onopen = () => {
      // Request kind 0 (metadata) events for this pubkey
      ws.send(JSON.stringify(["REQ", subId, { kinds: [0], authors: [pubkey], limit: 1 }]));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data[0] === "EVENT" && data[1] === subId) {
          const eventData = data[2];
          if (eventData.kind === 0) {
            const content = JSON.parse(eventData.content) as NostrProfile;
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve(content);
          }
        } else if (data[0] === "EOSE") {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve(null);
          }
        }
      } catch (err) {
        console.warn("Error parsing relay message:", err);
      }
    };
    
    ws.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        ws.close();
        resolve(null);
      }
    };
  });
}

interface NostrProfile {
  name?: string;
  display_name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
}

// Session management
export function getNostrSession(): NostrUser | null {
  return getStoredSession<NostrUser>(NOSTR_SESSION_KEY);
}

export function setNostrSession(user: NostrUser): void {
  setStoredSession(NOSTR_SESSION_KEY, user);
}

export function clearNostrSession(): void {
  clearStoredSession(NOSTR_SESSION_KEY);
}

// Logout
export function nostrLogout(): void {
  clearNostrSession();
}

// Sign an event using the extension
export async function signEvent(event: UnsignedEvent): Promise<SignedEvent> {
  const nostr = getNostrExtension();
  return nostr.signEvent(event);
}

// Types for Nostr events
export interface UnsignedEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey?: string;
}

export interface SignedEvent extends UnsignedEvent {
  id: string;
  sig: string;
  pubkey: string;
}

// Extend Window interface for NIP-07
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: UnsignedEvent) => Promise<SignedEvent>;
      getRelays?: () => Promise<Record<string, { read: boolean; write: boolean }>>;
      nip04?: {
        encrypt: (pubkey: string, plaintext: string) => Promise<string>;
        decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
      };
      nip44?: {
        encrypt: (pubkey: string, plaintext: string) => Promise<string>;
        decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
      };
    };
  }
}
