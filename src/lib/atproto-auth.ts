// BFF (Backend for Frontend) client for AT Protocol OAuth
// This client communicates with the Edge Function that handles the OAuth flow

const BFF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atproto-auth`;

const SESSION_KEY = "atproto_session_token";

export interface AtprotoUser {
  did: string;
  handle: string;
  displayName: string;
  avatar?: string;
}

// Get stored session token
export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

// Store session token
export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

// Clear session token
export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

// Start login flow - redirects to authorization server
export async function login(handle: string): Promise<void> {
  const returnUrl = window.location.origin;
  
  const response = await fetch(
    `${BFF_URL}/login?handle=${encodeURIComponent(handle)}&return_url=${encodeURIComponent(returnUrl)}`
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }
  
  const data = await response.json();
  
  // Redirect to authorization URL
  window.location.href = data.authorization_url;
}

// Get current session from BFF
export async function getSession(): Promise<AtprotoUser | null> {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    return null;
  }
  
  try {
    const response = await fetch(`${BFF_URL}/session`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
    
    if (!response.ok) {
      // Session is invalid, clear it
      clearSessionToken();
      return null;
    }
    
    return response.json();
  } catch (error) {
    console.error("Failed to get session:", error);
    clearSessionToken();
    return null;
  }
}

// Logout - revoke session
export async function logout(): Promise<void> {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    return;
  }
  
  try {
    await fetch(`${BFF_URL}/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    clearSessionToken();
  }
}

// Handle OAuth callback - extract session token from URL
export function handleCallback(): string | null {
  const url = new URL(window.location.href);
  const sessionToken = url.searchParams.get("session");
  
  if (sessionToken) {
    setSessionToken(sessionToken);
    // Clean up URL
    url.searchParams.delete("session");
    window.history.replaceState({}, "", url.pathname);
    return sessionToken;
  }
  
  return null;
}
