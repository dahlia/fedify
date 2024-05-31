import { getLogger } from "@logtape/logtape";
import { equals } from "@std/bytes";
import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import {
  type DocumentLoader,
  fetchDocumentLoader,
} from "../runtime/docloader.ts";
import { isActor } from "../vocab/actor.ts";
import { CryptographicKey, Object as ASObject } from "../vocab/vocab.ts";
import { validateCryptoKey } from "./key.ts";

/**
 * Signs a request using the given private key.
 * @param request The request to sign.
 * @param privateKey The private key to use for signing.
 * @param keyId The key ID to use for the signature.  It will be used by the
 *              verifier.
 * @returns The signed request.
 * @throws {TypeError} If the private key is invalid or unsupported.
 */
export async function signRequest(
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
 * Options for {@link verify}.
 */
export interface VerifyRequestOptions {
  /**
   * The document loader to use for fetching the public key.
   */
  documentLoader?: DocumentLoader;

  /**
   * The context loader to use for JSON-LD context retrieval.
   */
  contextLoader?: DocumentLoader;

  /**
   * The time window to allow for the request date.  The actual time window is
   * twice the value of this option, with the current time as the center.
   * A minute by default.
   */
  timeWindow?: Temporal.DurationLike;

  /**
   * The current time.  If not specified, the current time is used.  This is
   * useful for testing.
   */
  currentTime?: Temporal.Instant;
}

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
 */
export async function verifyRequest(
  request: Request,
  { documentLoader, contextLoader, timeWindow, currentTime }:
    VerifyRequestOptions = {},
): Promise<CryptographicKey | null> {
  const logger = getLogger(["fedify", "sig", "http"]);
  request = request.clone();
  const dateHeader = request.headers.get("Date");
  if (dateHeader == null) {
    logger.debug(
      "Failed to verify; no Date header found.",
      { headers: Object.fromEntries(request.headers.entries()) },
    );
    return null;
  }
  const sigHeader = request.headers.get("Signature");
  if (sigHeader == null) {
    logger.debug(
      "Failed to verify; no Signature header found.",
      { headers: Object.fromEntries(request.headers.entries()) },
    );
    return null;
  }
  const digestHeader = request.headers.get("Digest");
  if (
    request.method !== "GET" && request.method !== "HEAD" &&
    digestHeader == null
  ) {
    logger.debug(
      "Failed to verify; no Digest header found.",
      { headers: Object.fromEntries(request.headers.entries()) },
    );
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
      if (!equals(digest, new Uint8Array(expectedDigest))) {
        logger.debug(
          "Failed to verify; digest mismatch ({algorithm}): " +
            "{digest} != {expectedDigest}.",
          {
            algorithm: algo,
            digest: digestBase64,
            expectedDigest: encodeBase64(expectedDigest),
          },
        );
        return null;
      }
      matched = true;
    }
    if (!matched) {
      logger.debug(
        "Failed to verify; no supported digest algorithm found.  " +
          "Supported: {supportedAlgorithms}; found: {algorithms}.",
        {
          supportedAlgorithms: Object.keys(supportedHashAlgorithms),
          algorithms: digests.map(([algo]) => algo),
        },
      );
      return null;
    }
  }
  const date = Temporal.Instant.from(new Date(dateHeader).toISOString());
  const now = currentTime ?? Temporal.Now.instant();
  const tw: Temporal.DurationLike = timeWindow ?? { minutes: 1 };
  if (Temporal.Instant.compare(date, now.add(tw)) > 0) {
    logger.debug(
      "Failed to verify; Date is too far in the future.",
      { date: date.toString(), now: now.toString() },
    );
    return null;
  } else if (Temporal.Instant.compare(date, now.subtract(tw)) < 0) {
    logger.debug(
      "Failed to verify; Date is too far in the past.",
      { date: date.toString(), now: now.toString() },
    );
    return null;
  }
  const sigValues = Object.fromEntries(
    sigHeader.split(",").map((pair) =>
      pair.match(/^\s*([A-Za-z]+)="([^"]*)"\s*$/)
    ).filter((m) => m != null).map((m) => m!.slice(1, 3) as [string, string]),
  );
  if (!("keyId" in sigValues)) {
    logger.debug(
      "Failed to verify; no keyId field found in the Signature header.",
      { signature: sigHeader },
    );
    return null;
  } else if (!("headers" in sigValues)) {
    logger.debug(
      "Failed to verify; no headers field found in the Signature header.",
      { signature: sigHeader },
    );
    return null;
  } else if (!("signature" in sigValues)) {
    logger.debug(
      "Failed to verify; no signature field found in the Signature header.",
      { signature: sigHeader },
    );
    return null;
  }
  const { keyId, headers, signature } = sigValues;
  logger.debug("Fetching key {keyId} to verify signature...", { keyId });
  let document: unknown;
  try {
    const remoteDocument = await (documentLoader ?? fetchDocumentLoader)(keyId);
    document = remoteDocument.document;
  } catch (_) {
    logger.debug("Failed to fetch key {keyId}.", { keyId });
    return null;
  }
  let object: ASObject | CryptographicKey;
  try {
    object = await ASObject.fromJsonLd(document, {
      documentLoader,
      contextLoader,
    });
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    try {
      object = await CryptographicKey.fromJsonLd(document, {
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
  let key: CryptographicKey | null = null;
  if (object instanceof CryptographicKey) key = object;
  else if (isActor(object)) {
    for await (
      const k of object.getPublicKeys({ documentLoader, contextLoader })
    ) {
      if (k.id?.href === keyId) {
        key = k;
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
  const headerNames = headers.split(/\s+/g);
  if (
    !headerNames.includes("(request-target)") || !headerNames.includes("date")
  ) {
    logger.debug(
      "Failed to verify; required headers missing in the Signature header: " +
        "{headers}.",
      { headers },
    );
    return null;
  }
  if (body != null && !headerNames.includes("digest")) {
    logger.debug(
      "Failed to verify; required headers missing in the Signature header: " +
        "{headers}.",
      { headers },
    );
    return null;
  }
  const message = headerNames.map((name) =>
    `${name}: ` +
    (name == "(request-target)"
      ? `${request.method.toLowerCase()} ${new URL(request.url).pathname}`
      : name == "host"
      ? request.headers.get("host") ?? new URL(request.url).host
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
  if (!verified) {
    logger.debug(
      "Failed to verify; signature {signature} is invalid.  " +
        "Check if the key is correct or if the signed message is correct.  " +
        "The message to sign is:\n{message}",
      { signature, message },
    );
    return null;
  }
  return key;
}
