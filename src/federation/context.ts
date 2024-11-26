import type { TracerProvider } from "@opentelemetry/api";
import type { DocumentLoader } from "../runtime/docloader.ts";
import type { Actor, Recipient } from "../vocab/actor.ts";
import type {
  LookupObjectOptions,
  TraverseCollectionOptions,
} from "../vocab/lookup.ts";
import type {
  Activity,
  Collection,
  CryptographicKey,
  Link,
  Multikey,
  Object,
} from "../vocab/vocab.ts";
import type { SenderKeyPair } from "./send.ts";

/**
 * A context.
 */
export interface Context<TContextData> {
  /**
   * The origin of the federated server, including the scheme (`http://` or
   * `https://`) and the host (e.g., `example.com:8080`).
   * @since 0.12.0
   */
  readonly origin: string;

  /**
   * The host of the federated server, including the hostname
   * (e.g., `example.com`) and the port following a colon (e.g., `:8080`)
   * if it is not the default port for the scheme.
   * @since 0.12.0
   */
  readonly host: string;

  /**
   * The hostname of the federated server (e.g., `example.com`).  This is
   * the same as the host without the port.
   * @since 0.12.0
   */
  readonly hostname: string;

  /**
   * The user-defined data associated with the context.
   */
  readonly data: TContextData;

  /**
   * The OpenTelemetry tracer provider.
   * @since 1.3.0
   */
  readonly tracerProvider: TracerProvider;

  /**
   * The document loader for loading remote JSON-LD documents.
   */
  readonly documentLoader: DocumentLoader;

  /**
   * The context loader for loading remote JSON-LD contexts.
   */
  readonly contextLoader: DocumentLoader;

  /**
   * Builds the URI of the NodeInfo document.
   * @returns The NodeInfo URI.
   * @throws {RouterError} If no NodeInfo dispatcher is available.
   * @since 0.2.0
   */
  getNodeInfoUri(): URL;

  /**
   * Builds the URI of an actor with the given identifier.
   * @param identifier The actor's identifier.
   * @returns The actor's URI.
   * @throws {RouterError} If no actor dispatcher is available.
   */
  getActorUri(identifier: string): URL;

