import { getLogger } from "@logtape/logtape";
import {
  type DocumentLoader,
  getDocumentLoader,
} from "../runtime/docloader.ts";
import { isActor } from "../vocab/actor.ts";
import { CryptographicKey, type Multikey, Object } from "../vocab/vocab.ts";

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
    if (algorithm.hash.name !== "SHA-256") {
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
 * @param type Which type of key to import, either `"public"` or `"private"`.
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

/**
 * Options for {@link fetchKey}.
 * @since 0.10.0
 */
export interface FetchKeyOptions {
  /**
   * The document loader for loading remote JSON-LD documents.
   */
  documentLoader?: DocumentLoader;

  /**
   * The context loader for loading remote JSON-LD contexts.
   */
  contextLoader?: DocumentLoader;

  /**
   * The key cache to use for caching public keys.
   * @since 0.12.0
   */
  keyCache?: KeyCache;
}

/**
 * The result of {@link fetchKey}.
 * @since 0.12.0
 */
export interface FetchKeyResult<T extends CryptographicKey | Multikey> {
  /**
   * The fetched (or cached) key.
   */
  readonly key: T & { publicKey: CryptoKey };

  /**
   * Whether the key is fetched from the cache.
   */
  readonly cached: boolean;
}

/**
 * Fetches a {@link CryptographicKey} or {@link Multikey} from the given URL.
 * If the given URL contains an {@link Actor} object, it tries to find
 * the corresponding key in the `publicKey` or `assertionMethod` property.
 * @typeParam T The type of the key to fetch.  Either {@link CryptographicKey}
 *              or {@link Multikey}.
 * @param keyId The URL of the key.
 * @param cls The class of the key to fetch.  Either {@link CryptographicKey}
 *            or {@link Multikey}.
 * @param options Options for fetching the key.  See {@link FetchKeyOptions}.
 * @returns The fetched key or `null` if the key is not found.
 * @since 0.10.0
 */
export async function fetchKey<T extends CryptographicKey | Multikey>(
  keyId: URL | string,
  // deno-lint-ignore no-explicit-any
  cls: (new (...args: any[]) => T) & {
    fromJsonLd(
      jsonLd: unknown,
      options: {
        documentLoader?: DocumentLoader;
        contextLoader?: DocumentLoader;
      },
    ): Promise<T>;
  },
  { documentLoader, contextLoader, keyCache }: FetchKeyOptions = {},
): Promise<FetchKeyResult<T> | null> {
  const logger = getLogger(["fedify", "sig", "key"]);
  const cacheKey = typeof keyId === "string" ? new URL(keyId) : keyId;
  keyId = typeof keyId === "string" ? keyId : keyId.href;
  if (keyCache != null) {
    const cachedKey = await keyCache.get(cacheKey);
    if (cachedKey instanceof cls && cachedKey.publicKey != null) {
      logger.debug("Key {keyId} found in cache.", { keyId });
      return {
        key: cachedKey as T & { publicKey: CryptoKey },
        cached: true,
      };
    }
  }
  logger.debug("Fetching key {keyId} to verify signature...", { keyId });
  let document: unknown;
  try {
    const remoteDocument = await (documentLoader ?? getDocumentLoader())(keyId);
    document = remoteDocument.document;
  } catch (_) {
    logger.debug("Failed to fetch key {keyId}.", { keyId });
    return null;
  }
  let object: Object | T;
  try {
    object = await Object.fromJsonLd(document, {
      documentLoader,
      contextLoader,
    });
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    try {
      object = await cls.fromJsonLd(document, {
        documentLoader,
        contextLoader,
      });
    } catch (e) {
      if (e instanceof TypeError) {
        logger.debug(
          "Failed to verify; key {keyId} returned an invalid object.",
          { keyId },
        );
        return null;
      }
      throw e;
    }
  }
  let key: T | null = null;
  if (object instanceof cls) key = object;
  else if (isActor(object)) {
    // @ts-ignore: cls is either CryptographicKey or Multikey
    const keys = cls === CryptographicKey
      ? object.getPublicKeys({ documentLoader, contextLoader })
      : object.getAssertionMethods({ documentLoader, contextLoader });
    for await (const k of keys) {
      if (k.id?.href === keyId) {
        key = k as T;
        break;
      }
    }
    if (key == null) {
      logger.debug(
        "Failed to verify; object {keyId} returned an {actorType}, " +
          "but has no key matching {keyId}.",
        { keyId, actorType: object.constructor.name },
      );
      return null;
    }
  } else {
    logger.debug(
      "Failed to verify; key {keyId} returned an invalid object.",
      { keyId },
    );
    return null;
  }
  if (key.publicKey == null) {
    logger.debug(
      "Failed to verify; key {keyId} has no publicKeyPem field.",
      { keyId },
    );
    return null;
  }
  if (keyCache != null) {
    await keyCache.set(cacheKey, key);
    logger.debug("Key {keyId} cached.", { keyId });
  }
  return {
    key: key as T & { publicKey: CryptoKey },
    cached: false,
  };
}

/**
 * A cache for storing cryptographic keys.
 * @since 0.12.0
 */
export interface KeyCache {
  /**
   * Gets a key from the cache.
   * @param keyId The key ID.
   */
  get(keyId: URL): Promise<CryptographicKey | Multikey | null>;

  /**
   * Sets a key to the cache.
   * @param keyId The key ID.
   * @param key The key to cache.
   */
  set(keyId: URL, key: CryptographicKey | Multikey): Promise<void>;
}
