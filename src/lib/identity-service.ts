// AT Protocol Identity Service
// Handles identity resolution following the AT Protocol spec
// Supports both handles (DNS names) and DIDs (did:plc, did:web)

const PUBLIC_API = "https://public.api.bsky.app/xrpc";
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
  pdsUrl?: string;
}

export interface ProfileView {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  followersCount?: number;
  followsCount?: number;
}

// ============= Identifier Detection =============

/**
 * Check if an identifier is a handle (DNS name)
 * Handles contain dots and don't start with "did:"
 */
export function isHandle(identifier: string): boolean {
  return identifier.includes(".") && !identifier.startsWith("did:");
}

/**
 * Check if an identifier is a DID
 * DIDs start with "did:"
 */
export function isDid(identifier: string): boolean {
  return identifier.startsWith("did:");
}

/**
 * Check if a DID uses the did:plc method
 */
export function isDidPlc(did: string): boolean {
  return did.startsWith("did:plc:");
}

/**
 * Check if a DID uses the did:web method
 */
export function isDidWeb(did: string): boolean {
  return did.startsWith("did:web:");
}

// ============= Handle Resolution =============

/**
 * Resolve a handle to its DID using the public Bluesky API
 * This uses the com.atproto.identity.resolveHandle endpoint
 */
export async function resolveHandle(handle: string): Promise<string> {
  const response = await fetch(
    `${PUBLIC_API}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to resolve handle "${handle}": ${error}`);
  }

  const data = await response.json();
  return data.did;
}

// ============= DID Resolution =============

/**
 * Resolve a DID to its DID document
 * Supports both did:plc (via plc.directory) and did:web
 */
export async function resolveDid(did: string): Promise<DIDDocument> {
  if (isDidPlc(did)) {
    // did:plc resolution via PLC directory
    const response = await fetch(`${PLC_DIRECTORY}/${did}`);
    if (!response.ok) {
      throw new Error(`Failed to resolve DID ${did}: ${response.status}`);
    }
    return response.json();
  }

  if (isDidWeb(did)) {
    // did:web resolution via domain's well-known endpoint
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

// ============= Unified Identity Resolution =============

/**
 * Resolve any identifier (handle or DID) to normalized identity info
 * This is the main entry point for identity resolution
 */
export async function resolveIdentity(identifier: string): Promise<IdentityInfo> {
  let did: string;
  let handle: string | undefined;
  let pdsUrl: string | undefined;

  if (isHandle(identifier)) {
    // Identifier is a handle, resolve to DID
    did = await resolveHandle(identifier);
    handle = identifier;

    // Optionally resolve DID document for PDS URL
    try {
      const doc = await resolveDid(did);
      pdsUrl = getPdsFromDocument(doc);
    } catch {
      // PDS resolution is optional for client-side use
    }
  } else if (isDid(identifier)) {
    // Identifier is a DID, resolve document
    did = identifier;
    const doc = await resolveDid(did);
    handle = getHandleFromDocument(doc);
    pdsUrl = getPdsFromDocument(doc);
  } else {
    throw new Error(`Invalid identifier: ${identifier}`);
  }

  return {
    did,
    handle: handle || did,
    pdsUrl,
  };
}

// ============= Profile Fetching =============

/**
 * Get a user's profile from the public Bluesky API
 * Accepts either a handle or DID
 */
export async function getProfile(actor: string): Promise<ProfileView> {
  const response = await fetch(
    `${PUBLIC_API}/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get profile for ${actor}: ${response.status}`);
  }

  const data = await response.json();
  return {
    did: data.did,
    handle: data.handle,
    displayName: data.displayName,
    avatar: data.avatar,
    description: data.description,
    followersCount: data.followersCount,
    followsCount: data.followsCount,
  };
}

// ============= Social Graph =============

/**
 * Get the list of accounts a user follows
 * Uses app.bsky.graph.getFollows endpoint
 */
export async function getFollowing(
  actor: string,
  limit: number = 50,
  cursor?: string
): Promise<{ follows: ProfileView[]; cursor?: string }> {
  const params = new URLSearchParams({
    actor,
    limit: limit.toString(),
  });
  if (cursor) {
    params.append("cursor", cursor);
  }

  const response = await fetch(`${PUBLIC_API}/app.bsky.graph.getFollows?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to get following for ${actor}: ${response.status}`);
  }

  const data = await response.json();
  return {
    follows: data.follows.map((f: Record<string, unknown>) => ({
      did: f.did,
      handle: f.handle,
      displayName: f.displayName,
      avatar: f.avatar,
      description: f.description,
    })),
    cursor: data.cursor,
  };
}

/**
 * Get the list of accounts following a user
 * Uses app.bsky.graph.getFollowers endpoint
 */
export async function getFollowers(
  actor: string,
  limit: number = 50,
  cursor?: string
): Promise<{ followers: ProfileView[]; cursor?: string }> {
  const params = new URLSearchParams({
    actor,
    limit: limit.toString(),
  });
  if (cursor) {
    params.append("cursor", cursor);
  }

  const response = await fetch(`${PUBLIC_API}/app.bsky.graph.getFollowers?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to get followers for ${actor}: ${response.status}`);
  }

  const data = await response.json();
  return {
    followers: data.followers.map((f: Record<string, unknown>) => ({
      did: f.did,
      handle: f.handle,
      displayName: f.displayName,
      avatar: f.avatar,
      description: f.description,
    })),
    cursor: data.cursor,
  };
}

// ============= Identity Service Singleton =============

export const identityService = {
  // Detection
  isHandle,
  isDid,
  isDidPlc,
  isDidWeb,

  // Resolution
  resolveHandle,
  resolveDid,
  resolveIdentity,

  // Document helpers
  getPdsFromDocument,
  getHandleFromDocument,

  // Profile & Social
  getProfile,
  getFollowing,
  getFollowers,
};

export default identityService;
