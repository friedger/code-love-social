import { useState, useEffect, useCallback } from "react";
import {
  login as bffLogin,
  logout as bffLogout,
  getSession,
  handleCallback,
  getSessionToken,
  type AtprotoUser,
} from "@/lib/atproto-auth";

interface UseAtprotoAuthReturn {
  user: AtprotoUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (handle: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAtprotoAuth(): UseAtprotoAuthReturn {
  const [user, setUser] = useState<AtprotoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if we're returning from OAuth callback
        const callbackToken = handleCallback();
        
        // Check for existing session
        if (callbackToken || getSessionToken()) {
          const sessionUser = await getSession();
          if (sessionUser) {
            setUser(sessionUser);
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
        // Don't set error for init failures - user just isn't logged in
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const login = useCallback(async (handle: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await bffLogin(handle);
      // bffLogin redirects, so we won't reach here
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await bffLogout();
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
  };
}

// Re-export the user type for convenience
export type { AtprotoUser } from "@/lib/atproto-auth";
