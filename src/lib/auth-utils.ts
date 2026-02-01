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
export type AuthType = "atproto" | "nostr" | "matrix";

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
