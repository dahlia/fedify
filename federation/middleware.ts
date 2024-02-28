import {
  DocumentLoader,
  fetchDocumentLoader,
  kvCache,
} from "../runtime/docloader.ts";
import { Activity } from "../vocab/mod.ts";
import { handleWebFinger } from "../webfinger/handler.ts";
import {
  ActorDispatcher,
  ActorKeyPairDispatcher,
  InboxListener,
  OutboxCounter,
  OutboxCursor,
  OutboxDispatcher,
} from "./callback.ts";
import { ContextImpl } from "./context.ts";
import { handleActor, handleInbox, handleOutbox } from "./handler.ts";
import { OutboxMessage } from "./queue.ts";
import { Router, RouterError } from "./router.ts";
import { sendActivity } from "./send.ts";

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
    const context = new ContextImpl(
      this.#kv,
      this.#router,
      request,
      contextData,
      this.#documentLoader,
      this.#actorCallbacks?.keyPairDispatcher,
      this.#treatHttps,
    );
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
          actorKeyPairDispatcher: this.#actorCallbacks?.keyPairDispatcher,
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
          actorKeyPairDispatcher: this.#actorCallbacks?.keyPairDispatcher,
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