  /**
   * Builds the URI of an object with the given class and values.
   * @param cls The class of the object.
   * @param values The values to pass to the object dispatcher.
   * @returns The object's URI.
   * @throws {RouteError} If no object dispatcher is available for the class.
   * @throws {TypeError} If values are invalid.
   * @since 0.7.0
   */
  getObjectUri<TObject extends Object>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    values: Record<string, string>,
  ): URL;

  /**
   * Builds the URI of an actor's outbox with the given identifier.
   * @param identifier The actor's identifier.
   * @returns The actor's outbox URI.
   * @throws {RouterError} If no outbox dispatcher is available.
   */
  getOutboxUri(identifier: string): URL;

  /**
   * Builds the URI of the shared inbox.
   * @returns The shared inbox URI.
   * @throws {RouterError} If no inbox listener is available.
   */
  getInboxUri(): URL;

  /**
   * Builds the URI of an actor's inbox with the given identifier.
   * @param identifier The actor's identifier.
   * @returns The actor's inbox URI.
   * @throws {RouterError} If no inbox listener is available.
   */
  getInboxUri(identifier: string): URL;

  /**
   * Builds the URI of an actor's following collection with the given
   * identifier.
   * @param identifier The actor's identifier.
   * @returns The actor's following collection URI.
   * @throws {RouterError} If no following collection is available.
   */
  getFollowingUri(identifier: string): URL;

  /**
   * Builds the URI of an actor's followers collection with the given
   * identifier.
   * @param identifier The actor's identifier.
   * @returns The actor's followers collection URI.
   * @throws {RouterError} If no followers collection is available.
   */
  getFollowersUri(identifier: string): URL;

  /**
   * Builds the URI of an actor's liked collection with the given identifier.
   * @param identifier The actor's identifier.
   * @returns The actor's liked collection URI.
   * @throws {RouterError} If no liked collection is available.
   * @since 0.11.0
   */
  getLikedUri(identifier: string): URL;

  /**
   * Builds the URI of an actor's featured collection with the given identifier.
   * @param identifier The actor's identifier.
   * @returns The actor's featured collection URI.
   * @throws {RouterError} If no featured collection is available.
   * @since 0.11.0
   */
  getFeaturedUri(identifier: string): URL;

  /**
   * Builds the URI of an actor's featured tags collection with the given
   * identifier.
   * @param identifier The actor's identifier.
   * @returns The actor's featured tags collection URI.
   * @throws {RouterError} If no featured tags collection is available.
   * @since 0.11.0
   */
  getFeaturedTagsUri(identifier: string): URL;

  /**
   * Determines the type of the URI and extracts the associated data.
   * @param uri The URI to parse.
   * @returns The result of parsing the URI.  If `null` is given or
   *          the URI is not recognized, `null` is returned.
   * @since 0.9.0
   */
  parseUri(uri: URL | null): ParseUriResult | null;

  /**
   * Gets the key pairs for an actor.
   * @param identifier The actor's identifier.
   * @returns An async iterable of the actor's key pairs.  It can be empty.
   * @since 0.10.0
   */
  getActorKeyPairs(identifier: string): Promise<ActorKeyPair[]>;

  /**
   * Gets an authenticated {@link DocumentLoader} for the given identity.
   * Note that an authenticated document loader intentionally does not cache
   * the fetched documents.
   * @param identity The identity to get the document loader for.
   *                 The actor's identifier or username.
   * @returns The authenticated document loader.
   * @throws {Error} If the identity is not valid.
   * @throws {TypeError} If the key is invalid or unsupported.
   * @since 0.4.0
   */
  getDocumentLoader(
    identity:
      | { identifier: string }
      | { username: string }
      | { handle: string },
  ): Promise<DocumentLoader>;

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
  getDocumentLoader(
    identity: { keyId: URL; privateKey: CryptoKey },
  ): DocumentLoader;

  /**
   * Looks up an ActivityStreams object by its URI (including `acct:` URIs)
   * or a fediverse handle (e.g., `@user@server` or `user@server`).
   *
   * @example
   * ``` typescript
   * // Look up an actor by its fediverse handle:
   * await ctx.lookupObject("@hongminhee@fosstodon.org");
   * // returning a `Person` object.
   *
   * // A fediverse handle can omit the leading '@':
   * await ctx.lookupObject("hongminhee@fosstodon.org");
   * // returning a `Person` object.
   *
   * // A `acct:` URI can be used as well:
   * await ctx.lookupObject("acct:hongminhee@fosstodon.org");
   * // returning a `Person` object.
   *
   * // Look up an object by its URI:
   * await ctx.lookupObject("https://todon.eu/@hongminhee/112060633798771581");
   * // returning a `Note` object.
   *
   * // It can be a `URL` object as well:
   * await ctx.lookupObject(
   *   new URL("https://todon.eu/@hongminhee/112060633798771581")
   * );
   * // returning a `Note` object.
   * ```
   *
   * It's almost the same as the {@link lookupObject} function, but it uses
   * the context's document loader and context loader by default.
   *
   * @param identifier The URI or fediverse handle to look up.
   * @param options Lookup options.
   * @returns The object, or `null` if not found.
   * @since 0.15.0
   */
  lookupObject(
    identifier: string | URL,
    options?: LookupObjectOptions,
  ): Promise<Object | null>;

  /**
   * Traverses a collection, yielding each item in the collection.
   * If the collection is paginated, it will fetch the next page
   * automatically.
   *
   * @example
   * ``` typescript
   * const collection = await ctx.lookupObject(collectionUrl);
   * if (collection instanceof Collection) {
   *   for await (const item of ctx.traverseCollection(collection)) {
   *     console.log(item.id?.href);
   *   }
   * }
   * ```
   *
   * It's almost the same as the {@link traverseCollection} function, but it
   * uses the context's document loader and context loader by default.
   * @param collection The collection to traverse.
   * @param options Options for traversing the collection.
   * @returns An async iterable of each item in the collection.
   * @since 1.1.0
   */
  traverseCollection(
    collection: Collection,
    options?: TraverseCollectionOptions,
  ): AsyncIterable<Object | Link>;

  /**
   * Sends an activity to recipients' inboxes.
   * @param sender The sender's identifier or the sender's username or
   *               the sender's key pair(s).
   * @param recipients The recipients of the activity.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   */
  sendActivity(
    sender:
      | SenderKeyPair
      | SenderKeyPair[]
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: Recipient | Recipient[],
    activity: Activity,
    options?: SendActivityOptions,
  ): Promise<void>;

  /**
   * Sends an activity to the outboxes of the sender's followers.
   * @param sender The sender's identifier or the sender's username.
   * @param recipients In this case, it must be `"followers"`.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   * @throws {Error} If no followers collection is registered.
   * @since 0.14.0
   */
  sendActivity(
    sender: { identifier: string } | { username: string } | { handle: string },
    recipients: "followers",
    activity: Activity,
    options?: SendActivityOptions,
  ): Promise<void>;
}

