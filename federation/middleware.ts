import { validateCryptoKey } from "../httpsig/key.ts";
import {
  DocumentLoader,
  fetchDocumentLoader,
  kvCache,
} from "../runtime/docloader.ts";
import { Actor } from "../vocab/actor.ts";
import { Activity, CryptographicKey } from "../vocab/mod.ts";
import { handleWebFinger } from "../webfinger/handler.ts";
import {
  ActorDispatcher,
  ActorKeyPairDispatcher,
  InboxListener,
  OutboxCounter,
  OutboxCursor,
  OutboxDispatcher,
} from "./callback.ts";
import { Context, RequestContext } from "./context.ts";
import { handleActor, handleInbox, handleOutbox } from "./handler.ts";
import { OutboxMessage } from "./queue.ts";
import { Router, RouterError } from "./router.ts";
import { extractInboxes, sendActivity } from "./send.ts";

/**
 * Parameters for initializing a {@link Federation} instance.
 */
export interface FederationParameters {
  kv: Deno.Kv;
  documentLoader?: DocumentLoader;
  treatHttps?: boolean;
}

/**
 * An object that registers federation-related business logic and dispatches
 * requests to the appropriate handlers.
 *
 * It also provides a middleware interface for handling requests before your
 * web framework's router; see {@link Federation.handle}.
 */
export class Federation<TContextData> {
  #kv: Deno.Kv;
  #router: Router;
  #actorCallbacks?: ActorCallbacks<TContextData>;
  #outboxCallbacks?: OutboxCallbacks<TContextData>;
  #inboxListeners: Map<
    new (...args: unknown[]) => Activity,
    InboxListener<TContextData, Activity>
  >;
  #inboxErrorHandler?: (error: Error) => void | Promise<void>;
  #documentLoader: DocumentLoader;
  #treatHttps: boolean;

