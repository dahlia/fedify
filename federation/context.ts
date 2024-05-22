import type { DocumentLoader } from "../runtime/docloader.ts";
import type { Actor, Recipient } from "../vocab/actor.ts";
import type { Activity, CryptographicKey, Object } from "../vocab/mod.ts";

/**
 * A context.
 */
export interface Context<TContextData> {
  /**
   * The user-defined data associated with the context.
   */
  readonly data: TContextData;

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
   * Builds the URI of an actor with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's URI.
   * @throws {RouterError} If no actor dispatcher is available.
   */
  getActorUri(handle: string): URL;

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
   * Builds the URI of an actor's outbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's outbox URI.
   * @throws {RouterError} If no outbox dispatcher is available.
   */
  getOutboxUri(handle: string): URL;

  /**
   * Builds the URI of the shared inbox.
   * @returns The shared inbox URI.
   * @throws {RouterError} If no inbox listener is available.
   */
  getInboxUri(): URL;

  /**
   * Builds the URI of an actor's inbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's inbox URI.
   * @throws {RouterError} If no inbox listener is available.
   */
  getInboxUri(handle: string): URL;

  /**
   * Builds the URI of an actor's following collection with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's following collection URI.
   * @throws {RouterError} If no following collection is available.
   */
  getFollowingUri(handle: string): URL;

  /**
   * Builds the URI of an actor's followers collection with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's followers collection URI.
   * @throws {RouterError} If no followers collection is available.
   */
  getFollowersUri(handle: string): URL;

  /**
   * Determines the type of the URI and extracts the associated data.
   * @param uri The URI to parse.
   * @since 0.9.0
   */
  parseUri(uri: URL): ParseUriResult | null;

  /**
   * Extracts the actor's handle from an actor URI, if it is a valid actor URI.
   * @param actorUri The actor's URI.
   * @returns The actor's handle, or `null` if the URI is not a valid actor URI.
   * @deprecated Use {@link parseUri} instead.
   */
  getHandleFromActorUri(actorUri: URL): string | null;

  /**
   * Gets a public {@link CryptographicKey} for an actor, if any exists.
   * @param handle The actor's handle.
   * @returns The actor's public key, or `null` if the actor has no key.
   */
  getActorKey(handle: string): Promise<CryptographicKey | null>;

  /**
   * Gets an authenticated {@link DocumentLoader} for the given identity.
   * Note that an authenticated document loader intentionally does not cache
   * the fetched documents.
   * @param identity The identity to get the document loader for.
   *                 The actor's handle.
   * @returns The authenticated document loader.
   * @throws {Error} If the identity is not valid.
   * @throws {TypeError} If the key is invalid or unsupported.
   * @since 0.4.0
   */
  getDocumentLoader(identity: { handle: string }): Promise<DocumentLoader>;

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
   * Sends an activity to recipients' inboxes.
   * @param sender The sender's handle or the sender's key pair.
   * @param recipients The recipients of the activity.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   */
  sendActivity(
    sender: { keyId: URL; privateKey: CryptoKey } | { handle: string },
    recipients: Recipient | Recipient[],
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
   * Gets an {@link Actor} object for the given handle.
   * @param handle The actor's handle.
   * @returns The actor object, or `null` if the actor is not found.
   * @throws {Error} If no actor dispatcher is available.
   * @since 0.7.0
   */
  getActor(handle: string): Promise<Actor | null>;

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

  /**
   * Sends an activity to recipients' inboxes.
   * @param sender The sender's handle or the sender's key pair.
   * @param recipients The recipients of the activity.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   */
  sendActivity(
    sender: { keyId: URL; privateKey: CryptoKey } | { handle: string },
    recipients: Recipient | Recipient[],
    activity: Activity,
    options?: SendActivityOptions,
  ): Promise<void>;

  /**
   * Sends an activity to the outboxes of the sender's followers.
   * @param sender The sender's handle.
   * @param recipients In this case, it must be `"followers"`.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   * @throws {Error} If no followers collection is registered.
   * @since 0.8.0
   */
  sendActivity(
    sender: { handle: string },
    recipients: "followers",
    activity: Activity,
    options?: SendActivityOptions,
  ): Promise<void>;
}

/**
 * A result of parsing an URI.
 */
export type ParseUriResult =
  /**
   * The case of an actor URI.
   */
  | { type: "actor"; handle: string }
  /**
   * The case of an object URI.
   */
  | {
    type: "object";
    // deno-lint-ignore no-explicit-any
    class: (new (...args: any[]) => Object) & { typeId: URL };
    typeId: URL;
    values: Record<string, string>;
  }
  /**
   * The case of an inbox URI.  If `handle` is `undefined`,
   * it is a shared inbox.
   */
  | { type: "inbox"; handle?: string }
  /**
   * The case of an outbox collection URI.
   */
  | { type: "outbox"; handle: string }
  /**
   * The case of a following collection URI.
   */
  | { type: "following"; handle: string }
  /**
   * The case of a followers collection URI.
   */
  | { type: "followers"; handle: string };

/**
 * Options for {@link Context.sendActivity} method and
 * {@link Federation.sendActivity} method.
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
