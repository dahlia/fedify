import { decodeBase64, encodeBase64 } from "@std/encoding/base64";

/**
 * Imports a PEM-SPKI formatted public key.
 * @param pem The PEM-SPKI formatted public key.
 * @returns The imported public key.
 * @since 0.5.0
 */
export async function importSpki(pem: string): Promise<CryptoKey> {
  pem = pem.replace(/(?:-----(?:BEGIN|END) PUBLIC KEY-----|\s)/g, "");
  const spki = decodeBase64(pem);
  // TODO: support other than RSASSA-PKCS1-v1_5:
  return await crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"],
  );
}

/**
 * Exports a public key in PEM-SPKI format.
 * @param key The public key to export.
 * @returns The exported public key in PEM-SPKI format.
 * @since 0.5.0
 */
export async function exportSpki(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", key);
  let pem = encodeBase64(spki);
  pem = (pem.match(/.{1,64}/g) || []).join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----\n`;
}
