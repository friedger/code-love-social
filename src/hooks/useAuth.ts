import { useState, useEffect, useCallback, useMemo } from "react";
import { useAtprotoAuth, type AtprotoUser } from "./useAtprotoAuth";
import { useNostrAuth, type NostrUser } from "./useNostrAuth";
import { useMatrixAuth, type MatrixUser } from "./useMatrixAuth";
import type { AuthType } from "@/lib/auth-utils";

export type { AuthType } from "@/lib/auth-utils";

export interface UnifiedUser {
  id: string; // DID for atproto, npub for nostr, userId for matrix
  displayName: string;
  handle?: string; // Only for atproto
  avatar?: string;
  authType: AuthType;
  // Original user objects for type-specific operations
  atprotoUser?: AtprotoUser;
  nostrUser?: NostrUser;
  matrixUser?: MatrixUser;
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
  loginWithMatrix: (userId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const atproto = useAtprotoAuth();
  const nostr = useNostrAuth();
  const matrix = useMatrixAuth();

  // Combine loading states
  const isLoading = atproto.isLoading || nostr.isLoading || matrix.isLoading;

  // Combine errors (prefer showing the most recent error)
  const [activeError, setActiveError] = useState<string | null>(null);

  useEffect(() => {
    if (atproto.error) setActiveError(atproto.error);
    else if (nostr.error) setActiveError(nostr.error);
    else if (matrix.error) setActiveError(matrix.error);
    else setActiveError(null);
  }, [atproto.error, nostr.error, matrix.error]);

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

    if (matrix.user) {
      return {
        user: {
          id: matrix.user.userId,
          displayName: matrix.user.displayName,
          avatar: matrix.user.avatar,
          authType: "matrix",
          matrixUser: matrix.user,
        },
        authType: "matrix",
      };
    }

    return { user: null, authType: null };
  }, [atproto.user, nostr.user, matrix.user]);

  const loginWithAtproto = useCallback(
    async (handle: string) => {
      // Clear other sessions first
      if (nostr.isAuthenticated) nostr.logout();
      if (matrix.isAuthenticated) await matrix.logout();
      await atproto.login(handle);
    },
    [atproto, nostr, matrix]
  );

  const loginWithNostr = useCallback(async () => {
    // Clear other sessions first
    if (atproto.isAuthenticated) await atproto.logout();
    if (matrix.isAuthenticated) await matrix.logout();
    await nostr.login();
  }, [atproto, nostr, matrix]);

  const loginWithMatrix = useCallback(
    async (userId: string, password: string) => {
      // Clear other sessions first
      if (atproto.isAuthenticated) await atproto.logout();
      if (nostr.isAuthenticated) nostr.logout();
      await matrix.login(userId, password);
    },
    [atproto, nostr, matrix]
  );

  const logout = useCallback(async () => {
    if (atproto.isAuthenticated) await atproto.logout();
    if (nostr.isAuthenticated) nostr.logout();
    if (matrix.isAuthenticated) await matrix.logout();
  }, [atproto, nostr, matrix]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error: activeError,
    authType,
    hasNostrExtension: nostr.hasExtension,
    loginWithAtproto,
    loginWithNostr,
    loginWithMatrix,
    logout,
  };
}

export type { AtprotoUser, NostrUser, MatrixUser };
