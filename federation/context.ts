import { DocumentLoader } from "../runtime/docloader.ts";
import { Actor } from "../vocab/actor.ts";
import { Activity, CryptographicKey } from "../vocab/mod.ts";

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
   * Builds the URI of an actor with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's URI.
   */
  getActorUri(handle: string): URL;

  /**
   * Builds the URI of an actor's outbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's outbox URI.
   */
  getOutboxUri(handle: string): URL;

  /**
   * Builds the URI of the shared inbox.
   * @returns The shared inbox URI.
   */
  getInboxUri(): URL;

  /**
   * Builds the URI of an actor's inbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's inbox URI.
   */
  getInboxUri(handle: string): URL;

  /**
   * Builds the URI of an actor's following collection with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's following collection URI.
   */
  getFollowingUri(handle: string): URL;

  /**
   * Builds the URI of an actor's followers collection with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's followers collection URI.
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
   * Sends an activity to recipients' inboxes.
   * @param sender The sender's handle or sender's key pair.
   * @param recipients The recipients of the activity.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   */
  sendActivity(
    sender: { keyId: URL; privateKey: CryptoKey } | { handle: string },
    recipients: Actor | Actor[],
    activity: Activity,
    options?: { preferSharedInbox?: boolean },
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
