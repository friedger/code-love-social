// Additional Nostr signers for users without a NIP-07 extension.
//
// Main auth flow (`nostr-auth.ts`) uses NIP-07 exclusively. This module adds
// two alternatives that can be wired into the login UI:
//
//   - `NsecSigner`: user pastes an nsec1… private key. Least secure — the key
//     lives in this browser's localStorage.
//   - `Nip46Signer`: user connects to a remote signer via a bunker:// URL or
//     a NIP-05 identifier that resolves to one.
//
// Both expose the same shape:
//   - `getPublicKey(): Promise<string>` (hex)
//   - `signEvent(template): Promise<SignedEvent>`
//
// matching the subset of `window.nostr` the app already depends on, so
// consumer code can treat them interchangeably with the NIP-07 path.

import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { BunkerSigner, parseBunkerInput, type BunkerPointer } from "nostr-tools/nip46";
import { SimplePool } from "nostr-tools/pool";
import * as nip19 from "nostr-tools/nip19";
import type { SignedEvent, UnsignedEvent } from "./nostr-auth";

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export interface RemoteSigner {
  getPublicKey(): Promise<string>;
  signEvent(template: UnsignedEvent): Promise<SignedEvent>;
  dispose?(): Promise<void> | void;
}

/* ------------------------------------------------------------------ */
/* nsec — raw private key                                              */
/* ------------------------------------------------------------------ */

export class NsecSigner implements RemoteSigner {
  private readonly seckey: Uint8Array;

  constructor(seckey: Uint8Array) {
    this.seckey = seckey;
  }

  static fromNsec(nsec: string): NsecSigner {
    const decoded = nip19.decode(nsec.trim());
    if (decoded.type !== "nsec") {
      throw new Error("Expected an nsec1… string.");
    }
    return new NsecSigner(decoded.data);
  }

  static fromHex(hex: string): NsecSigner {
    return new NsecSigner(hexToBytes(hex));
  }

  static generate(): NsecSigner {
    return new NsecSigner(generateSecretKey());
  }

  get seckeyHex(): string {
    return bytesToHex(this.seckey);
  }

  async getPublicKey(): Promise<string> {
    return getPublicKey(this.seckey);
  }

  async signEvent(template: UnsignedEvent): Promise<SignedEvent> {
    return finalizeEvent(template, this.seckey) as unknown as SignedEvent;
  }
}

/* ------------------------------------------------------------------ */
/* NIP-46 — remote signer (bunker)                                     */
/* ------------------------------------------------------------------ */

let sharedPool: SimplePool | undefined;
function getPool(): SimplePool {
  if (!sharedPool) sharedPool = new SimplePool();
  return sharedPool;
}

export class Nip46Signer implements RemoteSigner {
  private readonly bunker: BunkerSigner;
  readonly clientSecretHex: string;
  readonly pointer: BunkerPointer;

  private constructor(
    bunker: BunkerSigner,
    clientSecret: Uint8Array,
    pointer: BunkerPointer,
  ) {
    this.bunker = bunker;
    this.clientSecretHex = bytesToHex(clientSecret);
    this.pointer = pointer;
  }

  /** Connect to a bunker via a `bunker://` URL or `name@domain.com` NIP-05. */
  static async connect(
    bunkerInput: string,
    options: { clientSecretHex?: string; onauth?: (url: string) => void } = {},
  ): Promise<Nip46Signer> {
    const pointer = await parseBunkerInput(bunkerInput.trim());
    if (!pointer) throw new Error("Invalid bunker URL or NIP-05 identifier.");
    const clientSecret = options.clientSecretHex
      ? hexToBytes(options.clientSecretHex)
      : generateSecretKey();
    const bunker = BunkerSigner.fromBunker(clientSecret, pointer, {
      pool: getPool(),
      onauth: options.onauth,
    });
    await bunker.connect();
    return new Nip46Signer(bunker, clientSecret, pointer);
  }

  /** Reconnect using a previously persisted pointer + client secret. */
  static async rehydrate(
    pointer: BunkerPointer,
    clientSecretHex: string,
  ): Promise<Nip46Signer> {
    const clientSecret = hexToBytes(clientSecretHex);
    const bunker = BunkerSigner.fromBunker(clientSecret, pointer, {
      pool: getPool(),
    });
    await bunker.connect();
    return new Nip46Signer(bunker, clientSecret, pointer);
  }

  async getPublicKey(): Promise<string> {
    return this.bunker.getPublicKey();
  }

  async signEvent(template: UnsignedEvent): Promise<SignedEvent> {
    return (await this.bunker.signEvent(template)) as unknown as SignedEvent;
  }

  async dispose(): Promise<void> {
    await this.bunker.close();
  }
}
