import { HTTPHeaderLink } from "@hugoalh/http-header-link";
import { getLogger } from "@logtape/logtape";
import process from "node:process";
import metadata from "../deno.json" with { type: "json" };
import type { KvKey, KvStore } from "../federation/kv.ts";
import { signRequest } from "../sig/http.ts";
import { validateCryptoKey } from "../sig/key.ts";
import preloadedContexts from "./contexts.ts";
import { UrlError, validatePublicUrl } from "./url.ts";

const logger = getLogger(["fedify", "runtime", "docloader"]);

/**
 * A remote JSON-LD document and its context fetched by
 * a {@link DocumentLoader}.
 */
export interface RemoteDocument {
  /**
   * The URL of the context document.
   */
  contextUrl: string | null;

  /**
   * The fetched JSON-LD document.
   */
  document: unknown;

  /**
   * The URL of the fetched document.
   */
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

interface CreateRequestOptions {
  userAgent?: GetUserAgentOptions | string;
}

function createRequest(
  url: string,
  options: CreateRequestOptions = {},
): Request {
  return new Request(url, {
    headers: {
      Accept: "application/activity+json, application/ld+json",
      "User-Agent": typeof options.userAgent === "string"
        ? options.userAgent
        : getUserAgent(options.userAgent),
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
  fetch: (url: string) => Promise<RemoteDocument>,
): Promise<RemoteDocument> {
  const documentUrl = response.url === "" ? url : response.url;
  const docUrl = new URL(documentUrl);
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
  const contentType = response.headers.get("Content-Type");
  const jsonLd = contentType == null ||
    contentType === "application/activity+json" ||
    contentType.startsWith("application/activity+json;") ||
    contentType === "application/ld+json" ||
    contentType.startsWith("application/ld+json;");
  const linkHeader = response.headers.get("Link");
  let contextUrl: string | null = null;
  if (linkHeader != null) {
    const link = new HTTPHeaderLink(linkHeader);
    if (jsonLd) {
      const entries = link.getByRel("http://www.w3.org/ns/json-ld#context");
      for (const [uri, params] of entries) {
        if ("type" in params && params.type === "application/ld+json") {
          contextUrl = uri;
          break;
        }
      }
    } else {
      const entries = link.getByRel("alternate");
      for (const [uri, params] of entries) {
        const altUri = new URL(uri, docUrl);
        if (
          "type" in params &&
          (params.type === "application/activity+json" ||
            params.type === "application/ld+json" ||
            params.type.startsWith("application/ld+json;")) &&
          altUri.href !== docUrl.href
        ) {
          logger.debug(
            "Found alternate document: {alternateUrl} from {url}",
            { alternateUrl: altUri.href, url: documentUrl },
          );
          return await fetch(altUri.href);
        }
      }
    }
  }
  let document: unknown;
  if (
    !jsonLd &&
    (contentType === "text/html" || contentType?.startsWith("text/html;") ||
      contentType === "application/xhtml+xml" ||
      contentType?.startsWith("application/xhtml+xml;"))
  ) {
    const p = /<(a|link)((\s+[a-z][a-z:_-]*=("[^"]*"|'[^']*'|[^\s>]+))+)\/?>/ig;
    const p2 = /\s+([a-z][a-z:_-]*)=("([^"]*)"|'([^']*)'|([^\s>]+))/ig;
    const html = await response.text();
    let m: RegExpExecArray | null;
    const rawAttribs: string[] = [];
    while ((m = p.exec(html)) !== null) rawAttribs.push(m[2]);
    for (const rawAttrs of rawAttribs) {
      let m2: RegExpExecArray | null;
      const attribs: Record<string, string> = {};
      while ((m2 = p2.exec(rawAttrs)) !== null) {
        const key = m2[1].toLowerCase();
        const value = m2[3] ?? m2[4] ?? m2[5] ?? "";
        attribs[key] = value;
      }
      if (
        attribs.rel === "alternate" && "type" in attribs && (
          attribs.type === "application/activity+json" ||
          attribs.type === "application/ld+json" ||
          attribs.type.startsWith("application/ld+json;")
        ) && "href" in attribs &&
        new URL(attribs.href, docUrl).href !== docUrl.href
      ) {
        logger.debug(
          "Found alternate document: {alternateUrl} from {url}",
          { alternateUrl: attribs.href, url: documentUrl },
        );
        return await fetch(new URL(attribs.href, docUrl).href);
      }
    }
    document = JSON.parse(html);
  } else {
    document = await response.json();
  }
  logger.debug(
    "Fetched document: {status} {url} {headers}",
    {
      status: response.status,
      url: documentUrl,
      headers: Object.fromEntries(response.headers.entries()),
    },
  );
  return { contextUrl, document, documentUrl };
}

/**
 * Options for {@link getDocumentLoader}.
 * @since 1.3.0
 */
export interface GetDocumentLoaderOptions {
  /**
   * Whether to allow fetching private network addresses.
   * Turned off by default.
   */
  allowPrivateAddress?: boolean;

  /**
   * Options for making `User-Agent` string.
   * If a string is given, it is used as the `User-Agent` header value.
   * If an object is given, it is passed to {@link getUserAgent} function.
   */
  userAgent?: GetUserAgentOptions | string;

  /**
   * Whether to preload the frequently used contexts.
   */
  skipPreloadedContexts?: boolean;

  signal?: AbortSignal | null;
}

/**
 * Creates a JSON-LD document loader that utilizes the browser's `fetch` API.
 *
 * The created loader preloads the below frequently used contexts by default
 * (unless `options.ignorePreloadedContexts` is set to `true`):
 *
 * - <https://www.w3.org/ns/activitystreams>
 * - <https://w3id.org/security/v1>
 * - <https://w3id.org/security/data-integrity/v1>
 * - <https://www.w3.org/ns/did/v1>
 * - <https://w3id.org/security/multikey/v1>
 * - <https://purl.archive.org/socialweb/webfinger>
 * - <http://schema.org/>
 * @param options Options for the document loader.
 * @returns The document loader.
 * @since 1.3.0
 */
export function getDocumentLoader(
  { allowPrivateAddress, skipPreloadedContexts, userAgent, signal }:
    GetDocumentLoaderOptions = {},
): DocumentLoader {
  async function load(url: string): Promise<RemoteDocument> {
    if (!skipPreloadedContexts && url in preloadedContexts) {
      logger.debug("Using preloaded context: {url}.", { url });
      return {
        contextUrl: null,
        document: preloadedContexts[url],
        documentUrl: url,
      };
    }
    if (!allowPrivateAddress) {
      try {
        await validatePublicUrl(url);
      } catch (error) {
        if (error instanceof UrlError) {
          logger.error("Disallowed private URL: {url}", { url, error });
        }
        throw error;
      }
    }
    const request = createRequest(url, { userAgent });
    logRequest(request);
    const response = await fetch(request, {
      // Since Bun has a bug that ignores the `Request.redirect` option,
      // to work around it we specify `redirect: "manual"` here too:
      // https://github.com/oven-sh/bun/issues/10754
      redirect: "manual",
      signal,
    });
    // Follow redirects manually to get the final URL:
    if (
      response.status >= 300 && response.status < 400 &&
      response.headers.has("Location")
    ) {
      return load(response.headers.get("Location")!);
    }
    return getRemoteDocument(url, response, load);
  }
  return load;
}

const _fetchDocumentLoader = getDocumentLoader();
const _fetchDocumentLoader_allowPrivateAddress = getDocumentLoader({
  allowPrivateAddress: true,
});

/**
 * A JSON-LD document loader that utilizes the browser's `fetch` API.
 *
 * This loader preloads the below frequently used contexts:
 *
 * - <https://www.w3.org/ns/activitystreams>
 * - <https://w3id.org/security/v1>
 * - <https://w3id.org/security/data-integrity/v1>
 * - <https://www.w3.org/ns/did/v1>
 * - <https://w3id.org/security/multikey/v1>
 * - <https://purl.archive.org/socialweb/webfinger>
 * - <http://schema.org/>
 * @param url The URL of the document to load.
 * @param allowPrivateAddress Whether to allow fetching private network
 *                            addresses.  Turned off by default.
 * @returns The remote document.
 * @deprecated Use {@link getDocumentLoader} instead.
 */
export function fetchDocumentLoader(
  url: string,
  allowPrivateAddress: boolean = false,
): Promise<RemoteDocument> {
  logger.warn(
    "fetchDocumentLoader() function is deprecated.  " +
      "Use getDocumentLoader() function instead.",
  );
  return (allowPrivateAddress
    ? _fetchDocumentLoader_allowPrivateAddress
    : _fetchDocumentLoader)(url);
}

/**
 * Options for {@link getAuthenticatedDocumentLoader}.
 * @since 1.3.0
 */
export interface GetAuthenticatedDocumentLoaderOptions {
  /**
   * Whether to allow fetching private network addresses.
   * Turned off by default.
   */
  allowPrivateAddress?: boolean;

  /**
   * Options for making `User-Agent` string.
   * If a string is given, it is used as the `User-Agent` header value.
   * If an object is given, it is passed to {@link getUserAgent} function.
   */
  userAgent?: GetUserAgentOptions | string;
}

/**
 * Gets an authenticated {@link DocumentLoader} for the given identity.
 * Note that an authenticated document loader intentionally does not cache
 * the fetched documents.
 * @param identity The identity to get the document loader for.
 *                 The actor's key pair.
 * @param options The options for the document loader.
 * @returns The authenticated document loader.
 * @throws {TypeError} If the key is invalid or unsupported.
 * @since 0.4.0
 */
export function getAuthenticatedDocumentLoader(
  identity: { keyId: URL; privateKey: CryptoKey },
  { allowPrivateAddress, userAgent }: GetAuthenticatedDocumentLoaderOptions =
    {},
): DocumentLoader {
  validateCryptoKey(identity.privateKey);
  async function load(url: string): Promise<RemoteDocument> {
    if (!allowPrivateAddress) {
      try {
        await validatePublicUrl(url);
      } catch (error) {
        if (error instanceof UrlError) {
          logger.error("Disallowed private URL: {url}", { url, error });
        }
        throw error;
      }
    }
    let request = createRequest(url, { userAgent });
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
    return getRemoteDocument(url, response, load);
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
   * By default, 5 minutes for all URLs.
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

/**
 * Options for making `User-Agent` string.
 * @see {@link getUserAgent}
 * @since 1.3.0
 */
export interface GetUserAgentOptions {
  /**
   * An optional software name and version, e.g., `"Hollo/1.0.0"`.
   */
  software?: string | null;
  /**
   * An optional URL to append to the user agent string.
   * Usually the URL of the ActivityPub instance.
   */
  url?: string | URL | null;
}

/**
 * Gets the user agent string for the given application and URL.
 * @param options The options for making the user agent string.
 * @returns The user agent string.
 * @since 1.3.0
 */
export function getUserAgent(
  { software, url }: GetUserAgentOptions = {},
): string {
  const fedify = `Fedify/${metadata.version}`;
  const runtime = "Deno" in globalThis
    ? `Deno/${Deno.version.deno}`
    : "Bun" in globalThis
    // @ts-ignore: `Bun` is a global variable in Bun
    ? `Bun/${Bun.version}`
    : "process" in globalThis
    ? `Node.js/${process.version}`
    : null;
  const userAgent = software == null ? [fedify] : [software, fedify];
  if (runtime != null) userAgent.push(runtime);
  if (url != null) userAgent.push(`+${url.toString()}`);
  const first = userAgent.shift();
  return `${first} (${userAgent.join("; ")})`;
}
