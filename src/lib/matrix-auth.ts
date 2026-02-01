// Matrix.org authentication
// Uses the Matrix Client-Server API for password-based login

import { getStoredSession, setStoredSession, clearStoredSession } from "./auth-utils";

const MATRIX_SESSION_KEY = "matrix_session";

// Default homeserver - can be overridden via VITE_MATRIX_HOMESERVER env variable
export const DEFAULT_MATRIX_HOMESERVER = "https://matrix.org";

export function getMatrixHomeserver(): string {
  return import.meta.env.VITE_MATRIX_HOMESERVER || DEFAULT_MATRIX_HOMESERVER;
}

export interface MatrixUser {
  userId: string; // e.g., @user:matrix.org
  displayName: string;
  avatar?: string;
  accessToken: string;
  homeserver: string;
  deviceId?: string;
  authType: "matrix";
}

interface MatrixLoginResponse {
  user_id: string;
  access_token: string;
  home_server: string;
  device_id?: string;
}

interface MatrixProfileResponse {
  displayname?: string;
  avatar_url?: string;
}

interface MatrixErrorResponse {
  errcode: string;
  error: string;
}

// Resolve the homeserver URL from a user ID or server name
export async function resolveHomeserver(userIdOrServer: string): Promise<string> {
  // If it's a full user ID like @user:matrix.org, extract the server
  let serverName: string;
  if (userIdOrServer.startsWith("@")) {
    const colonIndex = userIdOrServer.indexOf(":");
    if (colonIndex === -1) {
      throw new Error("Invalid Matrix user ID format. Expected @user:server.org");
    }
    serverName = userIdOrServer.slice(colonIndex + 1);
  } else {
    serverName = userIdOrServer;
  }

  // Try well-known lookup first
  try {
    const wellKnownResponse = await fetch(
      `https://${serverName}/.well-known/matrix/client`
    );
    if (wellKnownResponse.ok) {
      const data = await wellKnownResponse.json();
      if (data["m.homeserver"]?.base_url) {
        return data["m.homeserver"].base_url.replace(/\/$/, "");
      }
    }
  } catch {
    // Well-known lookup failed, try direct connection
  }

  // Fallback to direct HTTPS connection
  return `https://${serverName}`;
}

// Login with Matrix username and password
export async function matrixLogin(
  userId: string,
  password: string
): Promise<MatrixUser> {
  const homeserver = await resolveHomeserver(userId);

  // Extract the localpart from the user ID
  const user = userId.startsWith("@") ? userId : `@${userId}`;

  const response = await fetch(`${homeserver}/_matrix/client/v3/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "m.login.password",
      identifier: {
        type: "m.id.user",
        user: user,
      },
      password: password,
      initial_device_display_name: "Source of Clarity",
    }),
  });

  if (!response.ok) {
    const error: MatrixErrorResponse = await response.json();
    if (error.errcode === "M_FORBIDDEN") {
      throw new Error("Invalid username or password");
    }
    throw new Error(error.error || "Login failed");
  }

  const data: MatrixLoginResponse = await response.json();

  // Create user object
  const matrixUser: MatrixUser = {
    userId: data.user_id,
    displayName: data.user_id.split(":")[0].slice(1), // Default to localpart
    accessToken: data.access_token,
    homeserver: homeserver,
    deviceId: data.device_id,
    authType: "matrix",
  };

  // Try to fetch profile
  try {
    const profile = await fetchMatrixProfile(homeserver, data.user_id, data.access_token);
    if (profile.displayname) {
      matrixUser.displayName = profile.displayname;
    }
    if (profile.avatar_url) {
      matrixUser.avatar = convertMxcToHttp(profile.avatar_url, homeserver);
    }
  } catch (err) {
    console.warn("Failed to fetch Matrix profile:", err);
  }

  // Store session
  setMatrixSession(matrixUser);

  return matrixUser;
}

// Fetch user profile
async function fetchMatrixProfile(
  homeserver: string,
  userId: string,
  accessToken: string
): Promise<MatrixProfileResponse> {
  const response = await fetch(
    `${homeserver}/_matrix/client/v3/profile/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch profile");
  }

  return response.json();
}

// Convert mxc:// URL to HTTP URL
function convertMxcToHttp(mxcUrl: string, homeserver: string): string {
  if (!mxcUrl.startsWith("mxc://")) {
    return mxcUrl;
  }
  
  const parts = mxcUrl.slice(6).split("/");
  if (parts.length !== 2) {
    return mxcUrl;
  }
  
  const [serverName, mediaId] = parts;
  return `${homeserver}/_matrix/media/v3/thumbnail/${serverName}/${mediaId}?width=96&height=96&method=crop`;
}

// Session management
export function getMatrixSession(): MatrixUser | null {
  return getStoredSession<MatrixUser>(MATRIX_SESSION_KEY);
}

export function setMatrixSession(user: MatrixUser): void {
  setStoredSession(MATRIX_SESSION_KEY, user);
}

export function clearMatrixSession(): void {
  clearStoredSession(MATRIX_SESSION_KEY);
}

// Logout
export async function matrixLogout(): Promise<void> {
  const session = getMatrixSession();
  
  if (session) {
    try {
      // Invalidate the access token on the server
      await fetch(`${session.homeserver}/_matrix/client/v3/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    } catch (err) {
      console.warn("Failed to logout from Matrix server:", err);
    }
  }
  
  clearMatrixSession();
}

// Validate if a session is still valid
export async function validateMatrixSession(session: MatrixUser): Promise<boolean> {
  try {
    const response = await fetch(
      `${session.homeserver}/_matrix/client/v3/account/whoami`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
