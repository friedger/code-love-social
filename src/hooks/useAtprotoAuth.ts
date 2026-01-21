import { useState, useEffect, useCallback } from "react";
import { Agent } from "@atproto/api";
import { initOAuth, signIn, signOut, getOAuthClient } from "@/lib/atproto-oauth";
import type { OAuthSession } from "@atproto/oauth-client-browser";

export interface AtprotoUser {
  did: string;
  handle: string;
  displayName: string;
  avatar?: string;
}

interface UseAtprotoAuthReturn {
  user: AtprotoUser | null;
  agent: Agent | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (handle: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAtprotoAuth(): UseAtprotoAuthReturn {
  const [user, setUser] = useState<AtprotoUser | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (session: OAuthSession) => {
    try {
      const userAgent = new Agent(session);
      const profile = await userAgent.getProfile({ actor: session.did });
      
      setAgent(userAgent);
      setUser({
        did: session.did,
        handle: profile.data.handle,
        displayName: profile.data.displayName || profile.data.handle,
        avatar: profile.data.avatar,
      });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to fetch user profile");
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await initOAuth();
        
        if (result?.session) {
          await fetchProfile(result.session);
        }
      } catch (err) {
        console.error("OAuth init error:", err);
        // Don't set error for init failures - user just isn't logged in
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    // Listen for session events
    const setupEventListeners = async () => {
      try {
        const client = await getOAuthClient();
        
        client.addEventListener("deleted", (event: CustomEvent<{ sub: string }>) => {
          if (user?.did === event.detail.sub) {
            setUser(null);
            setAgent(null);
          }
        });
      } catch (err) {
        console.error("Failed to setup event listeners:", err);
      }
    };

    setupEventListeners();
  }, [fetchProfile]);

  const login = useCallback(async (handle: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn(handle);
      // signIn redirects, so we won't reach here
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      await signOut(user.did);
      setUser(null);
      setAgent(null);
    } catch (err) {
      console.error("Logout error:", err);
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    user,
    agent,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
  };
}
