import { createPublicKey } from "node:crypto";
import { concat } from "@std/bytes/concat";
import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import { decodeBase64Url } from "@std/encoding/base64url";
import { decodeHex } from "@std/encoding/hex";
import { Integer, Sequence } from "asn1js";
import { decode, encode } from "multibase";
import { addPrefix, getCodeFromData, rmPrefix } from "multicodec";
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

/**
 * Imports a [Multibase]-encoded public key.
 *
 * [Multibase]: https://www.w3.org/TR/vc-data-integrity/#multibase-0
 * @param key The Multibase-encoded public key.
 * @returns The imported public key.
 * @throws {TypeError} If the key is invalid or unsupported.
 * @since 0.10.0
 */
export async function importMultibaseKey(key: string): Promise<CryptoKey> {
  const decoded = decode(key);
  const code: number = getCodeFromData(decoded);
  const content = rmPrefix(decoded);
  if (code === 0x1205) { // rsa-pub
    const keyObject = createPublicKey({
      // deno-lint-ignore no-explicit-any
      key: content as any,
      format: "der",
      type: "pkcs1",
    });
    const spki = keyObject.export({ type: "spki", format: "der" }).buffer;
    return await crypto.subtle.importKey(
      "spki",
      spki,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"],
    );
  } else if (code === 0xed) { // ed25519-pub
    return await crypto.subtle.importKey(
      "raw",
      content,
      "Ed25519",
      true,
      ["verify"],
    );
  } else {
    throw new TypeError("Unsupported key type: 0x" + code.toString(16));
  }
}

/**
 * Exports a public key in [Multibase] format.
 *
 * [Multibase]: https://www.w3.org/TR/vc-data-integrity/#multibase-0
 * @param key The public key to export.
 * @returns The exported public key in Multibase format.
 * @throws {TypeError} If the key is invalid or unsupported.
 * @since 0.10.0
 */
export async function exportMultibaseKey(key: CryptoKey): Promise<string> {
  let content: ArrayBuffer;
  let code: number;
  if (key.algorithm.name === "Ed25519") {
    content = await crypto.subtle.exportKey("raw", key);
    code = 0xed; // ed25519-pub
  } else if (
    key.algorithm.name === "RSASSA-PKCS1-v1_5" &&
    (key.algorithm as unknown as { hash: { name: string } }).hash.name ===
      "SHA-256"
  ) {
    const jwk = await crypto.subtle.exportKey("jwk", key);
    const n = concat([new Uint8Array([0]), decodeBase64Url(jwk.n!)]);
    const sequence = new Sequence({
      value: [
        new Integer({
          isHexOnly: true,
          valueHex: n,
        }),
        new Integer({
          isHexOnly: true,
          valueHex: decodeBase64Url(jwk.e!),
        }),
      ],
    });
    content = sequence.toBER(false);
    code = 0x1205; // rsa-pub
  } else {
    throw new TypeError(
      "Unsupported key type: " + JSON.stringify(key.algorithm),
    );
  }
  const codeHex = code.toString(16);
  const codeBytes = decodeHex(codeHex.length % 2 < 1 ? codeHex : "0" + codeHex);
  const prefixed = addPrefix(codeBytes, new Uint8Array(content));
  const encoded = encode("base58btc", prefixed);
  return new TextDecoder().decode(encoded);
}
