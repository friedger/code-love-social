import { BrowserOAuthClient } from "@atproto/oauth-client-browser";

const getClientMetadata = () => {
  const origin = window.location.origin;
  
  // Use loopback client for localhost AND preview environments
  // The loopback format bypasses the need for a hosted client-metadata.json
  // which avoids SPA routing redirect issues
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
  const isPreview = origin.includes("lovable.app");
  
  if (isLocalhost || isPreview) {
    // Loopback clients must use http://localhost (not 127.0.0.1) as the origin
    // The redirect_uri in the query string specifies where the user is redirected back
    return {
      client_id: `http://localhost?redirect_uri=${encodeURIComponent(origin + "/oauth/callback")}&scope=${encodeURIComponent("atproto transition:generic")}`,
      redirect_uris: [origin + "/oauth/callback"] as [string, ...string[]],
      scope: "atproto transition:generic",
      grant_types: ["authorization_code", "refresh_token"] as ["authorization_code", "refresh_token"],
      response_types: ["code"] as ["code"],
      token_endpoint_auth_method: "none" as const,
      application_type: "web" as const,
      dpop_bound_access_tokens: true,
    };
  }
  
  // For production environments with proper static file serving
  // The client_id must be on the same origin as client_uri per AT Protocol spec
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