/**
 * A context for a request.
 */
export interface RequestContext<TContextData> extends Context<TContextData> {
  /**
   * The request object.
   */
  readonly request: Request;

  /**
   * The URL of the request.
   */
  readonly url: URL;

  /**
   * Gets an {@link Actor} object for the given identifier.
   * @param identifier The actor's identifier.
   * @returns The actor object, or `null` if the actor is not found.
   * @throws {Error} If no actor dispatcher is available.
   * @since 0.7.0
   */
  getActor(identifier: string): Promise<Actor | null>;

  /**
   * Gets an object of the given class with the given values.
   * @param cls The class to instantiate.
   * @param values The values to pass to the object dispatcher.
   * @returns The object of the given class with the given values, or `null`
   *          if the object is not found.
   * @throws {Error} If no object dispatcher is available for the class.
   * @throws {TypeError} If values are invalid.
   * @since 0.7.0
   */
  getObject<TObject extends Object>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    values: Record<string, string>,
  ): Promise<TObject | null>;

  /**
   * Gets the public key of the sender, if any exists and it is verified.
   * Otherwise, `null` is returned.
   *
   * This can be used for implementing [authorized fetch] (also known as
   * secure mode) in ActivityPub.
   *
   * [authorized fetch]: https://swicg.github.io/activitypub-http-signature/#authorized-fetch
   *
   * @returns The public key of the sender, or `null` if the sender is not verified.
   * @since 0.7.0
   */
  getSignedKey(): Promise<CryptographicKey | null>;

  /**
   * Gets the owner of the signed key, if any exists and it is verified.
   * Otherwise, `null` is returned.
   *
   * This can be used for implementing [authorized fetch] (also known as
   * secure mode) in ActivityPub.
   *
   * [authorized fetch]: https://swicg.github.io/activitypub-http-signature/#authorized-fetch
   *
   * @returns The owner of the signed key, or `null` if the key is not verified
   *          or the owner is not found.
   * @since 0.7.0
   */
  getSignedKeyOwner(): Promise<Actor | null>;
}

/**
 * A context for inbox listeners.
 * @since 1.0.0
 */
export interface InboxContext<TContextData> extends Context<TContextData> {
  /**
   * The identifier of the recipient of the inbox.  If the inbox is a shared
   * inbox, it is `null`.
   * @since 1.2.0
   */
  recipient: string | null;

  /**
   * Forwards a received activity to the recipients' inboxes.  The forwarded
   * activity will be signed in HTTP Signatures by the forwarder, but its
   * payload will not be modified, i.e., Linked Data Signatures and Object
   * Integrity Proofs will not be added.  Therefore, if the activity is not
   * signed (i.e., it has neither Linked Data Signatures nor Object Integrity
   * Proofs), the recipient probably will not trust the activity.
   * @param forwarder The forwarder's identifier or the forwarder's username
   *                  or the forwarder's key pair(s).
   * @param recipients The recipients of the activity.
   * @param options Options for forwarding the activity.
   * @since 1.0.0
   */
  forwardActivity(
    forwarder:
      | SenderKeyPair
      | SenderKeyPair[]
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: Recipient | Recipient[],
    options?: ForwardActivityOptions,
  ): Promise<void>;

