import { BrowserOAuthClient } from "@atproto/oauth-client-browser";

// For development, we use the loopback client metadata
// In production, you'd host client-metadata.json at your domain
const getClientMetadata = () => {
  const origin = window.location.origin;
  
  // For localhost only, use loopback configuration
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
    
  if (isLocalhost) {
    // Loopback clients must use http://127.0.0.1 format with query params
    return {
      client_id: `http://127.0.0.1/?redirect_uri=${encodeURIComponent(origin + "/oauth/callback")}&scope=${encodeURIComponent("atproto transition:generic")}`,
      redirect_uris: [origin + "/oauth/callback"] as [string, ...string[]],
      scope: "atproto transition:generic",
      grant_types: ["authorization_code", "refresh_token"] as ["authorization_code", "refresh_token"],
      response_types: ["code"] as ["code"],
      token_endpoint_auth_method: "none" as const,
      application_type: "web" as const,
      dpop_bound_access_tokens: true,
    };
  }
  
  // For production, use the hosted client metadata
  return {
    client_id: `${origin}/client-metadata.json`,
    redirect_uris: [origin + "/oauth/callback"] as [string, ...string[]],
    scope: "atproto transition:generic",
    grant_types: ["authorization_code", "refresh_token"] as ["authorization_code", "refresh_token"],
    response_types: ["code"] as ["code"],
    token_endpoint_auth_method: "none" as const,
    application_type: "web" as const,
    dpop_bound_access_tokens: true,
  };
};

let oauthClient: BrowserOAuthClient | null = null;

export const getOAuthClient = async (): Promise<BrowserOAuthClient> => {
  if (oauthClient) {
    return oauthClient;
  }
  
  const clientMetadata = getClientMetadata();
  
  oauthClient = new BrowserOAuthClient({
    clientMetadata,
    handleResolver: "https://bsky.social",
  });
  
  return oauthClient;
};

export const initOAuth = async () => {
  const client = await getOAuthClient();
  // init() will restore session from storage or handle callback if present
  const result = await client.init();
  return result;
};

export const signIn = async (handle: string) => {
  const client = await getOAuthClient();
  // This will redirect to the authorization server
  await client.signIn(handle, {
    signal: new AbortController().signal,
  });
};

export const signOut = async (did: string) => {
  const client = await getOAuthClient();
  await client.revoke(did);
};

export type { OAuthSession } from "@atproto/oauth-client-browser";
