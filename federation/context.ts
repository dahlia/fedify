import { validateCryptoKey } from "../httpsig/key.ts";
import { DocumentLoader } from "../runtime/docloader.ts";
import { Actor } from "../vocab/actor.ts";
import { Activity } from "../vocab/mod.ts";
import { ActorKeyPairDispatcher } from "./callback.ts";
import { OutboxMessage } from "./queue.ts";
import { Router, RouterError } from "./router.ts";
import { extractInboxes } from "./send.ts";

/**
 * A context for a request.
 */
export interface Context<TContextData> {
  /**
   * The request object.
   */
  readonly request: Request;

  /**
   * The user-defined data associated with the context.
   */
  readonly data: TContextData;

  /**
   * The URL of the request.
   */
  readonly url: URL;

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

export class ContextImpl<TContextData> implements Context<TContextData> {
  #kv: Deno.Kv;
  #router: Router;
  #actorKeyPairDispatcher?: ActorKeyPairDispatcher<TContextData>;

  readonly request: Request;
  readonly data: TContextData;
  readonly url: URL;
  readonly documentLoader: DocumentLoader;

  constructor(
    kv: Deno.Kv,
    router: Router,
    request: Request,
    data: TContextData,
    documentLoader: DocumentLoader,
    actorKeyPairDispatcher?: ActorKeyPairDispatcher<TContextData>,
    treatHttps = false,
  ) {
    this.#kv = kv;
    this.#router = router;
    this.#actorKeyPairDispatcher = actorKeyPairDispatcher;
    this.request = request;
    this.data = data;
    this.documentLoader = documentLoader;
    this.url = new URL(request.url);
    if (treatHttps) this.url.protocol = "https:";
  }

  getActorUri(handle: string): URL {
    const path = this.#router.build("actor", { handle });
    if (path == null) {
      throw new RouterError("No actor dispatcher registered.");
    }
    return new URL(path, this.url);
  }

  getOutboxUri(handle: string): URL {
    const path = this.#router.build("outbox", { handle });
    if (path == null) {
      throw new RouterError("No outbox dispatcher registered.");
    }
    return new URL(path, this.url);
  }

  getInboxUri(handle: string): URL {
    const path = this.#router.build("inbox", { handle });
    if (path == null) {
      throw new RouterError("No inbox path registered.");
    }
    return new URL(path, this.url);
  }

  async sendActivity(
    sender: { keyId: URL; privateKey: CryptoKey } | { handle: string },
    recipients: Actor | Actor[],
    activity: Activity,
    { preferSharedInbox }: { preferSharedInbox?: boolean } = {},
  ): Promise<void> {
    if (activity.id == null) {
      activity = activity.clone({
        id: new URL(`urn:uuid:${crypto.randomUUID()}`),
      });
    }
    let keyId, privateKey;
    if ("handle" in sender) {
      if (this.#actorKeyPairDispatcher == null) {
        throw new Error("No actor key pair dispatcher registered.");
      }
      let keyPair = this.#actorKeyPairDispatcher(this.data, sender.handle);
      if (keyPair instanceof Promise) keyPair = await keyPair;
      if (keyPair == null) {
        throw new Error(`No key pair found for actor ${sender.handle}`);
      }
      keyId = new URL(`${this.getActorUri(sender.handle)}#main-key`);
      privateKey = keyPair.privateKey;
    } else {
      keyId = sender.keyId;
      privateKey = sender.privateKey;
    }
    validateCryptoKey(privateKey, "private");
    const inboxes = extractInboxes({
      recipients: Array.isArray(recipients) ? recipients : [recipients],
      preferSharedInbox,
    });
    for (const inbox of inboxes) {
      const message: OutboxMessage = {
        type: "outbox",
        keyId: keyId.href,
        privateKey: await crypto.subtle.exportKey("jwk", privateKey),
        activity: await activity.toJsonLd({ expand: true }),
        inbox: inbox.href,
      };
      this.#kv.enqueue(message);
    }
  }
}
