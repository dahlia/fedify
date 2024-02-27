import { equals } from "https://deno.land/std@0.217.0/bytes/mod.ts";
import {
  decodeBase64,
  encodeBase64,
} from "https://deno.land/std@0.217.0/encoding/base64.ts";
import { DocumentLoader } from "../runtime/docloader.ts";
import { CryptographicKey, Object as ASObject } from "../vocab/mod.ts";
import { isActor } from "../vocab/actor.ts";

const supportedHashAlgorithms = {
  "sha": "SHA-1",
  "sha-256": "SHA-256",
  "sha-512": "SHA-512",
};

/**
 * Verifies the signature of a request.
 *
 * Note that this function consumes the request body, so it should not be used
 * if the request body is already consumed.  Consuming the request body after
 * calling this function is okay, since this function clones the request
 * under the hood.
 * @param request The request to verify.
 * @param documentLoader The document loader to use for fetching the public key.
 * @returns The key ID of the verified signature, or `null` if the signature
 *          could not be verified.
 */
export async function verify(
  request: Request,
  documentLoader: DocumentLoader,
): Promise<URL | null> {
  request = request.clone();
  const sigHeader = request.headers.get("Signature");
  if (sigHeader == null) return null;
  const digestHeader = request.headers.get("Digest");
  if (
    request.method !== "GET" && request.method !== "HEAD" &&
    digestHeader == null
  ) {
    return null;
  }
  let body: ArrayBuffer | null = null;
  if (digestHeader != null) {
    body = await request.arrayBuffer();
    const digests = digestHeader.split(",").map((pair) =>
      pair.includes("=") ? pair.split("=", 2) as [string, string] : [pair, ""]
    );
    let matched = false;
    for (let [algo, digestBase64] of digests) {
      algo = algo.trim().toLowerCase();
      if (!(algo in supportedHashAlgorithms)) continue;
      const digest = decodeBase64(digestBase64);
      const expectedDigest = await crypto.subtle.digest(
        supportedHashAlgorithms[algo],
        body,
      );
      if (!equals(digest, new Uint8Array(expectedDigest))) return null;
      matched = true;
    }
    if (!matched) return null;
  }
  const sigValues = Object.fromEntries(
    sigHeader.split(",").map((pair) =>
      pair.match(/^\s*([A-Za-z]+)="([^"]*)"\s*$/)
    ).filter((m) => m != null).map((m) => m!.slice(1, 3) as [string, string]),
  );
  if (
    !("keyId" in sigValues && "headers" in sigValues &&
      "signature" in sigValues)
  ) {
    return null;
  }
  const { keyId, headers, signature } = sigValues;
  const { document } = await documentLoader(keyId);
  const object = await ASObject.fromJsonLd(document);
  let key: CryptographicKey | null = null;
  if (object instanceof CryptographicKey) key = object;
  else if (isActor(object)) {
    for await (const k of object.getPublicKeys({ documentLoader })) {
      if (k.id?.href === keyId) {
        key = k;
        break;
      }
    }
    if (key == null) return null;
  } else return null;
  if (key.publicKey == null) return null;
  const headerNames = headers.split(/\s+/g);
  if (
    !headerNames.includes("(request-target)") || !headerNames.includes("date")
  ) {
    return null;
  }
  if (body != null && !headerNames.includes("digest")) return null;
  const message = headerNames.map((name) =>
    `${name}: ` +
    (name == "(request-target)"
      ? `${request.method.toLowerCase()} ${new URL(request.url).pathname}`
      : request.headers.get(name))
  ).join("\n");
  const sig = decodeBase64(signature);
  // TODO: support other than RSASSA-PKCS1-v1_5:
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key.publicKey,
    sig,
    new TextEncoder().encode(message),
  );
  return verified ? new URL(keyId) : null;
}
