import type { DocumentLoader } from "../runtime/docloader.ts";
import type { Actor } from "../vocab/actor.ts";
import type { Activity, CryptographicKey } from "../vocab/mod.ts";

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
   * Extracts the actor's handle from an actor URI, if it is a valid actor URI.
   * @param actorUri The actor's URI.
   * @returns The actor's handle, or `null` if the URI is not a valid actor URI.
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
   * @throws {Error} If the sender is not valid.
   */
  sendActivity(
    sender: { keyId: URL; privateKey: CryptoKey } | { handle: string },
    recipients: Actor | Actor[],
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
}

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
   */
  immediate?: boolean;
}
