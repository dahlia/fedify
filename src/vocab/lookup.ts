import { getLogger } from "@logtape/logtape";
import { SpanStatusCode, trace, type TracerProvider } from "@opentelemetry/api";
import { delay } from "@std/async/delay";
import metadata from "../deno.json" with { type: "json" };
import {
  type DocumentLoader,
  getDocumentLoader,
  type GetUserAgentOptions,
} from "../runtime/docloader.ts";
import { lookupWebFinger } from "../webfinger/lookup.ts";
import { getTypeId } from "./type.ts";
import { type Collection, type Link, Object } from "./vocab.ts";

const logger = getLogger(["fedify", "vocab", "lookup"]);

/**
 * Options for the {@link lookupObject} function.
 *
 * @since 0.2.0
 */
export interface LookupObjectOptions {
  /**
   * The document loader for loading remote JSON-LD documents.
   */
  documentLoader?: DocumentLoader;

  /**
   * The context loader for loading remote JSON-LD contexts.
   * @since 0.8.0
   */
  contextLoader?: DocumentLoader;

  /**
   * The options for making `User-Agent` header.
   * If a string is given, it is used as the `User-Agent` header value.
   * If an object is given, it is passed to {@link getUserAgent} to generate
   * the `User-Agent` header value.
   * @since 1.3.0
   */
  userAgent?: GetUserAgentOptions | string;

  /**
   * The OpenTelemetry tracer provider.  If omitted, the global tracer provider
   * is used.
   * @since 1.3.0
   */
  tracerProvider?: TracerProvider;

  /**
   * An optional abort signal to cancel the request.
   * @since 1.3.0
   */
  signal?: AbortSignal | null;
}

const handleRegexp =
  /^@?((?:[-A-Za-z0-9._~!$&'()*+,;=]|%[A-Fa-f0-9]{2})+)@([^@]+)$/;

/**
 * Looks up an ActivityStreams object by its URI (including `acct:` URIs)
 * or a fediverse handle (e.g., `@user@server` or `user@server`).
 *
 * @example
 * ``` typescript
 * // Look up an actor by its fediverse handle:
 * await lookupObject("@hongminhee@fosstodon.org");
 * // returning a `Person` object.
 *
 * // A fediverse handle can omit the leading '@':
 * await lookupObject("hongminhee@fosstodon.org");
 * // returning a `Person` object.
 *
 * // A `acct:` URI can be used as well:
 * await lookupObject("acct:hongminhee@fosstodon.org");
 * // returning a `Person` object.
 *
 * // Look up an object by its URI:
 * await lookupObject("https://todon.eu/@hongminhee/112060633798771581");
 * // returning a `Note` object.
 *
 * // It can be a `URL` object as well:
 * await lookupObject(new URL("https://todon.eu/@hongminhee/112060633798771581"));
 * // returning a `Note` object.
 * ```
 *
 * @param identifier The URI or fediverse handle to look up.
 * @param options Lookup options.
 * @returns The object, or `null` if not found.
 * @since 0.2.0
 */
export async function lookupObject(
  identifier: string | URL,
  options: LookupObjectOptions = {},
): Promise<Object | null> {
  const tracerProvider = options.tracerProvider ?? trace.getTracerProvider();
  const tracer = tracerProvider.getTracer(
    metadata.name,
    metadata.version,
  );
  return await tracer.startActiveSpan(
    "activitypub.lookup_object",
    async (span) => {
      try {
        const result = await lookupObjectInternal(identifier, options);
        if (result == null) span.setStatus({ code: SpanStatusCode.ERROR });
        else {
          if (result.id != null) {
            span.setAttribute("activitypub.object.id", result.id.href);
          }
          span.setAttribute("activitypub.object.type", getTypeId(result).href);
          if (result.replyTargetIds.length > 0) {
            span.setAttribute(
              "activitypub.object.in_reply_to",
              result.replyTargetIds.map((id) => id.href),
            );
          }
        }
        return result;
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

async function lookupObjectInternal(
  identifier: string | URL,
  options: LookupObjectOptions = {},
): Promise<Object | null> {
  const documentLoader = options.documentLoader ??
    getDocumentLoader({ userAgent: options.userAgent });
  if (typeof identifier === "string") {
    const match = handleRegexp.exec(identifier);
    if (match) identifier = `acct:${match[1]}@${match[2]}`;
    identifier = new URL(identifier);
  }
  let document: unknown | null = null;
  if (identifier.protocol === "http:" || identifier.protocol === "https:") {
    try {
      const remoteDoc = await documentLoader(identifier.href);
      document = remoteDoc.document;
    } catch (error) {
      logger.debug("Failed to fetch remote document:\n{error}", { error });
    }
  }
  if (document == null) {
    const jrd = await lookupWebFinger(identifier, {
      userAgent: options.userAgent,
      tracerProvider: options.tracerProvider,
      signal: options.signal,
    });
    if (jrd?.links == null) return null;
    for (const l of jrd.links) {
      if (
        l.type !== "application/activity+json" &&
          !l.type?.match(
            /application\/ld\+json;\s*profile="https:\/\/www.w3.org\/ns\/activitystreams"/,
          ) || l.rel !== "self"
      ) continue;
      try {
        const remoteDoc = await documentLoader(l.href);
        document = remoteDoc.document;
        break;
      } catch (error) {
        logger.debug("Failed to fetch remote document:\n{error}", { error });
        continue;
      }
    }
  }
  if (document == null) return null;
  try {
    return await Object.fromJsonLd(document, {
      documentLoader,
      contextLoader: options.contextLoader,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      logger.debug(
        "Failed to parse JSON-LD document: {error}\n{document}",
        { error, document },
      );
      return null;
    }
    throw error;
  }
}

/**
 * Options for the {@link traverseCollection} function.
 * @since 1.1.0
 */
export interface TraverseCollectionOptions {
  /**
   * The document loader for loading remote JSON-LD documents.
   */
  documentLoader?: DocumentLoader;

  /**
   * The context loader for loading remote JSON-LD contexts.
   */
  contextLoader?: DocumentLoader;

  /**
   * Whether to suppress errors when fetching pages.  If `true`,
   * errors will be logged but not thrown.  Defaults to `false`.
   */
  suppressError?: boolean;

  /**
   * The interval to wait between fetching pages.  Zero or negative
   * values will disable the interval.  Disabled by default.
   *
   * @default `{ seconds: 0 }`
   */
  interval?: Temporal.Duration | Temporal.DurationLike;
}

/**
 * Traverses a collection, yielding each item in the collection.
 * If the collection is paginated, it will fetch the next page
 * automatically.
 *
 * @example
 * ``` typescript
 * const collection = await lookupObject(collectionUrl);
 * if (collection instanceof Collection) {
 *   for await (const item of traverseCollection(collection)) {
 *     console.log(item.id?.href);
 *   }
 * }
 * ```
 *
 * @param collection The collection to traverse.
 * @param options Options for traversing the collection.
 * @returns An async iterable of each item in the collection.
 * @since 1.1.0
 */
export async function* traverseCollection(
  collection: Collection,
  options: TraverseCollectionOptions = {},
): AsyncIterable<Object | Link> {
  if (collection.firstId == null) {
    for await (const item of collection.getItems(options)) {
      yield item;
    }
  } else {
    const interval = Temporal.Duration.from(options.interval ?? { seconds: 0 })
      .total("millisecond");
    let page = await collection.getFirst(options);
    while (page != null) {
      for await (const item of page.getItems(options)) {
        yield item;
      }
      if (interval > 0) await delay(interval);
      page = await page.getNext(options);
    }
  }
}
