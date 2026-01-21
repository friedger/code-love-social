import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create Supabase client with service role for database access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper to generate random string
function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

// Helper to generate PKCE code verifier and challenge
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(64);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { verifier, challenge };
}

// Helper to generate DPoP key pair
async function generateDPoPKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicJwk,
    privateJwk,
  };
}

// Helper to create DPoP proof
async function createDPoPProof(
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

  // Convert signature from DER to raw format for ES256
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// Resolve handle to DID and PDS URL
async function resolveHandle(handle: string): Promise<{ did: string; pdsUrl: string }> {
  // Use bsky.social as the handle resolver
  const resolveUrl = `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
  const response = await fetch(resolveUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to resolve handle: ${handle}`);
  }
  
  const data = await response.json();
  const did = data.did;
  
  // Get the PDS URL from the DID document
  let pdsUrl = "https://bsky.social"; // Default
  
  if (did.startsWith("did:plc:")) {
    const didDocResponse = await fetch(`https://plc.directory/${did}`);
    if (didDocResponse.ok) {
      const didDoc = await didDocResponse.json();
      const pdsService = didDoc.service?.find((s: { id: string }) => s.id === "#atproto_pds");
      if (pdsService?.serviceEndpoint) {
        pdsUrl = pdsService.serviceEndpoint;
      }
    }
  }
  
  return { did, pdsUrl };
}

// Get authorization server URL from PDS (Resource Server)
// The PDS is a Resource Server, not an Authorization Server.
// We need to discover the actual auth server from the protected resource metadata.
async function getAuthorizationServerUrl(pdsUrl: string): Promise<string> {
  // First, try to get the protected resource metadata from the PDS
  try {
    const resourceMetaUrl = `${pdsUrl}/.well-known/oauth-protected-resource`;
    const response = await fetch(resourceMetaUrl);
    
    if (response.ok) {
      const resourceMeta = await response.json();
      // The authorization_servers array contains the auth server(s)
      if (resourceMeta.authorization_servers && resourceMeta.authorization_servers.length > 0) {
        console.log(`Discovered auth server: ${resourceMeta.authorization_servers[0]} from PDS: ${pdsUrl}`);
        return resourceMeta.authorization_servers[0];
      }
    }
  } catch (e) {
    console.log(`Failed to fetch protected resource metadata from ${pdsUrl}:`, e);
  }
  
  // Fallback: Check if this PDS serves as its own auth server
  try {
    const directCheck = await fetch(`${pdsUrl}/.well-known/oauth-authorization-server`);
    if (directCheck.ok) {
      console.log(`PDS ${pdsUrl} is also an authorization server`);
      return pdsUrl;
    }
  } catch (e) {
    console.log(`PDS ${pdsUrl} is not an authorization server`);
  }
  
  // Final fallback: Use bsky.social as the default auth server for Bluesky network
  console.log(`Using default auth server: https://bsky.social`);
  return "https://bsky.social";
}

// Get authorization server metadata from the AUTHORIZATION SERVER (not PDS)
async function getAuthServerMetadata(authServerUrl: string): Promise<{
  authorization_endpoint: string;
  token_endpoint: string;
  pushed_authorization_request_endpoint?: string;
}> {
  const response = await fetch(`${authServerUrl}/.well-known/oauth-authorization-server`);
  if (!response.ok) {
    throw new Error(`Failed to get auth server metadata from ${authServerUrl}`);
  }
  return response.json();
}

