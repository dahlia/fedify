/**
 * HTTP Signatures implementation.
 *
 * @module
 */
export {
  signRequest,
  verifyRequest,
  type VerifyRequestOptions,
} from "./http.ts";
export {
  exportJwk,
  generateCryptoKeyPair,
  importJwk,
  type KeyCache,
} from "./key.ts";
export {
  attachSignature,
  createSignature,
  type CreateSignatureOptions,
  detachSignature,
  signJsonLd,
  type SignJsonLdOptions,
  verifyJsonLd,
  type VerifyJsonLdOptions,
  verifySignature,
  type VerifySignatureOptions,
} from "./ld.ts";
export {
  doesActorOwnKey,
  type DoesActorOwnKeyOptions,
  getKeyOwner,
  type GetKeyOwnerOptions,
} from "./owner.ts";
export * from "./proof.ts";
