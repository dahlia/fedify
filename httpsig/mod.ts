/**
 * The implementation of the [HTTP
 * Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures-12).
 *
 * @module
 * @deprecated
 */
import { getLogger } from "@logtape/logtape";
import {
  signRequest,
  verifyRequest,
  type VerifyRequestOptions,
} from "../sig/http.ts";
import {
  exportJwk as newExportJwk,
  generateCryptoKeyPair as newGenerateCryptoKeyPair,
  importJwk as newImportJwk,
} from "../sig/key.ts";
import {
  doesActorOwnKey as newDoesActorOwnKey,
  type DoesActorOwnKeyOptions as NewDoesActorOwnKeyOptions,
  getKeyOwner as newGetKeyOwner,
  type GetKeyOwnerOptions as NewGetKeyOwnerOptions,
} from "../sig/owner.ts";
import type { Actor } from "../vocab/actor.ts";
import type { Activity, CryptographicKey } from "../vocab/vocab.ts";

/**
 * Signs a request using the given private key.
 * @param request The request to sign.
 * @param privateKey The private key to use for signing.
 * @param keyId The key ID to use for the signature.  It will be used by the
 *              verifier.
 * @returns The signed request.
 * @throws {TypeError} If the private key is invalid or unsupported.
 * @deprecated
 */
export function sign(
  request: Request,
  privateKey: CryptoKey,
  keyId: URL,
): Promise<Request> {
  getLogger(["fedify", "httpsig", "sign"]).warn(
    "The sign() function is deprecated.  Use signRequest() instead.",
  );
  return signRequest(request, privateKey, keyId);
}

/**
 * Options for {@link verify}.
 *
 * @since 0.9.0
 * @deprecated
 */
export type VerifyOptions = VerifyRequestOptions;

/**
 * Verifies the signature of a request.
 *
 * Note that this function consumes the request body, so it should not be used
 * if the request body is already consumed.  Consuming the request body after
 * calling this function is okay, since this function clones the request
 * under the hood.
 *
 * @param request The request to verify.
 * @param options Options for verifying the request.
 * @returns The public key of the verified signature, or `null` if the signature
 *          could not be verified.
 * @deprecated
 */
export function verify(
  request: Request,
  options: VerifyRequestOptions = {},
): Promise<CryptographicKey | null> {
  getLogger(["fedify", "httpsig", "verify"]).warn(
    "The verify() function is deprecated.  Use verifyRequest() instead.",
  );
  return verifyRequest(request, options);
}

/**
 * Options for {@link doesActorOwnKey}.
 * @since 0.8.0
 * @deprecated
 */
export type DoesActorOwnKeyOptions = NewDoesActorOwnKeyOptions;

/**
 * Checks if the actor of the given activity owns the specified key.
 * @param activity The activity to check.
 * @param key The public key to check.
 * @param options Options for checking the key ownership.
 * @returns Whether the actor is the owner of the key.
 * @deprecated
 */
export function doesActorOwnKey(
  activity: Activity,
  key: CryptographicKey,
  options: NewDoesActorOwnKeyOptions,
): Promise<boolean> {
  getLogger(["fedify", "httpsig"]).warn(
    "The doesActorOwnKey() function from @fedify/fedify/httpsig is deprecated.  " +
      "Use doesActorOwnKey() from @fedify/fedify/sig instead.",
  );
  return newDoesActorOwnKey(activity, key, options);
}

/**
 * Options for {@link getKeyOwner}.
 * @since 0.8.0
 * @deprecated
 */
export type GetKeyOwnerOptions = NewGetKeyOwnerOptions;

/**
 * Gets the actor that owns the specified key.  Returns `null` if the key has no
 * known owner.
 *
 * @param keyId The ID of the key to check, or the key itself.
 * @param options Options for getting the key owner.
 * @returns The actor that owns the key, or `null` if the key has no known
 *          owner.
 * @since 0.7.0
 * @deprecated
 */
export function getKeyOwner(
  keyId: URL | CryptographicKey,
  options: NewGetKeyOwnerOptions,
): Promise<Actor | null> {
  getLogger(["fedify", "httpsig"]).warn(
    "The getKeyOwner() function from @fedify/fedify/httpsig is deprecated.  " +
      "Use getKeyOwner() from @fedify/fedify/sig instead.",
  );
  return newGetKeyOwner(keyId, options);
}

/**
 * Generates a key pair which is appropriate for Fedify.
 * @returns The generated key pair.
 * @since 0.3.0
 * @deprecated
 */
export function generateCryptoKeyPair(): Promise<CryptoKeyPair> {
  getLogger(["fedify", "httpsig", "key"]).warn(
    "The generateCryptoKeyPair() from @fedify/fedify/httpsig is deprecated.  " +
      "Please use generateKeyPair() from @fedify/fedify/sig instead.",
  );
  return newGenerateCryptoKeyPair();
}

/**
 * Exports a key in JWK format.
 * @param key The key to export.  Either public or private key.
 * @returns The exported key in JWK format.  The key is suitable for
 *          serialization and storage.
 * @throws {TypeError} If the key is invalid or unsupported.
 * @since 0.3.0
 * @deprecated
 */
export function exportJwk(key: CryptoKey): Promise<JsonWebKey> {
  getLogger(["fedify", "httpsig", "key"]).warn(
    "The exportJwk() function from @fedify/fedify/httpsig is deprecated.  " +
      "Please use exportJwk() from @fedify/fedify/sig instead.",
  );
  return newExportJwk(key);
}

/**
 * Imports a key from JWK format.
 * @param jwk The key in JWK format.
 * @param type Which type of key to import, either `"public"`" or `"private"`".
 * @returns The imported key.
 * @throws {TypeError} If the key is invalid or unsupported.
 * @since 0.3.0
 * @deprecated
 */
export function importJwk(
  jwk: JsonWebKey,
  type: "public" | "private",
): Promise<CryptoKey> {
  getLogger(["fedify", "httpsig", "key"]).warn(
    "The importJwk() function from @fedify/fedify/httpsig is deprecated.  " +
      "Please use importJwk() from @fedify/fedify/sig instead.",
  );
  return newImportJwk(jwk, type);
}
