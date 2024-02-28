import { DocumentLoader } from "../runtime/docloader.ts";
import { Actor } from "../vocab/actor.ts";
import { Activity } from "../vocab/mod.ts";

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
   * Builds the URI of an actor's inbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's inbox URI.
   */
  getInboxUri(handle: string): URL;

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