  /**
   * Create a new {@link Federation} instance.
   * @param parameters Parameters for initializing the instance.
   */
  constructor({ kv, documentLoader, treatHttps }: FederationParameters) {
    this.#kv = kv;
    this.#router = new Router();
    this.#router.add("/.well-known/webfinger", "webfinger");
    this.#inboxListeners = new Map();
    this.#documentLoader = documentLoader ?? kvCache({
      loader: fetchDocumentLoader,
      kv: kv,
    });
    this.#treatHttps = treatHttps ?? false;

    kv.listenQueue(this.#listenQueue.bind(this));
  }

  async #listenQueue(message: OutboxMessage): Promise<void> {
    const successful = await sendActivity({
      keyId: new URL(message.keyId),
      privateKey: await crypto.subtle.importKey(
        "jwk",
        message.privateKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        true,
        ["sign"],
      ),
      activity: await Activity.fromJsonLd(message.activity, {
        documentLoader: this.#documentLoader,
      }),
      inbox: new URL(message.inbox),
      documentLoader: this.#documentLoader,
    });
    if (!successful) {
      throw new Error("Failed to send activity");
    }
  }

  /**
   * Create a new context.
   * @param baseUrl The base URL of the server.  The `pathname` remains root,
   *                and the `search` and `hash` are stripped.
   * @param contextData The context data to pass to the context.
   * @returns The new context.
   */
  createContext(baseUrl: URL, contextData: TContextData): Context<TContextData>;

  /**
   * Create a new context for a request.
   * @param request The request object.
   * @param contextData The context data to pass to the context.
   * @returns The new request context.
   */
  createContext(
    request: Request,
    contextData: TContextData,
  ): RequestContext<TContextData>;

  createContext(
    urlOrRequest: Request | URL,
    contextData: TContextData,
  ): Context<TContextData> {
    const request = urlOrRequest instanceof Request ? urlOrRequest : null;
    const url = urlOrRequest instanceof URL
      ? new URL(urlOrRequest)
      : new URL(urlOrRequest.url);
    if (request == null) {
      url.pathname = "/";
      url.hash = "";
      url.search = "";
    }
    if (this.#treatHttps) url.protocol = "https:";
    const context = {
      data: contextData,
      documentLoader: this.#documentLoader,
      getActorUri: (handle: string): URL => {
        const path = this.#router.build("actor", { handle });
        if (path == null) {
          throw new RouterError("No actor dispatcher registered.");
        }
        return new URL(path, url);
      },
      getOutboxUri: (handle: string): URL => {
        const path = this.#router.build("outbox", { handle });
        if (path == null) {
          throw new RouterError("No outbox dispatcher registered.");
        }
        return new URL(path, url);
      },
      getInboxUri: (handle: string): URL => {
        const path = this.#router.build("inbox", { handle });
        if (path == null) {
          throw new RouterError("No inbox path registered.");
        }
        return new URL(path, url);
      },
      getActorKey: async (handle: string): Promise<CryptographicKey | null> => {
        let keyPair = this.#actorCallbacks?.keyPairDispatcher?.(
          contextData,
          handle,
        );
        if (keyPair instanceof Promise) keyPair = await keyPair;
        if (keyPair == null) return null;
        return new CryptographicKey({
          id: new URL(`${context.getActorUri(handle)}#main-key`),
          owner: context.getActorUri(handle),
          publicKey: keyPair.publicKey,
        });
      },
      sendActivity: async (
        sender: { keyId: URL; privateKey: CryptoKey } | { handle: string },
        recipients: Actor | Actor[],
        activity: Activity,
        options: { preferSharedInbox?: boolean } = {},
      ): Promise<void> => {
        let senderPair: { keyId: URL; privateKey: CryptoKey };
        if ("handle" in sender) {
          if (this.#actorCallbacks?.keyPairDispatcher == null) {
            throw new Error("No actor key pair dispatcher registered.");
          }
          let keyPair = this.#actorCallbacks?.keyPairDispatcher(
            contextData,
            sender.handle,
          );
          if (keyPair instanceof Promise) keyPair = await keyPair;
          if (keyPair == null) {
            throw new Error(`No key pair found for actor ${sender.handle}`);
          }
          senderPair = {
            keyId: new URL(`${context.getActorUri(sender.handle)}#main-key`),
            privateKey: keyPair.privateKey,
          };
        } else {
          senderPair = sender;
        }
        return await this.sendActivity(
          senderPair,
          recipients,
          activity,
          options,
        );
      },
    };
    if (request == null) return context;
    const reqCtx: RequestContext<TContextData> = {
      ...context,
      request,
      url,
    };
    return reqCtx;
  }

  /**
   * Registers an actor dispatcher.
   * @param path The URI path pattern for the actor dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`.
   * @param dispatcher An actor dispatcher callback to register.
   * @throws {@link RouterError} Thrown if the path pattern is invalid.
   */
  setActorDispatcher(
    path: string,
    dispatcher: ActorDispatcher<TContextData>,
  ): ActorCallbackSetters<TContextData> {
    if (this.#router.has("actor")) {
      throw new RouterError("Actor dispatcher already set.");
    }
    const variables = this.#router.add(path, "actor");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for actor dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: ActorCallbacks<TContextData> = { dispatcher };
    this.#actorCallbacks = callbacks;
    const setters: ActorCallbackSetters<TContextData> = {
      setKeyPairDispatcher: (
        dispatcher: ActorKeyPairDispatcher<TContextData>,
      ) => {
        callbacks.keyPairDispatcher = dispatcher;
        return setters;
      },
    };
    return setters;
  }

  /**
   * Registers an outbox dispatcher.
   * @param path The URI path pattern for the outbox dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`.
   * @param dispatcher An outbox dispatcher callback to register.
   * @throws {@link RouterError} Thrown if the path pattern is invalid.
   */
  setOutboxDispatcher(
    path: string,
    dispatcher: OutboxDispatcher<TContextData>,
  ): OutboxCallbackSetters<TContextData> {
    if (this.#router.has("outbox")) {
      throw new RouterError("Outbox dispatcher already set.");
    }
    const variables = this.#router.add(path, "outbox");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for outbox dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: OutboxCallbacks<TContextData> = { dispatcher };
    this.#outboxCallbacks = callbacks;
    const setters: OutboxCallbackSetters<TContextData> = {
      setCounter(counter: OutboxCounter<TContextData>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: OutboxCursor<TContextData>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: OutboxCursor<TContextData>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
    };
    return setters;
  }

  setInboxListeners(path: string): InboxListenerSetter<TContextData> {
    if (this.#router.has("inbox")) {
      throw new RouterError("Inbox already set.");
    }
    const variables = this.#router.add(path, "inbox");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for inbox must have one variable: {handle}",
      );
    }
    const listeners = this.#inboxListeners;
    const setter: InboxListenerSetter<TContextData> = {
      on<TActivity extends Activity>(
        // deno-lint-ignore no-explicit-any
        type: new (...args: any[]) => TActivity,
        listener: InboxListener<TContextData, TActivity>,
      ): InboxListenerSetter<TContextData> {
        if (listeners.has(type)) {
          throw new TypeError("Listener already set for this type.");
        }
        listeners.set(type, listener as InboxListener<TContextData, Activity>);
        return setter;
      },
      onError: (
        handler: (error: Error) => void | Promise<void>,
      ): InboxListenerSetter<TContextData> => {
        this.#inboxErrorHandler = handler;
        return setter;
      },
    };
    return setter;
  }

  /**
   * Sends an activity to recipients' inboxes.
   * @param sender The sender's key pair.
   * @param recipients The recipients of the activity.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   */
  async sendActivity(
    { keyId, privateKey }: { keyId: URL; privateKey: CryptoKey },
    recipients: Actor | Actor[],
    activity: Activity,
    { preferSharedInbox }: { preferSharedInbox?: boolean } = {},
  ): Promise<void> {
    if (activity.id == null) {
      activity = activity.clone({
        id: new URL(`urn:uuid:${crypto.randomUUID()}`),
      });
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

  /**
   * Handles a request related to federation.
   * @param request The request object.
   * @param parameters The parameters for handling the request.
   * @returns The response to the request.
   */
  async handle(
    request: Request,
    {
      onNotFound,
      onNotAcceptable,
      contextData,
    }: FederationHandlerParameters<TContextData>,
  ): Promise<Response> {
    const url = new URL(request.url);
    const route = this.#router.route(url.pathname);
    if (route == null) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
    const context = this.createContext(request, contextData);
    switch (route.name) {
      case "webfinger":
        return await handleWebFinger(request, {
          context,
          actorDispatcher: this.#actorCallbacks?.dispatcher,
          onNotFound,
        });
      case "actor":
        return await handleActor(request, {
          handle: route.values.handle,
          context,
          documentLoader: this.#documentLoader,
          actorDispatcher: this.#actorCallbacks?.dispatcher,
          onNotFound,
          onNotAcceptable,
        });
      case "outbox":
        return await handleOutbox(request, {
          handle: route.values.handle,
          context,
          documentLoader: this.#documentLoader,
          outboxDispatcher: this.#outboxCallbacks?.dispatcher,
          outboxCounter: this.#outboxCallbacks?.counter,
          outboxFirstCursor: this.#outboxCallbacks?.firstCursor,
          outboxLastCursor: this.#outboxCallbacks?.lastCursor,
          onNotFound,
          onNotAcceptable,
        });
      case "inbox":
        return await handleInbox(request, {
          handle: route.values.handle,
          context,
          documentLoader: this.#documentLoader,
          actorDispatcher: this.#actorCallbacks?.dispatcher,
          inboxListeners: this.#inboxListeners,
          inboxErrorHandler: this.#inboxErrorHandler,
          onNotFound,
        });
      default: {
        const response = onNotFound(request);
        return response instanceof Promise ? await response : response;
      }
    }
  }
}

export interface FederationHandlerParameters<TContextData> {
  contextData: TContextData;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

interface ActorCallbacks<TContextData> {
  dispatcher?: ActorDispatcher<TContextData>;
  keyPairDispatcher?: ActorKeyPairDispatcher<TContextData>;
}

/**
 * Additional settings for the actor dispatcher.
 *
 * ``` typescript
 * const federation = new Federation<void>({ ... });
 * federation.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
 *   ...
 * })
 *   .setKeyPairDispatcher(async (ctxData, handle) => {
 *     ...
 *   });
 * ```
 */
export interface ActorCallbackSetters<TContextData> {
  /**
   * Sets the key pair dispatcher for actors.
   * @param dispatcher A callback that returns the key pair for an actor.
   * @returns The setters object so that settings can be chained.
   */
  setKeyPairDispatcher(
    dispatcher: ActorKeyPairDispatcher<TContextData>,
  ): ActorCallbackSetters<TContextData>;
}

interface OutboxCallbacks<TContextData> {
  dispatcher: OutboxDispatcher<TContextData>;
  counter?: OutboxCounter<TContextData>;
  firstCursor?: OutboxCursor<TContextData>;
  lastCursor?: OutboxCursor<TContextData>;
}

/**
 * Additional settings for the outbox dispatcher.
 */
export interface OutboxCallbackSetters<TContextData> {
  setCounter(
    counter: OutboxCounter<TContextData>,
  ): OutboxCallbackSetters<TContextData>;

  setFirstCursor(
    cursor: OutboxCursor<TContextData>,
  ): OutboxCallbackSetters<TContextData>;

  setLastCursor(
    cursor: OutboxCursor<TContextData>,
  ): OutboxCallbackSetters<TContextData>;
}

/**
 * Registry for inbox listeners for different activity types.
 */
export interface InboxListenerSetter<TContextData> {
  on<TActivity extends Activity>(
    // deno-lint-ignore no-explicit-any
    type: new (...args: any[]) => TActivity,
    listener: InboxListener<TContextData, TActivity>,
  ): InboxListenerSetter<TContextData>;
  onError(
    handler: (error: Error) => void | Promise<void>,
  ): InboxListenerSetter<TContextData>;
}
