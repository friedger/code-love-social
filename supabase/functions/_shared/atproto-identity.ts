// AT Protocol Identity Service for Edge Functions
// Server-side identity resolution with full DID document support

const PLC_DIRECTORY = "https://plc.directory";

// ============= Types =============

export interface DIDDocument {
  id: string;
  alsoKnownAs?: string[];
  verificationMethod?: VerificationMethod[];
  service?: Service[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
}

export interface Service {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface IdentityInfo {
  did: string;
  handle: string;
  pdsUrl: string;
}

// ============= Identifier Detection =============

/**
 * Check if an identifier is a handle (DNS name)
 */
export function isHandle(identifier: string): boolean {
  return identifier.includes(".") && !identifier.startsWith("did:");
}

/**
 * Check if an identifier is a DID
 */
export function isDid(identifier: string): boolean {
  return identifier.startsWith("did:");
}

// ============= Handle Resolution =============

/**
 * Resolve a handle to DID via DNS TXT record or HTTPS well-known
 * Falls back to Bluesky public API if direct resolution fails
 */
export async function resolveHandle(handle: string): Promise<string> {
  // Try Bluesky public API first (most reliable for bsky.social handles)
  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
    );
    if (response.ok) {
      const data = await response.json();
      return data.did;
    }
  } catch {
    // Continue to fallback
  }

  // Try HTTPS well-known endpoint
  try {
    const response = await fetch(`https://${handle}/.well-known/atproto-did`);
    if (response.ok) {
      const did = await response.text();
      return did.trim();
    }
  } catch {
    // DNS/HTTPS resolution failed
  }

  throw new Error(`Failed to resolve handle: ${handle}`);
}

// ============= DID Resolution =============

/**
 * Resolve a DID to its DID document
 * Supports both did:plc and did:web methods
 */
export async function resolveDid(did: string): Promise<DIDDocument> {
  if (did.startsWith("did:plc:")) {
    const response = await fetch(`${PLC_DIRECTORY}/${did}`);
    if (!response.ok) {
      throw new Error(`Failed to resolve DID ${did}: ${response.status}`);
    }
    return response.json();
  }

  if (did.startsWith("did:web:")) {
    // did:web:example.com -> https://example.com/.well-known/did.json
    // did:web:example.com:path -> https://example.com/path/did.json
    const parts = did.replace("did:web:", "").split(":");
    const domain = parts[0];
    const path = parts.slice(1).join("/");
    
    const url = path
      ? `https://${domain}/${path}/did.json`
      : `https://${domain}/.well-known/did.json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to resolve DID ${did}: ${response.status}`);
    }
    return response.json();
  }

  throw new Error(`Unsupported DID method: ${did}`);
}

// ============= Document Helpers =============

/**
 * Extract the PDS URL from a DID document
 */
export function getPdsFromDocument(doc: DIDDocument): string | undefined {
  const pdsService = doc.service?.find(
    (s) => s.type === "AtprotoPersonalDataServer" || s.id.endsWith("#atproto_pds")
  );
  return pdsService?.serviceEndpoint;
}

/**
 * Extract the handle from a DID document's alsoKnownAs field
 */
export function getHandleFromDocument(doc: DIDDocument): string | undefined {
  const handleUri = doc.alsoKnownAs?.find((aka) => aka.startsWith("at://"));
  return handleUri?.replace("at://", "");
}

// ============= Service Discovery =============

/**
 * Discover the PDS URL for a DID
 */
export async function discoverPDS(did: string): Promise<string> {
  const doc = await resolveDid(did);
  const pdsUrl = getPdsFromDocument(doc);
  
  if (!pdsUrl) {
    throw new Error(`No PDS found in DID document for ${did}`);
  }
  
  return pdsUrl;
}

/**
 * Discover the OAuth authorization server for a PDS
 */
export async function discoverAuthServer(pdsUrl: string): Promise<string> {
  // First, get the PDS's protected resource metadata
  const protectedResourceUrl = `${pdsUrl}/.well-known/oauth-protected-resource`;
  
  try {
    const response = await fetch(protectedResourceUrl);
    if (response.ok) {
      const metadata = await response.json();
      if (metadata.authorization_servers?.length > 0) {
        return metadata.authorization_servers[0];
      }
    }
  } catch {
    // Fall back to assuming auth server is at PDS URL
  }
  
  // Fallback: assume the PDS is its own auth server
  return pdsUrl;
}

/**
 * Get OAuth authorization server metadata
 */
export async function getAuthServerMetadata(authServerUrl: string): Promise<{
  authorization_endpoint: string;
  token_endpoint: string;
  pushed_authorization_request_endpoint?: string;
}> {
  const metadataUrl = `${authServerUrl}/.well-known/oauth-authorization-server`;
  const response = await fetch(metadataUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch auth server metadata: ${response.status}`);
  }
  
  return response.json();
}

// ============= Unified Identity Resolution =============

/**
 * Resolve any identifier (handle or DID) to full identity info
 * Includes PDS URL discovery
 */
export async function resolveIdentity(identifier: string): Promise<IdentityInfo> {
  let did: string;
  let handle: string;

  if (isHandle(identifier)) {
    did = await resolveHandle(identifier);
    handle = identifier;
  } else if (isDid(identifier)) {
    did = identifier;
    const doc = await resolveDid(did);
    handle = getHandleFromDocument(doc) || did;
  } else {
    throw new Error(`Invalid identifier: ${identifier}`);
  }

  const pdsUrl = await discoverPDS(did);

  return {
    did,
    handle,
    pdsUrl,
  };
}

// ============= Bidirectional Validation =============

/**
 * Validate that a handle and DID are properly linked
 * This verifies the bidirectional relationship required by AT Protocol
 */
export async function validateHandleDIDBidirectional(
  handle: string,
  did: string
): Promise<boolean> {
  try {
    // Check handle -> DID
    const resolvedDid = await resolveHandle(handle);
    if (resolvedDid !== did) {
      return false;
    }

    // Check DID -> handle
    const doc = await resolveDid(did);
    const docHandle = getHandleFromDocument(doc);
    if (docHandle !== handle) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
