import { getLogger } from "@logtape/logtape";
import type { KvKey, KvStore } from "../federation/kv.ts";
import { signRequest } from "../sig/http.ts";
import { validateCryptoKey } from "../sig/key.ts";

const logger = getLogger(["fedify", "runtime", "docloader"]);

/**
 * A remote JSON-LD document and its context fetched by
 * a {@link DocumentLoader}.
 */
export interface RemoteDocument {
  contextUrl: string | null;
  document: unknown;
  documentUrl: string;
}

/**
 * A JSON-LD document loader that fetches documents from the Web.
 * @param url The URL of the document to load.
 * @returns The loaded remote document.
 */
export type DocumentLoader = (url: string) => Promise<RemoteDocument>;

/**
 * A factory function that creates an authenticated {@link DocumentLoader} for
 * a given identity.  This is used for fetching documents that require
 * authentication.
 * @param identity The identity to create the document loader for.
 *                 The actor's key pair.
 * @returns The authenticated document loader.
 * @since 0.4.0
 */
export type AuthenticatedDocumentLoaderFactory = (
  identity: { keyId: URL; privateKey: CryptoKey },
) => DocumentLoader;

/**
 * Error thrown when fetching a JSON-LD document failed.
 */
export class FetchError extends Error {
  /**
   * The URL that failed to fetch.
   */
  url: URL;

  /**
   * Constructs a new `FetchError`.
   *
   * @param url The URL that failed to fetch.
   * @param message Error message.
   */
  constructor(url: URL | string, message?: string) {
    super(message == null ? url.toString() : `${url}: ${message}`);
    this.name = "FetchError";
    this.url = typeof url === "string" ? new URL(url) : url;
  }
}

function createRequest(url: string): Request {
  return new Request(url, {
    headers: {
      Accept: "application/activity+json, application/ld+json",
    },
    redirect: "manual",
  });
}

function logRequest(request: Request) {
  logger.debug(
    "Fetching document: {method} {url} {headers}",
    {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    },
  );
}

async function getRemoteDocument(
  url: string,
  response: Response,
): Promise<RemoteDocument> {
  const documentUrl = response.url === "" ? url : response.url;
  if (!response.ok) {
    logger.error(
      "Failed to fetch document: {status} {url} {headers}",
      {
        status: response.status,
        url: documentUrl,
        headers: Object.fromEntries(response.headers.entries()),
      },
    );
    throw new FetchError(
      documentUrl,
      `HTTP ${response.status}: ${documentUrl}`,
    );
  }
  logger.debug(
    "Fetched document: {status} {url} {headers}",
    {
      status: response.status,
      url: documentUrl,
      headers: Object.fromEntries(response.headers.entries()),
    },
  );
  return {
    contextUrl: null,
    document: await response.json(),
    documentUrl,
  };
}

/**
 * A JSON-LD document loader that utilizes the browser's `fetch` API.
 * @param url The URL of the document to load.
 * @returns The remote document.
 */
export async function fetchDocumentLoader(
  url: string,
): Promise<RemoteDocument> {
  const request = createRequest(url);
  logRequest(request);
  const response = await fetch(request, {
    // Since Bun has a bug that ignores the `Request.redirect` option,
    // to work around it we specify `redirect: "manual"` here too:
    // https://github.com/oven-sh/bun/issues/10754
    redirect: "manual",
  });
  // Follow redirects manually to get the final URL:
  if (
    response.status >= 300 && response.status < 400 &&
    response.headers.has("Location")
  ) {
    return fetchDocumentLoader(response.headers.get("Location")!);
  }
  return getRemoteDocument(url, response);
}

/**
 * Gets an authenticated {@link DocumentLoader} for the given identity.
 * Note that an authenticated document loader intentionally does not cache
 * the fetched documents.
 * @param identity The identity to get the document loader for.
 *                 The actor's key pair.
 * @returns The authenticated document loader.
 * @throws {TypeError} If the key is invalid or unsupported.
 * @since 0.4.0
 */
