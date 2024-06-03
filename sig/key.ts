import { getLogger } from "@logtape/logtape";

/**
 * Checks if the given key is valid and supported.  No-op if the key is valid,
 * otherwise throws an error.
 * @param key The key to check.
 * @param type Which type of key to check.  If not specified, the key can be
 *             either public or private.
 * @throws {TypeError} If the key is invalid or unsupported.
 */
export function validateCryptoKey(
  key: CryptoKey,
  type?: "public" | "private",
): void {
  if (type != null && key.type !== type) {
    throw new TypeError(`The key is not a ${type} key.`);
  }
  if (!key.extractable) {
    throw new TypeError("The key is not extractable.");
  }
  if (
    key.algorithm.name !== "RSASSA-PKCS1-v1_5" &&
    key.algorithm.name !== "Ed25519"
  ) {
    throw new TypeError(
      "Currently only RSASSA-PKCS1-v1_5 and Ed25519 keys are supported.  " +
        "More algorithms will be added in the future!",
    );
  }
  if (key.algorithm.name === "RSASSA-PKCS1-v1_5") {
    // @ts-ignore TS2304
    const algorithm = key.algorithm as unknown as RsaHashedKeyAlgorithm;
    if (algorithm.hash.name != "SHA-256") {
      throw new TypeError(
        "For compatibility with the existing Fediverse software " +
          "(e.g., Mastodon), hash algorithm for RSASSA-PKCS1-v1_5 keys " +
          "must be SHA-256.",
      );
    }
  }
}

/**
 * Generates a key pair which is appropriate for Fedify.
 * @param algorithm The algorithm to use.  Currently only RSASSA-PKCS1-v1_5 and
 *                  Ed25519 are supported.
 * @returns The generated key pair.
 * @throws {TypeError} If the algorithm is unsupported.
 */
export function generateCryptoKeyPair(
  algorithm?: "RSASSA-PKCS1-v1_5" | "Ed25519",
): Promise<CryptoKeyPair> {
  if (algorithm == null) {
    getLogger(["fedify", "sig", "key"]).warn(
      "No algorithm specified.  Using RSASSA-PKCS1-v1_5 by default, but " +
        "it is recommended to specify the algorithm explicitly as " +
        "the parameter will be required in the future.",
    );
  }
  if (algorithm == null || algorithm === "RSASSA-PKCS1-v1_5") {
    return crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 4096,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
  } else if (algorithm === "Ed25519") {
    return crypto.subtle.generateKey(
      "Ed25519",
      true,
      ["sign", "verify"],
    ) as Promise<CryptoKeyPair>;
  }
  throw new TypeError("Unsupported algorithm: " + algorithm);
}

/**
 * Exports a key in JWK format.
 * @param key The key to export.  Either public or private key.
 * @returns The exported key in JWK format.  The key is suitable for
 *          serialization and storage.
 * @throws {TypeError} If the key is invalid or unsupported.
 */
export async function exportJwk(key: CryptoKey): Promise<JsonWebKey> {
  validateCryptoKey(key);
  return await crypto.subtle.exportKey("jwk", key);
}

/**
 * Imports a key from JWK format.
 * @param jwk The key in JWK format.
 * @param type Which type of key to import, either `"public"`" or `"private"`".
 * @returns The imported key.
 * @throws {TypeError} If the key is invalid or unsupported.
 */
export async function importJwk(
  jwk: JsonWebKey,
  type: "public" | "private",
): Promise<CryptoKey> {
  let key: CryptoKey;
  if (jwk.kty === "RSA" && jwk.alg === "RS256") {
    key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      type === "public" ? ["verify"] : ["sign"],
    );
  } else if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      "Ed25519",
      true,
      type === "public" ? ["verify"] : ["sign"],
    );
  } else {
    throw new TypeError("Unsupported JWK format.");
  }
  validateCryptoKey(key, type);
  return key;
}
