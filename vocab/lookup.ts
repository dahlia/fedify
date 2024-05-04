import {
  type DocumentLoader,
  fetchDocumentLoader,
} from "../runtime/docloader.ts";
import { lookupWebFinger } from "../webfinger/lookup.ts";
import { Object } from "./vocab.ts";

/**
 * Options for the `lookupObject` function.
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
 * await lookupObject("@hongminhee@todon.eu");
 * // returning a `Person` object.
 *
 * // A fediverse handle can omit the leading '@':
 * await lookupObject("hongminhee@todon.eu");
 * // returning a `Person` object.
 *
 * // A `acct:` URI can be used as well:
 * await lookupObject("acct:hongminhee@todon.eu");
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
  const documentLoader = options.documentLoader ?? fetchDocumentLoader;
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
    } catch (_) {
      // Silently ignore errors.
    }
  }
  if (document == null) {
    const jrd = await lookupWebFinger(identifier);
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
      } catch (_) {
        // Silently ignore errors.
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
  } catch (e) {
    if (e instanceof TypeError) return null;
    throw e;
  }
}