export function getAuthenticatedDocumentLoader(
  identity: { keyId: URL; privateKey: CryptoKey },
): DocumentLoader {
  validateCryptoKey(identity.privateKey);
  async function load(url: string): Promise<RemoteDocument> {
    let request = createRequest(url);
    request = await signRequest(request, identity.privateKey, identity.keyId);
    logRequest(request);
    const response = await fetch(request, {
      // Since Bun has a bug that ignores the `Request.redirect` option,
      // to work around it we specify `redirect: "manual"` here too:
      // https://github.com/oven-sh/bun/issues/10754
      redirect: "manual",
    });
    // Follow redirects manually to get the final URL:
    if (
      response.status >= 300 && response.status < 400 &&
      response.headers.has("Location")
    ) {
      return load(response.headers.get("Location")!);
    }
    return getRemoteDocument(url, response);
  }
  return load;
}

/**
 * The parameters for {@link kvCache} function.
 */
export interface KvCacheParameters {
  /**
   * The document loader to decorate with a cache.
   */
  loader: DocumentLoader;

  /**
   * The key-value store to use for backing the cache.
   */
  kv: KvStore;

  /**
   * The key prefix to use for namespacing the cache.
   * `["_fedify", "remoteDocument"]` by default.
   */
  prefix?: KvKey;

  /**
   * The per-URL cache rules in the array of `[urlPattern, duration]` pairs
   * where `urlPattern` is either a string, a {@link URL}, or
   * a {@link URLPattern} and `duration` is a {@link Temporal.Duration}.
   * The `duration` is allowed to be at most 30 days.
   *
   * The default rules are:
   *
   * - `https://www.w3.org/ns/activitystreams` for 30 days
   * - `https://w3id.org/security/v1` for 30 days
   * - Everything else for 5 minutes
   */
  rules?: [string | URL | URLPattern, Temporal.Duration][];
}

/**
 * Decorates a {@link DocumentLoader} with a cache backed by a {@link Deno.Kv}.
 * @param parameters The parameters for the cache.
 * @returns The decorated document loader which is cache-enabled.
 */
export function kvCache(
  { loader, kv, prefix, rules }: KvCacheParameters,
): DocumentLoader {
  const keyPrefix = prefix ?? ["_fedify", "remoteDocument"];
  rules ??= [
    [
      "https://www.w3.org/ns/activitystreams",
      Temporal.Duration.from({ days: 30 }),
    ],
    ["https://w3id.org/security/v1", Temporal.Duration.from({ days: 30 })],
    [new URLPattern({}), Temporal.Duration.from({ minutes: 5 })],
  ];
  for (const [p, duration] of rules) {
    if (Temporal.Duration.compare(duration, { days: 30 }) > 0) {
      throw new TypeError(
        "The maximum cache duration is 30 days: " +
          (p instanceof URLPattern
            ? `${p.protocol}://${p.username}:${p.password}@${p.hostname}:${p.port}/${p.pathname}?${p.search}#${p.hash}`
            : p.toString()),
      );
    }
  }

  function matchRule(url: string): Temporal.Duration | null {
    for (const [pattern, duration] of rules!) {
      if (typeof pattern === "string") {
        if (url === pattern) return duration;
        continue;
      }
      if (pattern instanceof URL) {
        if (pattern.href == url) return duration;
        continue;
      }
      if (pattern.test(url)) return duration;
    }
    return null;
  }

  return async (url: string): Promise<RemoteDocument> => {
    const match = matchRule(url);
    if (match == null) return await loader(url);
    const key: KvKey = [...keyPrefix, url];
    const cache = await kv.get<RemoteDocument>(key);
    if (cache == null) {
      const remoteDoc = await loader(url);
      await kv.set(key, remoteDoc, { ttl: match });
      return remoteDoc;
    }
    return cache;
  };
}
