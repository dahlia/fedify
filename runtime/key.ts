import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import { PublicKeyInfo } from "pkijs";
import { validateCryptoKey } from "../sig/key.ts";

const algorithms: Record<
  string,
  | AlgorithmIdentifier
  | HmacImportParams
  | RsaHashedImportParams
  | EcKeyImportParams
> = {
  "1.2.840.113549.1.1.1": { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  "1.3.101.112": "Ed25519",
};

/**
 * Imports a PEM-SPKI formatted public key.
 * @param pem The PEM-SPKI formatted public key.
 * @returns The imported public key.
 * @throws {TypeError} If the key is invalid or unsupported.
 * @since 0.5.0
 */
export async function importSpki(pem: string): Promise<CryptoKey> {
  pem = pem.replace(/(?:-----(?:BEGIN|END) PUBLIC KEY-----|\s)/g, "");
  let spki: Uint8Array;
  try {
    spki = decodeBase64(pem);
  } catch (_) {
    throw new TypeError("Invalid PEM-SPKI format.");
  }
  const pki = PublicKeyInfo.fromBER(spki);
  const oid = pki.algorithm.algorithmId;
  const algorithm = algorithms[oid];
  if (algorithm == null) {
    throw new TypeError("Unsupported algorithm: " + oid);
  }
  return await crypto.subtle.importKey(
    "spki",
    spki,
    algorithm,
    true,
    ["verify"],
  );
}

/**
 * Exports a public key in PEM-SPKI format.
 * @param key The public key to export.
 * @returns The exported public key in PEM-SPKI format.
 * @throws {TypeError} If the key is invalid or unsupported.
 * @since 0.5.0
 */
export async function exportSpki(key: CryptoKey): Promise<string> {
  validateCryptoKey(key);
  const spki = await crypto.subtle.exportKey("spki", key);
  let pem = encodeBase64(spki);
  pem = (pem.match(/.{1,64}/g) || []).join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----\n`;
}
