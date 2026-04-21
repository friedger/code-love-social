// Shared authentication utilities
// Common patterns for session management and auth state

// Session storage utilities
export function getStoredSession<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as T;
  } catch {
    return null;
  }
}

export function setStoredSession<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function clearStoredSession(key: string): void {
  localStorage.removeItem(key);
}

// Token storage (for opaque tokens like session tokens)
export function getStoredToken(key: string): string | null {
  return localStorage.getItem(key);
}

export function setStoredToken(key: string, token: string): void {
  localStorage.setItem(key, token);
}

export function clearStoredToken(key: string): void {
  localStorage.removeItem(key);
}

// Auth type definitions for unified auth system
export type AuthType = "atproto" | "nostr";

/**
 * Can a viewer with `viewerAuthType` (null if not signed in) interact with
 * content authored under `contentAuthType`? Cross-protocol writes aren't
 * supported: a Nostr user can't produce a valid NIP-22 reply to an at:// URI
 * because the parent id would have to be a 64-char hex event id; and an
 * atproto user can't produce a NIP-25 reaction. Reading across protocols
 * is fine — this only gates write intents (reply, react, delete).
 */
export function canInteractWith(
  viewerAuthType: AuthType | null | undefined,
  contentAuthType: AuthType,
): boolean {
  if (!viewerAuthType) return false;
  return viewerAuthType === contentAuthType;
}

export function crossProtocolMessage(contentAuthType: AuthType): string {
  const target = contentAuthType === "atproto" ? "Bluesky" : "Nostr";
  return `Sign in with ${target} to interact with this comment`;
}

export interface BaseUser {
  id: string;
  displayName: string;
  avatar?: string;
}

// Generic auth hook return type pattern
export interface AuthHookReturn<T extends BaseUser> {
  user: T | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (...args: unknown[]) => Promise<void>;
  logout: () => void | Promise<void>;
}
