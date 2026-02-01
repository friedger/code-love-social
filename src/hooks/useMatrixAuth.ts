import { useState, useEffect, useCallback } from "react";
import {
  matrixLogin,
  matrixLogout,
  getMatrixSession,
  validateMatrixSession,
  type MatrixUser,
} from "@/lib/matrix-auth";

interface UseMatrixAuthReturn {
  user: MatrixUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (userId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useMatrixAuth(): UseMatrixAuthReturn {
  const [user, setUser] = useState<MatrixUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check for existing session
        const session = getMatrixSession();
        if (session) {
          // Validate the session is still valid
          const isValid = await validateMatrixSession(session);
          if (isValid) {
            setUser(session);
          } else {
            // Session expired, clear it
            await matrixLogout();
          }
        }
      } catch (err) {
        console.error("Matrix auth init error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const login = useCallback(async (userId: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const loggedInUser = await matrixLogin(userId, password);
      setUser(loggedInUser);
    } catch (err) {
      console.error("Matrix login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await matrixLogout();
      setUser(null);
    } catch (err) {
      console.error("Matrix logout error:", err);
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

export type { MatrixUser } from "@/lib/matrix-auth";
