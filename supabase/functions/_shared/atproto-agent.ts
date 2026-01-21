// Shared AT Protocol agent helper with DPoP support
// Used by edge functions to create authenticated agents from stored sessions

import { Agent } from "npm:@atproto/api@^0.18.16";

export interface SessionData {
  did: string;
  pds_url: string;
  access_token: string;
  dpop_private_key_jwk: string;
  auth_server_url?: string;
}

// Helper to generate random string
function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

/**
 * Create a DPoP proof for a request
 */
export async function createDPoPProof(
  privateKey: CryptoKey,
  publicJwk: JsonWebKey,
  method: string,
  url: string,
  nonce?: string,
  ath?: string
): Promise<string> {
  const header = {
    alg: "ES256",
    typ: "dpop+jwt",
    jwk: {
      kty: publicJwk.kty,
      crv: publicJwk.crv,
      x: publicJwk.x,
      y: publicJwk.y,
    },
  };

  const payload: Record<string, unknown> = {
    jti: generateRandomString(16),
    htm: method,
    htu: url,
    iat: Math.floor(Date.now() / 1000),
  };

  if (nonce) payload.nonce = nonce;
  if (ath) payload.ath = ath;

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signatureInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    signatureInput
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Create access token hash (ath) for DPoP proof
 */
export async function createAccessTokenHash(accessToken: string): Promise<string> {
  const tokenHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accessToken)
  );
  return btoa(String.fromCharCode(...new Uint8Array(tokenHash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Import DPoP private key from JWK
 */
export async function importPrivateKey(privateJwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

/**
 * Extract public JWK from private JWK
 */
export function extractPublicJwk(privateJwk: JsonWebKey): JsonWebKey {
  return {
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
  };
}

/**
 * Stored DPoP nonce per host (for nonce reuse)
 */
const dpopNonces = new Map<string, string>();

/**
 * Create a custom fetch handler with DPoP support
 */
export function createDPoPFetch(
  privateKey: CryptoKey,
  publicJwk: JsonWebKey,
  accessToken: string
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || "GET").toUpperCase();
    const hostname = new URL(url).hostname;
    
    // Create access token hash
    const ath = await createAccessTokenHash(accessToken);
    
    // Get cached nonce for this host if available
    const cachedNonce = dpopNonces.get(hostname);
    
    // Generate DPoP proof
    const dpopProof = await createDPoPProof(
      privateKey,
      publicJwk,
      method,
      url,
      cachedNonce,
      ath
    );
    
    // Add headers
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `DPoP ${accessToken}`);
    headers.set("DPoP", dpopProof);
    
    let response = await fetch(input, { ...init, headers });
    
    // Handle DPoP nonce requirement (400 with DPoP-Nonce header)
    if (response.status === 400 || response.status === 401) {
      const newNonce = response.headers.get("DPoP-Nonce");
      if (newNonce && newNonce !== cachedNonce) {
        // Store the nonce for future requests
        dpopNonces.set(hostname, newNonce);
        
        // Retry with new nonce
        const retryProof = await createDPoPProof(
          privateKey,
          publicJwk,
          method,
          url,
          newNonce,
          ath
        );
        
        headers.set("DPoP", retryProof);
        response = await fetch(input, { ...init, headers });
        
        // Update nonce from retry response if present
        const updatedNonce = response.headers.get("DPoP-Nonce");
        if (updatedNonce) {
          dpopNonces.set(hostname, updatedNonce);
        }
      }
    } else {
      // Update nonce from successful response if present
      const responseNonce = response.headers.get("DPoP-Nonce");
      if (responseNonce) {
        dpopNonces.set(hostname, responseNonce);
      }
    }
    
    return response;
  };
}

/**
 * Create an authenticated AT Protocol agent from session data
 * Uses DPoP for request signing via custom fetch handler
 */
export async function createAuthenticatedAgent(session: SessionData): Promise<Agent> {
  // Parse and import DPoP private key
  const privateJwk = JSON.parse(session.dpop_private_key_jwk);
  const privateKey = await importPrivateKey(privateJwk);
  const publicJwk = extractPublicJwk(privateJwk);
  
  // Create custom fetch with DPoP support
  const dpopFetch = createDPoPFetch(privateKey, publicJwk, session.access_token);
  
  // Create agent with custom fetch passed in constructor
  const agent = new Agent({
    service: session.pds_url,
    fetch: dpopFetch,
  });
  
  // Set the session DID for the agent
  // @ts-ignore - setting session for authenticated requests
  agent.session = {
    did: session.did,
    accessJwt: session.access_token,
    refreshJwt: "",
    handle: "",
  };
  
  return agent;
}

/**
 * Generate an AT Protocol TID (timestamp ID) for record keys
 * Base32 sortable timestamp in microseconds
 */
export function generateTID(): string {
  const now = Date.now() * 1000; // Convert to microseconds
  const chars = '234567abcdefghijklmnopqrstuvwxyz';
  let tid = '';
  let n = now;
  
  for (let i = 0; i < 13; i++) {
    tid = chars[n & 31] + tid;
    n = Math.floor(n / 32);
  }
  
  return tid;
}
