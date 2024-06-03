import { decodeBase64, encodeBase64 } from "@std/encoding/base64";

/**
 * Imports a PEM-SPKI formatted RSA-PKCS#1-v1.5 public key.
 * @param pem The PEM-SPKI formatted RSA-PKCS#1-v1.5 public key.
 * @returns The imported public key.
 * @since 0.5.0
 */
export async function importSpki(pem: string): Promise<CryptoKey> {
  pem = pem.replace(/(?:-----(?:BEGIN|END) PUBLIC KEY-----|\s)/g, "");
  const spki = decodeBase64(pem);
  return await crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"],
  );
}

/**
 * Exports an RSA-PKCS#1-v1.5 public key in PEM-SPKI format.
 * @param key The public key to export.
 * @returns The exported RSA-PKCS#1-v1.5 public key in PEM-SPKI format.
 * @since 0.5.0
 * @throws {TypeError} If the key is invalid or unsupported.
 */
export async function exportSpki(key: CryptoKey): Promise<string> {
  if (key.algorithm.name !== "RSASSA-PKCS1-v1_5") {
    throw new TypeError("Unsupported algorithm: " + key.algorithm.name);
  }
  const spki = await crypto.subtle.exportKey("spki", key);
  let pem = encodeBase64(spki);
  pem = (pem.match(/.{1,64}/g) || []).join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----\n`;
}
