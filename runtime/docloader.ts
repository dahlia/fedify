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
 */
export type DocumentLoader = (url: string) => Promise<RemoteDocument>;

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

/**
 * A JSON-LD document loader that utilizes the browser's `fetch` API.
 * @param url The URL of the document to load.
 * @returns The remote document.
 */
export async function fetchDocumentLoader(
  url: string,
): Promise<RemoteDocument> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/ld+json",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new FetchError(
      response.url,
      `HTTP ${response.status}: ${response.url}`,
    );
  }
  return {
    contextUrl: null,
    document: await response.json(),
    documentUrl: response.url,
  };
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
   * The Deno KV store to use for backing the cache.
   */
  kv: Deno.Kv;

  /**
   * The key prefix to use for namespacing the cache.
   * `["_fedify", "remoteDocument"]` by default.
   */
  prefix?: Deno.KvKey;

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
    const key: Deno.KvKey = [...keyPrefix, url];
    const cache = await kv.get<RemoteDocument>(key);
    if (cache == null || cache.value == null) {
      const remoteDoc = await loader(url);
      await kv.set(key, remoteDoc, {
        expireIn: match.total("milliseconds"),
      });
      return remoteDoc;
    }
    return cache.value;
  };
}
