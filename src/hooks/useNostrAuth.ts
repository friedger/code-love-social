import { useState, useEffect, useCallback } from "react";
import {
  nostrLogin,
  nostrLoginWithNsec,
  nostrLoginWithBunker,
  nostrLogout,
  getNostrSession,
  hasNostrExtension,
  waitForNostrExtension,
  type NostrUser,
} from "@/lib/nostr-auth";

interface UseNostrAuthReturn {
  user: NostrUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  hasExtension: boolean;
  login: () => Promise<void>;
  loginWithNsec: (nsec: string) => Promise<void>;
  loginWithBunker: (
    input: string,
    onauth?: (url: string) => void,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

export function useNostrAuth(): UseNostrAuthReturn {
  const [user, setUser] = useState<NostrUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasExtension, setHasExtension] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const extensionAvailable = await waitForNostrExtension(2000);
        setHasExtension(extensionAvailable);
        const sessionUser = getNostrSession();
        if (sessionUser) setUser(sessionUser);
      } catch (err) {
        console.error("Nostr auth init error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

  const wrap = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setIsLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const login = useCallback(async () => {
    if (!hasNostrExtension()) {
      const msg =
        "No Nostr extension found. Please install Alby, nos2x, or another NIP-07 compatible extension.";
      setError(msg);
      throw new Error(msg);
    }
    const u = await wrap(() => nostrLogin());
    setUser(u);
  }, [wrap]);

  const loginWithNsec = useCallback(
    async (nsec: string) => {
      const u = await wrap(() => nostrLoginWithNsec(nsec));
      setUser(u);
    },
    [wrap],
  );

  const loginWithBunker = useCallback(
    async (input: string, onauth?: (url: string) => void) => {
      const u = await wrap(() => nostrLoginWithBunker(input, onauth));
      setUser(u);
    },
    [wrap],
  );

  const logout = useCallback(async () => {
    await nostrLogout();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    hasExtension,
    login,
    loginWithNsec,
    loginWithBunker,
    logout,
  };
}

export type { NostrUser } from "@/lib/nostr-auth";
