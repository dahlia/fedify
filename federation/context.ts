import { validateCryptoKey } from "../httpsig/key.ts";
import { Actor } from "../vocab/actor.ts";
import { Activity } from "../vocab/mod.ts";
import { OutboxMessage } from "./queue.ts";
import { Router, RouterError } from "./router.ts";
import { extractInboxes, sendActivity } from "./send.ts";

/**
 * A context for a request.
 */
export class Context<TContextData> {
  #kv: Deno.Kv;
  #router: Router;

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
   * Create a new context.
   * @param kv The Deno KV object.
   * @param router The router used for the request.
   * @param request The request object.
   * @param data The user-defined data associated with the context.
   * @param treatHttps Whether to treat the request as HTTPS even if it's not.
   */
  constructor(
    kv: Deno.Kv,
    router: Router,
    request: Request,
    data: TContextData,
    treatHttps = false,
  ) {
    this.#kv = kv;
    this.#router = router;
    this.request = request;
    this.data = data;
    this.url = new URL(request.url);
    if (treatHttps) this.url.protocol = "https:";
  }

  /**
   * Builds the URI of an actor with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's URI.
   */
  getActorUri(handle: string): URL {
    const path = this.#router.build("actor", { handle });
    if (path == null) {
      throw new RouterError("No actor dispatcher registered.");
    }
    return new URL(path, this.url);
  }

  /**
   * Builds the URI of an actor's outbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's outbox URI.
   */
  getOutboxUri(handle: string): URL {
    const path = this.#router.build("outbox", { handle });
    if (path == null) {
      throw new RouterError("No outbox dispatcher registered.");
    }
    return new URL(path, this.url);
  }

  /**
   * Builds the URI of an actor's inbox with the given handle.
   * @param handle The actor's handle.
   * @returns The actor's inbox URI.
   */
  getInboxUri(handle: string): URL {
    const path = this.#router.build("inbox", { handle });
    if (path == null) {
      throw new RouterError("No inbox path registered.");
    }
    return new URL(path, this.url);
  }

  /**
   * Sends an activity to recipients' inboxes.
   * @param sender The sender's handle or sender's key pair.
   * @param recipients The recipients of the activity.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   */
  async sendActivity(
    sender: { keyId: URL; privateKey: CryptoKey },
    recipients: Actor | Actor[],
    activity: Activity,
    { preferSharedInbox }: { preferSharedInbox?: boolean } = {},
  ): Promise<void> {
    // TODO: Give an id to the activity if it doesn't have one.
    const { keyId, privateKey } = sender;
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
