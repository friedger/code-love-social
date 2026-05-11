// Nostr authentication
// Supports three signer types:
//   - "extension": NIP-07 browser extension (Alby, nos2x, ...)
//   - "nsec": raw nsec1… private key stored in this browser's localStorage
//   - "bunker": NIP-46 remote signer connected via bunker:// URL or NIP-05

import { nip19 } from "nostr-tools";
import { getStoredSession, setStoredSession, clearStoredSession } from "./auth-utils";
import {
  Nip46Signer,
  NsecSigner,
  type RemoteSigner,
} from "./nostr-extra-signers";
import type { BunkerPointer } from "nostr-tools/nip46";

const NOSTR_SESSION_KEY = "nostr_session";
const NOSTR_NSEC_KEY = "nostr_nsec_seckey";
const NOSTR_BUNKER_KEY = "nostr_bunker_session";

// Default relay - can be overridden via VITE_NOSTR_RELAY env variable
export const DEFAULT_NOSTR_RELAY = "wss://relay.damus.io";

export function getNostrRelay(): string {
  return import.meta.env.VITE_NOSTR_RELAY || DEFAULT_NOSTR_RELAY;
}

export type NostrSignerType = "extension" | "nsec" | "bunker";

export interface NostrUser {
  pubkey: string; // hex public key
  npub: string; // bech32 encoded public key
  displayName: string;
  avatar?: string;
  authType: "nostr";
  signerType: NostrSignerType;
}

interface BunkerPersist {
  pointer: BunkerPointer;
  clientSecretHex: string;
}

// Active remote signer (nsec or bunker). Lazily constructed.
let activeRemoteSigner: RemoteSigner | null = null;

// Check if NIP-07 extension is available
export function hasNostrExtension(): boolean {
  return typeof window !== "undefined" && "nostr" in window;
}

// Wait for NIP-07 extension to be available (some extensions load async)
export async function waitForNostrExtension(timeout = 3000): Promise<boolean> {
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

function getNostrExtension(): NonNullable<Window["nostr"]> {
  if (!hasNostrExtension()) {
    throw new Error(
      "Nostr extension not found. Please install a NIP-07 compatible extension like Alby or nos2x."
    );
  }
  return window.nostr!;
}

async function buildUserFromPubkey(
  pubkey: string,
  signerType: NostrSignerType,
): Promise<NostrUser> {
  const npub = nip19.npubEncode(pubkey);
  const user: NostrUser = {
    pubkey,
    npub,
    displayName: npub.slice(0, 12) + "...",
    authType: "nostr",
    signerType,
  };
  try {
    const profile = await fetchNostrProfile(pubkey);
    if (profile) {
      user.displayName =
        profile.name || profile.display_name || user.displayName;
      user.avatar = profile.picture;
    }
  } catch (err) {
    console.warn("Failed to fetch Nostr profile:", err);
  }
  return user;
}

// ---------- Login: NIP-07 extension ----------
export async function nostrLogin(): Promise<NostrUser> {
  const nostr = getNostrExtension();
  const pubkey = await nostr.getPublicKey();
  if (!pubkey) throw new Error("Failed to get public key from Nostr extension");
  const user = await buildUserFromPubkey(pubkey, "extension");
  setNostrSession(user);
  return user;
}

// ---------- Login: nsec ----------
export async function nostrLoginWithNsec(nsec: string): Promise<NostrUser> {
  const signer = NsecSigner.fromNsec(nsec);
  const pubkey = await signer.getPublicKey();
  const user = await buildUserFromPubkey(pubkey, "nsec");
  localStorage.setItem(NOSTR_NSEC_KEY, signer.seckeyHex);
  activeRemoteSigner = signer;
  setNostrSession(user);
  return user;
}

// ---------- Login: NIP-46 bunker ----------
export async function nostrLoginWithBunker(
  bunkerInput: string,
  onauth?: (url: string) => void,
): Promise<NostrUser> {
  const signer = await Nip46Signer.connect(bunkerInput, { onauth });
  const pubkey = await signer.getPublicKey();
  const user = await buildUserFromPubkey(pubkey, "bunker");
  const persist: BunkerPersist = {
    pointer: signer.pointer,
    clientSecretHex: signer.clientSecretHex,
  };
  localStorage.setItem(NOSTR_BUNKER_KEY, JSON.stringify(persist));
  activeRemoteSigner = signer;
  setNostrSession(user);
  return user;
}

// ---------- Active signer resolution ----------
async function getActiveSigner(): Promise<RemoteSigner | null> {
  if (activeRemoteSigner) return activeRemoteSigner;
  const session = getNostrSession();
  if (!session) return null;
  if (session.signerType === "nsec") {
    const hex = localStorage.getItem(NOSTR_NSEC_KEY);
    if (!hex) return null;
    activeRemoteSigner = NsecSigner.fromHex(hex);
    return activeRemoteSigner;
  }
  if (session.signerType === "bunker") {
    const raw = localStorage.getItem(NOSTR_BUNKER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as BunkerPersist;
      activeRemoteSigner = await Nip46Signer.rehydrate(
        parsed.pointer,
        parsed.clientSecretHex,
      );
      return activeRemoteSigner;
    } catch (err) {
      console.warn("Failed to rehydrate bunker signer:", err);
      return null;
    }
  }
  return null;
}

// ---------- Profile fetch ----------
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
      ws.send(
        JSON.stringify(["REQ", subId, { kinds: [0], authors: [pubkey], limit: 1 }]),
      );
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

// ---------- Session management ----------
export function getNostrSession(): NostrUser | null {
  const session = getStoredSession<NostrUser>(NOSTR_SESSION_KEY);
  if (session && !session.signerType) {
    // Backwards-compatible default for sessions saved before signerType existed.
    session.signerType = "extension";
  }
  return session;
}

export function setNostrSession(user: NostrUser): void {
  setStoredSession(NOSTR_SESSION_KEY, user);
}

export function clearNostrSession(): void {
  clearStoredSession(NOSTR_SESSION_KEY);
  localStorage.removeItem(NOSTR_NSEC_KEY);
  localStorage.removeItem(NOSTR_BUNKER_KEY);
}

export async function nostrLogout(): Promise<void> {
  if (activeRemoteSigner?.dispose) {
    try {
      await activeRemoteSigner.dispose();
    } catch (err) {
      console.warn("Error disposing nostr signer:", err);
    }
  }
  activeRemoteSigner = null;
  clearNostrSession();
}

// ---------- Signing ----------
export async function signEvent(event: UnsignedEvent): Promise<SignedEvent> {
  const session = getNostrSession();
  if (session && session.signerType !== "extension") {
    const signer = await getActiveSigner();
    if (!signer) {
      throw new Error(
        "Nostr signer is not available. Please sign in again.",
      );
    }
    return signer.signEvent(event);
  }
  const nostr = getNostrExtension();
  return nostr.signEvent(event);
}

// ---------- Types ----------
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
