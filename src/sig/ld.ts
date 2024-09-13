import { getLogger } from "@logtape/logtape";
import { decodeBase64 } from "@std/encoding/base64";
import { encodeHex } from "@std/encoding/hex";
import jsonld from "jsonld";
import {
  type DocumentLoader,
  fetchDocumentLoader,
} from "../runtime/docloader.ts";
import { Activity, CryptographicKey, Object } from "../vocab/vocab.ts";
import { fetchKey, type KeyCache } from "./key.ts";

const logger = getLogger(["fedify", "sig", "ld"]);

interface SignedJsonLd {
  signature: {
    type: "RsaSignature2017";
    creator: string;
    created: string;
    signatureValue: string;
  };
}

function hasSignature(jsonLd: unknown): jsonLd is SignedJsonLd {
  if (typeof jsonLd !== "object" || jsonLd == null) return false;
  if ("signature" in jsonLd) {
    const signature = jsonLd.signature;
    if (typeof signature !== "object" || signature == null) return false;
    return "type" in signature && signature.type === "RsaSignature2017" &&
      "creator" in signature && typeof signature.creator === "string" &&
      "created" in signature && typeof signature.created === "string" &&
      "signatureValue" in signature &&
      typeof signature.signatureValue === "string";
  }
  return false;
}

/**
 * Detaches Linked Data Signatures from the given JSON-LD document.
 * @param jsonLd The JSON-LD document to modify.
 * @returns The modified JSON-LD document.  If the input document does not
 *          contain a signature, the original document is returned.
 * @since 1.0.0
 */
export function detachSignature(jsonLd: unknown): unknown {
  if (typeof jsonLd !== "object" || jsonLd == null) return jsonLd;
  const doc: { signature?: unknown } = { ...jsonLd };
  delete doc.signature;
  return doc;
}

/**
 * Options for verifying Linked Data Signatures.
 * @since 1.0.0
 */
export interface VerifySignatureOptions {
  /**
   * The document loader to use for fetching the public key.
   */
  documentLoader?: DocumentLoader;

  /**
   * The context loader to use for JSON-LD context retrieval.
   */
  contextLoader?: DocumentLoader;

  /**
   * The key cache to use for caching public keys.
   */
  keyCache?: KeyCache;
}

/**
 * Verifies Linked Data Signatures of the given JSON-LD document.
 * @param jsonLd The JSON-LD document to verify.
 * @param options Options for verifying the signature.
 * @returns The public key that signed the document or `null` if the signature
 *          is invalid or the key is not found.
 * @since 1.0.0
 */
export async function verifySignature(
  jsonLd: unknown,
  options: VerifySignatureOptions = {},
): Promise<CryptographicKey | null> {
  if (!hasSignature(jsonLd)) return null;
  const sig = jsonLd.signature;
  let signature: Uint8Array;
  try {
    signature = decodeBase64(sig.signatureValue);
  } catch (error) {
    logger.debug(
      "Failed to verify; invalid base64 signatureValue: {signatureValue}",
      { ...sig, error },
    );
    return null;
  }
  const keyResult = await fetchKey(
    new URL(sig.creator),
    CryptographicKey,
    options,
  );
  if (keyResult == null) return null;
  const { key, cached } = keyResult;
  const sigOpts: {
    "@context": string;
    type?: string;
    id?: string;
    signatureValue?: string;
  } = {
    ...sig,
    "@context": "https://w3id.org/identity/v1",
  };
  delete sigOpts.type;
  delete sigOpts.id;
  delete sigOpts.signatureValue;
  const sigOptsHash = await hashJsonLd(sigOpts, options.contextLoader);
  const document: { signature?: unknown } = { ...jsonLd };
  delete document.signature;
  const docHash = await hashJsonLd(document, options.contextLoader);
  const encoder = new TextEncoder();
  const message = sigOptsHash + docHash;
  const messageBytes = encoder.encode(message);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key.publicKey,
    signature,
    messageBytes,
  );
  if (verified) return key;
  if (cached) {
    logger.debug(
      "Failed to verify with the cached key {keyId}; " +
        "signature {signatureValue} is invalid.  " +
        "Retrying with the freshly fetched key...",
      { keyId: sig.creator, ...sig },
    );
    const keyResult = await fetchKey(
      new URL(sig.creator),
      CryptographicKey,
      { ...options, keyCache: undefined },
    );
    if (keyResult == null) return null;
    const { key } = keyResult;
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key.publicKey,
      signature,
      messageBytes,
    );
    return verified ? key : null;
  }
  logger.debug(
    "Failed to verify with the fetched key {keyId}; " +
      "signature {signatureValue} is invalid.  " +
      "Check if the key is correct or if the signed message is correct.  " +
      "The message to sign is:\n{message}",
    { keyId: sig.creator, ...sig, message },
  );
  return null;
}

/**
 * Options for verifying JSON-LD documents.
 */
export interface VerifyJsonLdOptions extends VerifySignatureOptions {
}

/**
 * Verify the authenticity of the given JSON-LD document using Linked Data
 * Signatures.  If the document is signed, this function verifies the signature
 * and checks if the document is attributed to the owner of the public key.
 * If the document is not signed, this function returns `false`.
 * @param jsonLd The JSON-LD document to verify.
 * @param options Options for verifying the document.
 * @returns `true` if the document is authentic; `false` otherwise.
 */
export async function verifyJsonLd(
  jsonLd: unknown,
  options: VerifyJsonLdOptions = {},
): Promise<boolean> {
  const object = await Object.fromJsonLd(jsonLd, options);
  const attributions = new Set(object.attributionIds.map((uri) => uri.href));
  if (object instanceof Activity) {
    for (const uri of object.actorIds) attributions.add(uri.href);
  }
  const key = await verifySignature(jsonLd, options);
  if (key == null) return false;
  if (key.ownerId == null) {
    logger.debug("Key {keyId} has no owner.", { keyId: key.id?.href });
    return false;
  }
  attributions.delete(key.ownerId.href);
  if (attributions.size > 0) {
    logger.debug(
      "Some attributions are not authenticated by the Linked Data Signatures" +
        ": {attributions}.",
      { attributions: [...attributions] },
    );
    return false;
  }
  return true;
}

async function hashJsonLd(
  jsonLd: unknown,
  contextLoader: DocumentLoader | undefined,
): Promise<string> {
  const canon = await jsonld.canonize(jsonLd, {
    format: "application/n-quads",
    documentLoader: contextLoader ?? fetchDocumentLoader,
  });
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(canon));
  return encodeHex(hash);
}

// cSpell: ignore URGNA2012
