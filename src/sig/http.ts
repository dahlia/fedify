import { getLogger } from "@logtape/logtape";
import {
  type Span,
  SpanStatusCode,
  trace,
  type TracerProvider,
} from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_URL_FULL,
} from "@opentelemetry/semantic-conventions";
import { equals } from "@std/bytes";
import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import { encodeHex } from "@std/encoding/hex";
import metadata from "../deno.json" with { type: "json" };
import type { DocumentLoader } from "../runtime/docloader.ts";
import { CryptographicKey } from "../vocab/vocab.ts";
import { fetchKey, type KeyCache, validateCryptoKey } from "./key.ts";

/**
 * Options for {@link signRequest}.
 * @since 1.3.0
 */
export interface SignRequestOptions {
  /**
   * The OpenTelemetry tracer provider.  If omitted, the global tracer provider
   * is used.
   */
  tracerProvider?: TracerProvider;
}

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
  options: SignRequestOptions = {},
): Promise<Request> {
  const tracerProvider = options.tracerProvider ?? trace.getTracerProvider();
  const tracer = tracerProvider.getTracer(
    metadata.name,
    metadata.version,
  );
  return await tracer.startActiveSpan(
    "http_signatures.sign",
    async (span) => {
      try {
        const signed = await signRequestInternal(
          request,
          privateKey,
          keyId,
          span,
        );
        if (span.isRecording()) {
          span.setAttribute(ATTR_HTTP_REQUEST_METHOD, signed.method);
          span.setAttribute(ATTR_URL_FULL, signed.url);
          for (const [name, value] of signed.headers) {
            span.setAttribute(ATTR_HTTP_REQUEST_HEADER(name), value);
          }
          span.setAttribute("http_signatures.key_id", keyId.href);
        }
        return signed;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

async function signRequestInternal(
  request: Request,
  privateKey: CryptoKey,
  keyId: URL,
  span: Span,
): Promise<Request> {
  validateCryptoKey(privateKey, "private");
  if (privateKey.algorithm.name !== "RSASSA-PKCS1-v1_5") {
    throw new TypeError("Unsupported algorithm: " + privateKey.algorithm.name);
  }
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
    headers.set("Digest", `SHA-256=${encodeBase64(digest)}`);
    if (span.isRecording()) {
      span.setAttribute("http_signatures.digest.sha-256", encodeHex(digest));
    }
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
  const sigHeader = `keyId="${keyId.href}",algorithm="rsa-sha256",headers="${
    headerNames.join(" ")
  }",signature="${encodeBase64(signature)}"`;
  headers.set("Signature", sigHeader);
  if (span.isRecording()) {
    span.setAttribute("http_signatures.algorithm", "rsa-sha256");
    span.setAttribute("http_signatures.signature", encodeHex(signature));
  }
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
 * Options for {@link verifyRequest}.
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
   * Or if it is `false`, no time check is performed.
   *
   * An hour by default.
   */
  timeWindow?: Temporal.Duration | Temporal.DurationLike | false;

  /**
   * The current time.  If not specified, the current time is used.  This is
   * useful for testing.
   */
  currentTime?: Temporal.Instant;

  /**
   * The key cache to use for caching public keys.
   * @since 0.12.0
   */
  keyCache?: KeyCache;

  /**
   * The OpenTelemetry tracer provider.  If omitted, the global tracer provider
   * is used.
   * @since 1.3.0
   */
  tracerProvider?: TracerProvider;
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
  options: VerifyRequestOptions = {},
): Promise<CryptographicKey | null> {
  const tracerProvider = options.tracerProvider ?? trace.getTracerProvider();
  const tracer = tracerProvider.getTracer(
    metadata.name,
    metadata.version,
  );
  return await tracer.startActiveSpan(
    "http_signatures.verify",
    async (span) => {
      if (span.isRecording()) {
        span.setAttribute(ATTR_HTTP_REQUEST_METHOD, request.method);
        span.setAttribute(ATTR_URL_FULL, request.url);
        for (const [name, value] of request.headers) {
          span.setAttribute(ATTR_HTTP_REQUEST_HEADER(name), value);
        }
      }
      try {
        const key = await verifyRequestInternal(request, span, options);
        if (key == null) span.setStatus({ code: SpanStatusCode.ERROR });
        return key;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

async function verifyRequestInternal(
  request: Request,
  span: Span,
  {
    documentLoader,
    contextLoader,
    timeWindow,
    currentTime,
    keyCache,
  }: VerifyRequestOptions = {},
): Promise<CryptographicKey | null> {
  const logger = getLogger(["fedify", "sig", "http"]);
  if (request.bodyUsed) {
    logger.error(
      "Failed to verify; the request body is already consumed.",
      { url: request.url },
    );
    return null;
  } else if (request.body?.locked) {
    logger.error(
      "Failed to verify; the request body is locked.",
      { url: request.url },
    );
    return null;
  }
  const originalRequest = request;
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
      let digest: Uint8Array;
      try {
        digest = decodeBase64(digestBase64);
      } catch (error) {
        logger.debug("Failed to verify; invalid base64 encoding: {digest}.", {
          digest: digestBase64,
          error,
        });
        return null;
      }
      if (span.isRecording()) {
        span.setAttribute(`http_signatures.digest.${algo}`, encodeHex(digest));
      }
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
  if (timeWindow !== false) {
    const tw: Temporal.Duration | Temporal.DurationLike = timeWindow ??
      { hours: 1 };
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
  span?.setAttribute("http_signatures.key_id", keyId);
  span?.setAttribute("http_signatures.signature", signature);
  if ("algorithm" in sigValues) {
    span?.setAttribute("http_signatures.algorithm", sigValues.algorithm);
  }
  const { key, cached } = await fetchKey(new URL(keyId), CryptographicKey, {
    documentLoader,
    contextLoader,
    keyCache,
  });
  if (key == null) return null;
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
    if (cached) {
      logger.debug(
        "Failed to verify with the cached key {keyId}; signature {signature} " +
          "is invalid.  Retrying with the freshly fetched key...",
        { keyId, signature, message },
      );
      return await verifyRequest(
        originalRequest,
        {
          documentLoader,
          contextLoader,
          timeWindow,
          currentTime,
          keyCache: {
            get: () => Promise.resolve(undefined),
            set: async (keyId, key) => await keyCache?.set(keyId, key),
          },
        },
      );
    }
    logger.debug(
      "Failed to verify with the fetched key {keyId}; signature {signature} " +
        "is invalid.  Check if the key is correct or if the signed message " +
        "is correct.  The message to sign is:\n{message}",
      { keyId, signature, message },
    );
    return null;
  }
  return key;
}