// Get the client metadata (this function's URL serves as client_id)
function getClientMetadata(functionUrl: string): Record<string, unknown> {
  return {
    client_id: functionUrl,
    client_name: "Clarity Social",
    client_uri: functionUrl,
    redirect_uris: [`${functionUrl}/callback`],
    scope: "atproto transition:generic",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const functionUrl = `${SUPABASE_URL}/functions/v1/atproto-auth`;
  
  try {
    // Route: GET / - Serve client metadata (this URL is the client_id)
    if (url.pathname === "/atproto-auth" || url.pathname === "/atproto-auth/") {
      const metadata = getClientMetadata(functionUrl);
      return new Response(JSON.stringify(metadata), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: GET /login - Start OAuth flow
    if (url.pathname === "/atproto-auth/login") {
      const handle = url.searchParams.get("handle");
      const returnUrl = url.searchParams.get("return_url");

      if (!handle || !returnUrl) {
        return new Response(JSON.stringify({ error: "Missing handle or return_url" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve handle to DID and PDS
      const { did, pdsUrl } = await resolveHandle(handle);
      
      // Discover the Authorization Server from the PDS (Resource Server)
      const authServerUrl = await getAuthorizationServerUrl(pdsUrl);
      console.log(`Using auth server: ${authServerUrl} for PDS: ${pdsUrl}`);
      
      // Get auth server metadata from the AUTHORIZATION SERVER
      const authMeta = await getAuthServerMetadata(authServerUrl);
      
      // Generate PKCE
      const { verifier, challenge } = await generatePKCE();
      
      // Generate DPoP key pair
      const { privateJwk, publicJwk } = await generateDPoPKeyPair();
      
      // Generate state
      const state = generateRandomString(32);
      
      // Store state in database (including auth_server_url for callback)
      const { error: stateError } = await supabase.from("atproto_oauth_state").insert({
        state,
        code_verifier: verifier,
        return_url: returnUrl,
        dpop_private_key_jwk: JSON.stringify(privateJwk),
        dpop_public_key_jwk: JSON.stringify(publicJwk),
        did,
        pds_url: pdsUrl,
        auth_server_url: authServerUrl,
      });

      if (stateError) {
        console.error("Failed to store state:", stateError);
        throw new Error("Failed to initialize login");
      }

      // Build authorization URL
      const authParams = new URLSearchParams({
        response_type: "code",
        client_id: functionUrl,
        redirect_uri: `${functionUrl}/callback`,
        state,
        scope: "atproto transition:generic",
        code_challenge: challenge,
        code_challenge_method: "S256",
        login_hint: handle,
      });

      const authUrl = `${authMeta.authorization_endpoint}?${authParams.toString()}`;
      
      return new Response(JSON.stringify({ authorization_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: GET /callback - Handle OAuth callback
    if (url.pathname === "/atproto-auth/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        const errorDesc = url.searchParams.get("error_description") || error;
        return new Response(`
          <html><body>
            <script>
              window.opener?.postMessage({ type: 'oauth-error', error: '${errorDesc}' }, '*');
              window.close();
            </script>
            <p>Authentication failed: ${errorDesc}</p>
          </body></html>
        `, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
      }

      // Retrieve state from database
      const { data: stateData, error: stateError } = await supabase
        .from("atproto_oauth_state")
        .select("*")
        .eq("state", state)
        .single();

      if (stateError || !stateData) {
        return new Response("Invalid or expired state", { status: 400 });
      }

      // Delete used state
      await supabase.from("atproto_oauth_state").delete().eq("state", state);

      // Get auth server metadata from the stored authorization server URL
      const authServerUrl = stateData.auth_server_url || await getAuthorizationServerUrl(stateData.pds_url);
      const authMeta = await getAuthServerMetadata(authServerUrl);
      
      // Reconstruct DPoP keys
      const privateJwk = JSON.parse(stateData.dpop_private_key_jwk);
      const publicJwk = JSON.parse(stateData.dpop_public_key_jwk);
      
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        privateJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );

      // Create DPoP proof for token request
      const dpopProof = await createDPoPProof(
        privateKey,
        publicJwk,
        "POST",
        authMeta.token_endpoint
      );

      // Exchange code for tokens
      const tokenResponse = await fetch(authMeta.token_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "DPoP": dpopProof,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${functionUrl}/callback`,
          client_id: functionUrl,
          code_verifier: stateData.code_verifier,
        }).toString(),
      });

      // Handle DPoP nonce requirement
      let tokenData;
      if (tokenResponse.status === 400) {
        const dpopNonce = tokenResponse.headers.get("DPoP-Nonce");
        if (dpopNonce) {
          // Retry with nonce
          const dpopProofWithNonce = await createDPoPProof(
            privateKey,
            publicJwk,
            "POST",
            authMeta.token_endpoint,
            dpopNonce
          );

          const retryResponse = await fetch(authMeta.token_endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "DPoP": dpopProofWithNonce,
            },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: `${functionUrl}/callback`,
              client_id: functionUrl,
              code_verifier: stateData.code_verifier,
            }).toString(),
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            console.error("Token exchange failed:", errorText);
            throw new Error("Token exchange failed");
          }
          tokenData = await retryResponse.json();
        } else {
          const errorText = await tokenResponse.text();
          console.error("Token exchange failed:", errorText);
          throw new Error("Token exchange failed");
        }
      } else if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        throw new Error("Token exchange failed");
      } else {
        tokenData = await tokenResponse.json();
      }

      // Generate session token
      const sessionToken = generateRandomString(64);

      // Store session in database
      const { error: sessionError } = await supabase.from("atproto_sessions").insert({
        session_token: sessionToken,
        did: stateData.did,
        handle: "", // Will be fetched on session retrieval
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        pds_url: stateData.pds_url,
        dpop_private_key_jwk: stateData.dpop_private_key_jwk,
      });

      if (sessionError) {
        console.error("Failed to store session:", sessionError);
        throw new Error("Failed to create session");
      }

      // Redirect back to the app with session token
      const returnUrl = new URL(stateData.return_url);
      returnUrl.pathname = "/oauth/callback";
      returnUrl.searchParams.set("session", sessionToken);

      return new Response(null, {
        status: 302,
        headers: { Location: returnUrl.toString() },
      });
    }

    // Route: GET /session - Get current session
    if (url.pathname === "/atproto-auth/session") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: session, error: sessionError } = await supabase
        .from("atproto_sessions")
        .select("*")
        .eq("session_token", sessionToken)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch user profile from PDS
      const privateJwk = JSON.parse(session.dpop_private_key_jwk);
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        privateJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );
      
      // Get public key from private JWK
      const publicJwk = {
        kty: privateJwk.kty,
        crv: privateJwk.crv,
        x: privateJwk.x,
        y: privateJwk.y,
      };

      const profileUrl = `${session.pds_url}/xrpc/app.bsky.actor.getProfile?actor=${session.did}`;
      
      // Create access token hash for DPoP
      const tokenHash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(session.access_token)
      );
      const ath = btoa(String.fromCharCode(...new Uint8Array(tokenHash)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const dpopProof = await createDPoPProof(
        privateKey,
        publicJwk,
        "GET",
        profileUrl,
        undefined,
        ath
      );

      const profileResponse = await fetch(profileUrl, {
        headers: {
          Authorization: `DPoP ${session.access_token}`,
          DPoP: dpopProof,
        },
      });

      if (!profileResponse.ok) {
        // Handle DPoP nonce requirement
        const dpopNonce = profileResponse.headers.get("DPoP-Nonce");
        if (dpopNonce) {
          const dpopProofWithNonce = await createDPoPProof(
            privateKey,
            publicJwk,
            "GET",
            profileUrl,
            dpopNonce,
            ath
          );

          const retryResponse = await fetch(profileUrl, {
            headers: {
              Authorization: `DPoP ${session.access_token}`,
              DPoP: dpopProofWithNonce,
            },
          });

          if (retryResponse.ok) {
            const profile = await retryResponse.json();
            return new Response(JSON.stringify({
              did: session.did,
              handle: profile.handle,
              displayName: profile.displayName || profile.handle,
              avatar: profile.avatar,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Return basic info if profile fetch fails
        return new Response(JSON.stringify({
          did: session.did,
          handle: session.did,
          displayName: session.did,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const profile = await profileResponse.json();
      return new Response(JSON.stringify({
        did: session.did,
        handle: profile.handle,
        displayName: profile.displayName || profile.handle,
        avatar: profile.avatar,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: POST /logout - Logout and revoke session
    if (url.pathname === "/atproto-auth/logout" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      const sessionToken = authHeader?.replace("Bearer ", "");

      if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete session from database
      await supabase.from("atproto_sessions").delete().eq("session_token", sessionToken);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
