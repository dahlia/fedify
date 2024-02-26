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
    super(`${url}: ${message}`);
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

export interface KvCacheParameters {
  loader: DocumentLoader;
  kv: Deno.Kv;
  prefix?: Deno.KvKey;
  cacheUrls?: string[];
  expireIn?: number;
}

export function kvCache(
  { loader, kv, prefix, cacheUrls, expireIn }: KvCacheParameters,
): DocumentLoader {
  const keyPrefix = prefix ?? ["_fedify", "remoteDocument"];
  cacheUrls ??= [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1",
  ];
  return async (url: string): Promise<RemoteDocument> => {
    const key: Deno.KvKey = [...keyPrefix, url];
    const cache = await kv.get<RemoteDocument>(key);
    if (cache == null || cache.value == null) {
      const remoteDoc = await loader(url);
      if (cacheUrls?.includes(url)) {
        await kv.set(key, remoteDoc, {
          expireIn: expireIn ?? 60 * 60 * 24 * 1000,
        });
      }
      return remoteDoc;
    }
    return cache.value;
  };
}
