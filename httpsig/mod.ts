/**
 * The implementation of the [HTTP
 * Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures-12).
 *
 * @module
 */
import { equals } from "jsr:@std/bytes@^0.218.2";
import { decodeBase64, encodeBase64 } from "jsr:@std/encoding@^0.218.2/base64";
import { DocumentLoader } from "../runtime/docloader.ts";
import { CryptographicKey, Object as ASObject } from "../vocab/mod.ts";
import { isActor } from "../vocab/actor.ts";
import { validateCryptoKey } from "./key.ts";

/**
 * Signs a request using the given private key.
 * @param request The request to sign.
 * @param privateKey The private key to use for signing.
 * @param keyId The key ID to use for the signature.  It will be used by the
 *              verifier.
 * @returns The signed request.
 */
export async function sign(
  request: Request,
  privateKey: CryptoKey,
  keyId: URL,
): Promise<Request> {
  validateCryptoKey(privateKey, "private");
  const url = new URL(request.url);
  const body: ArrayBuffer | null =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : null;
  const headers = new Headers(request.headers);
  if (!headers.has("Host")) {
    headers.set("Host", url.host);
  }
  if (!headers.has("Digest") && body != null) {
    const digest = await crypto.subtle.digest("SHA-256", body);
    headers.set("Digest", `sha-256=${encodeBase64(digest)}`);
  }
  if (!headers.has("Date")) {
    headers.set("Date", new Date().toUTCString());
  }
  const serialized: [string, string][] = [
    ["(request-target)", `${request.method.toLowerCase()} ${url.pathname}`],
    ...headers,
  ];
  const headerNames: string[] = serialized.map(([name]) => name);
  const message = serialized
    .map(([name, value]) => `${name}: ${value.trim()}`).join("\n");
  // TODO: support other than RSASSA-PKCS1-v1_5:
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(message),
  );
  const sigHeader = `keyId="${keyId.href}",headers="${
    headerNames.join(" ")
  }",signature="${encodeBase64(signature)}"`;
  headers.set("Signature", sigHeader);
  return new Request(request, {
    headers,
    body,
  });
}

const supportedHashAlgorithms: Record<string, string> = {
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
  const dateHeader = request.headers.get("Date");
  if (dateHeader == null) return null;
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
  const date = Temporal.Instant.from(new Date(dateHeader).toISOString());
  const now = Temporal.Now.instant();
  if (Temporal.Instant.compare(date, now.add({ seconds: 30 })) > 0) {
    // Too far in the future
    return null;
  } else if (
    Temporal.Instant.compare(date, now.subtract({ seconds: 30 })) < 0
  ) {
    // Too far in the past
    return null;
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
