import { useState, useEffect, useCallback } from "react";
import {
  nostrLogin,
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
  logout: () => void;
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

        // Check for extension
        const extensionAvailable = await waitForNostrExtension(2000);
        setHasExtension(extensionAvailable);

        // Check for existing session
        const sessionUser = getNostrSession();
        if (sessionUser) {
          setUser(sessionUser);
        }
      } catch (err) {
        console.error("Nostr auth init error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!hasNostrExtension()) {
        throw new Error(
          "No Nostr extension found. Please install Alby, nos2x, or another NIP-07 compatible extension."
        );
      }

      const loggedInUser = await nostrLogin();
      setUser(loggedInUser);
    } catch (err) {
      console.error("Nostr login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    nostrLogout();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    hasExtension,
    login,
    logout,
  };
}

export type { NostrUser } from "@/lib/nostr-auth";