  /**
   * Forwards a received activity to the recipients' inboxes.  The forwarded
   * activity will be signed in HTTP Signatures by the forwarder, but its
   * payload will not be modified, i.e., Linked Data Signatures and Object
   * Integrity Proofs will not be added.  Therefore, if the activity is not
   * signed (i.e., it has neither Linked Data Signatures nor Object Integrity
   * Proofs), the recipient probably will not trust the activity.
   * @param forwarder The forwarder's identifier or the forwarder's username.
   * @param recipients In this case, it must be `"followers"`.
   * @param options Options for forwarding the activity.
   * @since 1.0.0
   */
  forwardActivity(
    forwarder:
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: "followers",
    options?: ForwardActivityOptions,
  ): Promise<void>;
}

/**
 * A result of parsing an URI.
 */
export type ParseUriResult =
  /**
   * The case of an actor URI.
   */
  | {
    readonly type: "actor";
    readonly identifier: string;
    readonly handle: string;
  }
  /**
   * The case of an object URI.
   */
  | {
    readonly type: "object";
    // deno-lint-ignore no-explicit-any
    readonly class: (new (...args: any[]) => Object) & { typeId: URL };
    readonly typeId: URL;
    readonly values: Record<string, string>;
  }
  /**
   * The case of an shared inbox URI.
   */
  | {
    readonly type: "inbox";
    readonly identifier: undefined;
    readonly handle: undefined;
  }
  /**
   * The case of an personal inbox URI.
   */
  | {
    readonly type: "inbox";
    readonly identifier: string;
    readonly handle: string;
  }
  /**
   * The case of an outbox collection URI.
   */
  | {
    readonly type: "outbox";
    readonly identifier: string;
    readonly handle: string;
  }
  /**
   * The case of a following collection URI.
   */
  | {
    readonly type: "following";
    readonly identifier: string;
    readonly handle: string;
  }
  /**
   * The case of a followers collection URI.
   */
  | {
    readonly type: "followers";
    readonly identifier: string;
    readonly handle: string;
  }
  /**
   * The case of a liked collection URI.
   * @since 0.11.0
   */
  | {
    readonly type: "liked";
    readonly identifier: string;
    readonly handle: string;
  }
  /**
   * The case of a featured collection URI.
   * @since 0.11.0
   */
  | {
    readonly type: "featured";
    readonly identifier: string;
    readonly handle: string;
  }
  /**
   * The case of a featured tags collection URI.
   * @since 0.11.0
   */
  | {
    readonly type: "featuredTags";
    readonly identifier: string;
    readonly handle: string;
  };

/**
 * Options for {@link Context.sendActivity} method.
 */
export interface SendActivityOptions {
  /**
   * Whether to prefer the shared inbox for the recipients.
   */
  preferSharedInbox?: boolean;

  /**
   * Whether to send the activity immediately, without enqueuing it.
   * If `true`, the activity will be sent immediately and the retrial
   * policy will not be applied.
   *
   * @since 0.3.0
   */
  immediate?: boolean;

  /**
   * The base URIs to exclude from the recipients' inboxes.  It is useful
   * for excluding the recipients having the same shared inbox with the sender.
   *
   * Note that the only `origin` parts of the `URL`s are compared.
   *
   * @since 0.9.0
   */
  excludeBaseUris?: URL[];
}

/**
 * Options for {@link InboxContext.forwardActivity} method.
 * @since 1.0.0
 */
export interface ForwardActivityOptions extends SendActivityOptions {
  /**
   * Whether to skip forwarding the activity if it is not signed, i.e., it has
   * neither Linked Data Signatures nor Object Integrity Proofs.
   *
   * If the activity is not signed, the recipient probably will not trust the
   * activity.  Therefore, it is recommended to skip forwarding the activity
   * if it is not signed.
   */
  skipIfUnsigned: boolean;
}

/**
 * A pair of a public key and a private key in various formats.
 * @since 0.10.0
 */
export interface ActorKeyPair extends CryptoKeyPair {
  /**
   * The URI of the public key, which is used for verifying HTTP Signatures.
   */
  keyId: URL;

  /**
   * A {@link CryptographicKey} instance of the public key.
   */
  cryptographicKey: CryptographicKey;

  /**
   * A {@link Multikey} instance of the public key.
   */
  multikey: Multikey;
}
