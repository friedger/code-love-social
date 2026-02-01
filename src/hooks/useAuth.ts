import { useState, useEffect, useCallback, useMemo } from "react";
import { useAtprotoAuth, type AtprotoUser } from "./useAtprotoAuth";
import { useNostrAuth, type NostrUser } from "./useNostrAuth";

export type AuthType = "atproto" | "nostr";

export interface UnifiedUser {
  id: string; // DID for atproto, npub for nostr
  displayName: string;
  handle?: string; // Only for atproto
  avatar?: string;
  authType: AuthType;
  // Original user objects for type-specific operations
  atprotoUser?: AtprotoUser;
  nostrUser?: NostrUser;
}

interface UseAuthReturn {
  user: UnifiedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  authType: AuthType | null;
  hasNostrExtension: boolean;
  loginWithAtproto: (handle: string) => Promise<void>;
  loginWithNostr: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const atproto = useAtprotoAuth();
  const nostr = useNostrAuth();

  // Combine loading states
  const isLoading = atproto.isLoading || nostr.isLoading;

  // Combine errors (prefer showing the most recent error)
  const [activeError, setActiveError] = useState<string | null>(null);

  useEffect(() => {
    if (atproto.error) setActiveError(atproto.error);
    else if (nostr.error) setActiveError(nostr.error);
    else setActiveError(null);
  }, [atproto.error, nostr.error]);

  // Determine the current user (prioritize the one that's logged in)
  const { user, authType } = useMemo((): {
    user: UnifiedUser | null;
    authType: AuthType | null;
  } => {
    if (atproto.user) {
      return {
        user: {
          id: atproto.user.did,
          displayName: atproto.user.displayName,
          handle: atproto.user.handle,
          avatar: atproto.user.avatar,
          authType: "atproto",
          atprotoUser: atproto.user,
        },
        authType: "atproto",
      };
    }

    if (nostr.user) {
      return {
        user: {
          id: nostr.user.npub,
          displayName: nostr.user.displayName,
          avatar: nostr.user.avatar,
          authType: "nostr",
          nostrUser: nostr.user,
        },
        authType: "nostr",
      };
    }

    return { user: null, authType: null };
  }, [atproto.user, nostr.user]);

  const loginWithAtproto = useCallback(
    async (handle: string) => {
      // Clear any existing nostr session first
      if (nostr.isAuthenticated) {
        nostr.logout();
      }
      await atproto.login(handle);
    },
    [atproto, nostr]
  );

  const loginWithNostr = useCallback(async () => {
    // Clear any existing atproto session first
    if (atproto.isAuthenticated) {
      await atproto.logout();
    }
    await nostr.login();
  }, [atproto, nostr]);

  const logout = useCallback(async () => {
    if (atproto.isAuthenticated) {
      await atproto.logout();
    }
    if (nostr.isAuthenticated) {
      nostr.logout();
    }
  }, [atproto, nostr]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error: activeError,
    authType,
    hasNostrExtension: nostr.hasExtension,
    loginWithAtproto,
    loginWithNostr,
    logout,
  };
}

export type { AtprotoUser, NostrUser };
