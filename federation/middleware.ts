import { Temporal } from "@js-temporal/polyfill";
import { exportJwk, importJwk, validateCryptoKey } from "../httpsig/key.ts";
import { verify } from "../httpsig/mod.ts";
import { handleNodeInfo, handleNodeInfoJrd } from "../nodeinfo/handler.ts";
import {
  type AuthenticatedDocumentLoaderFactory,
  type DocumentLoader,
  fetchDocumentLoader,
  getAuthenticatedDocumentLoader,
  kvCache,
} from "../runtime/docloader.ts";
import type { Actor } from "../vocab/actor.ts";
import { Activity, CryptographicKey } from "../vocab/mod.ts";
import { handleWebFinger } from "../webfinger/handler.ts";
import type {
  ActorDispatcher,
  ActorKeyPairDispatcher,
  CollectionCounter,
  CollectionCursor,
  CollectionDispatcher,
  InboxErrorHandler,
  InboxListener,
  NodeInfoDispatcher,
  OutboxErrorHandler,
} from "./callback.ts";
import type {
  Context,
  RequestContext,
  SendActivityOptions,
} from "./context.ts";
import {
  type CollectionCallbacks,
  handleActor,
  handleCollection,
  handleInbox,
} from "./handler.ts";
import type { KvKey, KvStore } from "./kv.ts";
import type { MessageQueue } from "./mq.ts";
import type { OutboxMessage } from "./queue.ts";
import { Router, RouterError } from "./router.ts";
import { extractInboxes, sendActivity } from "./send.ts";

/**
 * Parameters for initializing a {@link Federation} instance.
 */
export interface FederationParameters {
  /**
   * The key-value store used for caching, outbox queues, and inbox idempotence.
   */
  kv: KvStore;

  /**
   * Prefixes for namespacing keys in the Deno KV store.  By default, all keys
   * are prefixed with `["_fedify"]`.
   */
  kvPrefixes?: Partial<FederationKvPrefixes>;

  /**
   * The message queue for sending activities to recipients' inboxes.
   * If not provided, activities will not be queued and will be sent
   * immediately.
   */
  queue?: MessageQueue;

  /**
   * A custom JSON-LD document loader.  By default, this uses the built-in
   * cache-backed loader that fetches remote documents over HTTP(S).
   */
  documentLoader?: DocumentLoader;

  /**
   * A factory function that creates an authenticated document loader for a
   * given identity.  This is used for fetching documents that require
   * authentication.
   *
   * @since 0.4.0
   */
  authenticatedDocumentLoaderFactory?: AuthenticatedDocumentLoaderFactory;

  /**
   * Whether to treat HTTP requests as HTTPS.  This is useful for testing and
   * local development.  However, it must be disabled in production.
   * Turned off by default.
   */
  treatHttps?: boolean;

  /**
   * A callback that handles errors during outbox processing.  Note that this
   * callback can be called multiple times for the same activity, because
   * the delivery is retried according to the backoff schedule until it
   * succeeds or reaches the maximum retry count.
   *
   * If any errors are thrown in this callback, they are ignored.
   *
   * @since 0.6.0
   */
  onOutboxError?: OutboxErrorHandler;

  // TODO: The following option should be removed, and exponential backoff
  // should be used instead:
  backoffSchedule?: Temporal.Duration[];
}

/**
 * Prefixes for namespacing keys in the Deno KV store.
 */
export interface FederationKvPrefixes {
  /**
   * The key prefix used for storing whether activities have already been
   * processed or not.  `["_fedify", "activityIdempotence"]` by default.
   */
  activityIdempotence: KvKey;

  /**
   * The key prefix used for storing remote JSON-LD documents.
   * `["_fedify", "remoteDocument"]` by default.
   */
  remoteDocument: KvKey;
}

/**
 * An object that registers federation-related business logic and dispatches
 * requests to the appropriate handlers.
 *
 * It also provides a middleware interface for handling requests before your
 * web framework's router; see {@link Federation.handle}.
 */
export class Federation<TContextData> {
  #kv: KvStore;
  #kvPrefixes: FederationKvPrefixes;
  #queue?: MessageQueue;
  #router: Router;
  #nodeInfoDispatcher?: NodeInfoDispatcher<TContextData>;
  #actorCallbacks?: ActorCallbacks<TContextData>;
  #outboxCallbacks?: CollectionCallbacks<Activity, TContextData>;
  #followingCallbacks?: CollectionCallbacks<Actor | URL, TContextData>;
  #followersCallbacks?: CollectionCallbacks<Actor | URL, TContextData>;
  #inboxListeners: Map<
    new (...args: unknown[]) => Activity,
    InboxListener<TContextData, Activity>
  >;
  #inboxErrorHandler?: InboxErrorHandler<TContextData>;
  #documentLoader: DocumentLoader;
  #authenticatedDocumentLoaderFactory: AuthenticatedDocumentLoaderFactory;
  #treatHttps: boolean;
  #onOutboxError?: OutboxErrorHandler;
  #backoffSchedule: Temporal.Duration[];

  /**
   * Create a new {@link Federation} instance.
   * @param parameters Parameters for initializing the instance.
   */
  constructor(
    {
      kv,
      kvPrefixes,
      queue,
      documentLoader,
      authenticatedDocumentLoaderFactory,
      treatHttps,
      onOutboxError,
      backoffSchedule,
    }: FederationParameters,
  ) {
    this.#kv = kv;
    this.#kvPrefixes = {
      ...({
        activityIdempotence: ["_fedify", "activityIdempotence"],
        remoteDocument: ["_fedify", "remoteDocument"],
      } satisfies FederationKvPrefixes),
      ...(kvPrefixes ?? {}),
    };
    this.#queue = queue;
    this.#router = new Router();
    this.#router.add("/.well-known/webfinger", "webfinger");
    this.#router.add("/.well-known/nodeinfo", "nodeInfoJrd");
    this.#inboxListeners = new Map();
    this.#documentLoader = documentLoader ?? kvCache({
      loader: fetchDocumentLoader,
      kv: kv,
      prefix: this.#kvPrefixes.remoteDocument,
    });
    this.#authenticatedDocumentLoaderFactory =
      authenticatedDocumentLoaderFactory ??
        getAuthenticatedDocumentLoader;
    this.#onOutboxError = onOutboxError;
    this.#treatHttps = treatHttps ?? false;
    this.#backoffSchedule = backoffSchedule ?? [
      3_000,
      15_000,
      60_000,
      15 * 60_000,
      60 * 60_000,
    ].map((ms) => Temporal.Duration.from({ milliseconds: ms }));

    queue?.listen(this.#listenQueue.bind(this));
  }

  async #listenQueue(message: OutboxMessage): Promise<void> {
    let activity: Activity | null = null;
    try {
      const keyId = new URL(message.keyId);
      const privateKey = await importJwk(message.privateKey, "private");
      const documentLoader = this.#authenticatedDocumentLoaderFactory(
        { keyId, privateKey },
      );
      activity = await Activity.fromJsonLd(message.activity, {
        documentLoader,
      });
      await sendActivity({
        keyId,
        privateKey,
        activity,
        inbox: new URL(message.inbox),
        documentLoader,
      });
    } catch (e) {
      try {
        this.#onOutboxError?.(e, activity);
      } catch (_) {
        // Ignore errors in the error handler.
      }
      if (message.trial < this.#backoffSchedule.length) {
        this.#queue?.enqueue({
          ...message,
          trial: message.trial + 1,
        }, { delay: this.#backoffSchedule[message.trial] });
      }
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
    const getKeyPairFromHandle = async (handle: string) => {
      if (this.#actorCallbacks?.keyPairDispatcher == null) {
        throw new Error("No actor key pair dispatcher registered.");
      }
      let keyPair = this.#actorCallbacks?.keyPairDispatcher(
        contextData,
        handle,
      );
      if (keyPair instanceof Promise) keyPair = await keyPair;
      if (keyPair == null) {
        throw new Error(
          `No key pair found for actor ${JSON.stringify(handle)}`,
        );
      }
      return {
        keyId: new URL(`${context.getActorUri(handle)}#main-key`),
        privateKey: keyPair.privateKey,
      };
    };
    const getAuthenticatedDocumentLoader =
      this.#authenticatedDocumentLoaderFactory;
    function getDocumentLoader(
      identity: { handle: string },
    ): Promise<DocumentLoader>;
    function getDocumentLoader(
      identity: { keyId: URL; privateKey: CryptoKey },
    ): DocumentLoader;
    function getDocumentLoader(
      identity: { keyId: URL; privateKey: CryptoKey } | { handle: string },
    ): DocumentLoader | Promise<DocumentLoader> {
      if ("handle" in identity) {
        const keyPair = getKeyPairFromHandle(identity.handle);
        return keyPair.then((pair) => getAuthenticatedDocumentLoader(pair));
      }
      return getAuthenticatedDocumentLoader(identity);
    }
    const context: Context<TContextData> = {
      data: contextData,
      documentLoader: this.#documentLoader,
      getNodeInfoUri: (): URL => {
        const path = this.#router.build("nodeInfo", {});
        if (path == null) {
          throw new RouterError("No NodeInfo dispatcher registered.");
        }
        return new URL(path, url);
      },
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
      getInboxUri: (handle?: string): URL => {
        if (handle == null) {
          const path = this.#router.build("sharedInbox", {});
          if (path == null) {
            throw new RouterError("No shared inbox path registered.");
          }
          return new URL(path, url);
        }
        const path = this.#router.build("inbox", { handle });
        if (path == null) {
          throw new RouterError("No inbox path registered.");
        }
        return new URL(path, url);
      },
      getFollowingUri: (handle: string): URL => {
        const path = this.#router.build("following", { handle });
        if (path == null) {
          throw new RouterError("No following collection path registered.");
        }
        return new URL(path, url);
      },
      getFollowersUri: (handle: string): URL => {
        const path = this.#router.build("followers", { handle });
        if (path == null) {
          throw new RouterError("No followers collection path registered.");
        }
        return new URL(path, url);
      },
      getHandleFromActorUri: (actorUri: URL) => {
        if (actorUri.origin !== url.origin) return null;
        const route = this.#router.route(actorUri.pathname);
        if (route?.name !== "actor") return null;
        return route.values.handle;
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
      getDocumentLoader,
      sendActivity: async (
        sender: { keyId: URL; privateKey: CryptoKey } | { handle: string },
        recipients: Actor | Actor[],
        activity: Activity,
        options: SendActivityOptions = {},
      ): Promise<void> => {
        const senderPair: { keyId: URL; privateKey: CryptoKey } =
          "handle" in sender
            ? await getKeyPairFromHandle(sender.handle)
            : sender;
        return await this.sendActivity(
          senderPair,
          recipients,
          activity,
          options,
        );
      },
    };
    if (request == null) return context;
    let signedKey: CryptographicKey | null | undefined = undefined;
    const reqCtx: RequestContext<TContextData> = {
      ...context,
      request,
      url,
      async getSignedKey() {
        if (signedKey !== undefined) return signedKey;
        return signedKey = await verify(request, context.documentLoader);
      },
    };
    return reqCtx;
  }

  /**
   * Registers a NodeInfo dispatcher.
   * @param path The URI path pattern for the NodeInfo dispatcher.  The syntax
   *             is based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have no variables.
   * @param dispatcher A NodeInfo dispatcher callback to register.
   * @throws {RouterError} Thrown if the path pattern is invalid.
   * @since 0.2.0
   */
  setNodeInfoDispatcher(
    path: string,
    dispatcher: NodeInfoDispatcher<TContextData>,
  ) {
    if (this.#router.has("nodeInfo")) {
      throw new RouterError("NodeInfo dispatcher already set.");
    }
    const variables = this.#router.add(path, "nodeInfo");
    if (variables.size !== 0) {
      throw new RouterError(
        "Path for NodeInfo dispatcher must have no variables.",
      );
    }
    this.#nodeInfoDispatcher = dispatcher;
  }

  /**
   * Registers an actor dispatcher.
   *
   * @example
   * ``` typescript
   * federation.setActorDispatcher(
   *   "/users/{handle}",
   *   async (ctx, handle, key) => {
   *     return new Person({
   *       id: ctx.getActorUri(handle),
   *       preferredUsername: handle,
   *       // ...
   *     });
   *   }
   * );
   * ```
   *
   * @param path The URI path pattern for the actor dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`.
   * @param dispatcher An actor dispatcher callback to register.
   * @returns An object with methods to set other actor dispatcher callbacks.
   * @throws {RouterError} Thrown if the path pattern is invalid.
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
   *
   * @example
   * ``` typescript
   * federation.setOutboxDispatcher(
   *   "/users/{handle}/outbox",
   *   async (ctx, handle, options) => {
   *     let items: Activity[];
   *     let nextCursor: string;
   *     // ...
   *     return { items, nextCursor };
   *   }
   * );
   * ```
   *
   * @param path The URI path pattern for the outbox dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`.
   * @param dispatcher An outbox dispatcher callback to register.
   * @throws {@link RouterError} Thrown if the path pattern is invalid.
   */
  setOutboxDispatcher(
    path: string,
    dispatcher: CollectionDispatcher<Activity, TContextData>,
  ): CollectionCallbackSetters<TContextData> {
    if (this.#router.has("outbox")) {
      throw new RouterError("Outbox dispatcher already set.");
    }
    const variables = this.#router.add(path, "outbox");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for outbox dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: CollectionCallbacks<Activity, TContextData> = {
      dispatcher,
    };
    this.#outboxCallbacks = callbacks;
    const setters: CollectionCallbackSetters<TContextData> = {
      setCounter(counter: CollectionCounter<TContextData>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: CollectionCursor<TContextData>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: CollectionCursor<TContextData>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
    };
    return setters;
  }

  /**
   * Registers a following collection dispatcher.
   * @param path The URI path pattern for the following collection.  The syntax
   *             is based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`.
   * @param dispatcher A following collection callback to register.
   * @returns An object with methods to set other following collection
   *          callbacks.
   * @throws {RouterError} Thrown if the path pattern is invalid.
   */
  setFollowingDispatcher(
    path: string,
    dispatcher: CollectionDispatcher<Actor | URL, TContextData>,
  ): CollectionCallbackSetters<TContextData> {
    if (this.#router.has("following")) {
      throw new RouterError("Following collection dispatcher already set.");
    }
    const variables = this.#router.add(path, "following");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for following collection dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: CollectionCallbacks<Actor | URL, TContextData> = {
      dispatcher,
    };
    this.#followingCallbacks = callbacks;
    const setters: CollectionCallbackSetters<TContextData> = {
      setCounter(counter: CollectionCounter<TContextData>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: CollectionCursor<TContextData>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: CollectionCursor<TContextData>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
    };
    return setters;
  }

  /**
   * Registers a followers collection dispatcher.
   * @param path The URI path pattern for the followers collection.  The syntax
   *             is based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`.
   * @param dispatcher A followers collection callback to register.
   * @returns An object with methods to set other followers collection
   *          callbacks.
   * @throws {@link RouterError} Thrown if the path pattern is invalid.
   */
  setFollowersDispatcher(
    path: string,
    dispatcher: CollectionDispatcher<Actor | URL, TContextData>,
  ): CollectionCallbackSetters<TContextData> {
    if (this.#router.has("followers")) {
      throw new RouterError("Followers collection dispatcher already set.");
    }
    const variables = this.#router.add(path, "followers");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for followers collection dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: CollectionCallbacks<Actor | URL, TContextData> = {
      dispatcher,
    };
    this.#followersCallbacks = callbacks;
    const setters: CollectionCallbackSetters<TContextData> = {
      setCounter(counter: CollectionCounter<TContextData>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: CollectionCursor<TContextData>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: CollectionCursor<TContextData>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
    };
    return setters;
  }

  /**
   * Assigns the URL path for the inbox and starts setting inbox listeners.
   *
   * @example
   * ``` typescript
   * federation
   *   .setInboxListeners("/users/{handle/inbox", "/inbox")
   *   .on(Follow, async (ctx, follow) => {
   *     const from = await follow.getActor(ctx);
   *     if (!isActor(from)) return;
   *     // ...
   *     await ctx.sendActivity({ })
   *   })
   *   .on(Undo, async (ctx, undo) => {
   *     // ...
   *   });
   * ```
   *
   * @param inboxPath The URI path pattern for the inbox.  The syntax is based
   *                  on URI Template
   *                  ([RFC 6570](https://tools.ietf.org/html/rfc6570)).
   *                  The path must have one variable: `{handle}`.
   * @param sharedInboxPath An optional URI path pattern for the shared inbox.
   *                        The syntax is based on URI Template
   *                        ([RFC 6570](https://tools.ietf.org/html/rfc6570)).
   *                        The path must have no variables.
   * @returns An object to register inbox listeners.
   * @throws {RouteError} Thrown if the path pattern is invalid.
   */
  setInboxListeners(
    inboxPath: string,
    sharedInboxPath?: string,
  ): InboxListenerSetter<TContextData> {
    if (this.#router.has("inbox")) {
      throw new RouterError("Inbox already set.");
    }
    const variables = this.#router.add(inboxPath, "inbox");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for inbox must have one variable: {handle}",
      );
    }
    if (sharedInboxPath != null) {
      const siVars = this.#router.add(sharedInboxPath, "sharedInbox");
      if (siVars.size !== 0) {
        throw new RouterError(
          "Path for shared inbox must have no variables.",
        );
      }
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
        handler: InboxErrorHandler<TContextData>,
      ): InboxListenerSetter<TContextData> => {
        this.#inboxErrorHandler = handler;
        return setter;
      },
    };
    return setter;
  }

  /**
   * Sends an activity to recipients' inboxes.  You would typically use
   * {@link Context.sendActivity} instead of this method.
   *
   * @param sender The sender's key pair.
   * @param recipients The recipients of the activity.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   * @throws {TypeError} If the activity to send does not have an actor.
   */
  async sendActivity(
    { keyId, privateKey }: { keyId: URL; privateKey: CryptoKey },
    recipients: Actor | Actor[],
    activity: Activity,
    { preferSharedInbox, immediate }: SendActivityOptions = {},
  ): Promise<void> {
    if (activity.actorId == null) {
      throw new TypeError(
        "The activity to send must have at least one actor property.",
      );
    }
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
    if (immediate || this.#queue == null) {
      const documentLoader = this.#authenticatedDocumentLoaderFactory(
        { keyId, privateKey },
      );
      const promises: Promise<void>[] = [];
      for (const inbox of inboxes) {
        promises.push(
          sendActivity({
            keyId,
            privateKey,
            activity,
            inbox,
            documentLoader,
          }),
        );
      }
      await Promise.all(promises);
      return;
    }
    const privateKeyJwk = await exportJwk(privateKey);
    const activityJson = await activity.toJsonLd({ expand: true });
    for (const inbox of inboxes) {
      const message: OutboxMessage = {
        type: "outbox",
        keyId: keyId.href,
        privateKey: privateKeyJwk,
        activity: activityJson,
        inbox: inbox.href,
        trial: 0,
      };
      this.#queue.enqueue(message);
    }
  }

  /**
   * Handles a request related to federation.  If a request is not related to
   * federation, the `onNotFound` or `onNotAcceptable` callback is called.
   *
   * Usually, this method is called from a server's request handler or
   * a web framework's middleware.
   *
   * @param request The request object.
   * @param parameters The parameters for handling the request.
   * @returns The response to the request.
   * @deprecated Use {@link Federation.fetch} instead.
   */
  handle(
    request: Request,
    options: FederationFetchOptions<TContextData>,
  ): Promise<Response> {
    return this.fetch(request, options);
  }

  /**
   * Handles a request related to federation.  If a request is not related to
   * federation, the `onNotFound` or `onNotAcceptable` callback is called.
   *
   * Usually, this method is called from a server's request handler or
   * a web framework's middleware.
   *
   * @param request The request object.
   * @param parameters The parameters for handling the request.
   * @returns The response to the request.
   * @since 0.6.0
   */
  async fetch(
    request: Request,
    {
      onNotFound,
      onNotAcceptable,
      contextData,
    }: FederationFetchOptions<TContextData>,
  ): Promise<Response> {
    onNotFound ??= notFound;
    onNotAcceptable ??= notAcceptable;
    const url = new URL(request.url);
    const route = this.#router.route(url.pathname);
    if (route == null) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
    let context = this.createContext(request, contextData);
    switch (route.name) {
      case "webfinger":
        return await handleWebFinger(request, {
          context,
          actorDispatcher: this.#actorCallbacks?.dispatcher,
          onNotFound,
        });
      case "nodeInfoJrd":
        return await handleNodeInfoJrd(request, context);
      case "nodeInfo":
        return await handleNodeInfo(request, {
          context,
          nodeInfoDispatcher: this.#nodeInfoDispatcher!,
        });
      case "actor":
        return await handleActor(request, {
          handle: route.values.handle,
          context,
          actorDispatcher: this.#actorCallbacks?.dispatcher,
          onNotFound,
          onNotAcceptable,
        });
      case "outbox":
        return await handleCollection(request, {
          handle: route.values.handle,
          context,
          collectionCallbacks: this.#outboxCallbacks,
          onNotFound,
          onNotAcceptable,
        });
      case "inbox":
        context = {
          ...context,
          documentLoader: await context.getDocumentLoader({
            handle: route.values.handle,
          }),
        };
        // falls through
      case "sharedInbox":
        return await handleInbox(request, {
          handle: route.values.handle ?? null,
          context,
          kv: this.#kv,
          kvPrefix: this.#kvPrefixes.activityIdempotence,
          actorDispatcher: this.#actorCallbacks?.dispatcher,
          inboxListeners: this.#inboxListeners,
          inboxErrorHandler: this.#inboxErrorHandler,
          onNotFound,
        });
      case "following":
        return await handleCollection(request, {
          handle: route.values.handle,
          context,
          collectionCallbacks: this.#followingCallbacks,
          onNotFound,
          onNotAcceptable,
        });
      case "followers":
        return await handleCollection(request, {
          handle: route.values.handle,
          context,
          collectionCallbacks: this.#followersCallbacks,
          onNotFound,
          onNotAcceptable,
        });
      default: {
        const response = onNotFound(request);
        return response instanceof Promise ? await response : response;
      }
    }
  }
}

/**
 * Parameters of {@link Federation.fetch} method.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @since 0.6.0
 */
export interface FederationFetchOptions<TContextData> {
  /**
   * The context data to pass to the {@link Context}.
   */
  contextData: TContextData;

  /**
   * A callback to handle a request when the route is not found.
   * If not provided, a 404 response is returned.
   * @param request The request object.
   * @returns The response to the request.
   */
  onNotFound?: (request: Request) => Response | Promise<Response>;

  /**
   * A callback to handle a request when the request's `Accept` header is not
   * acceptable.  If not provided, a 406 response is returned.
   * @param request The request object.
   * @returns The response to the request.
   */
  onNotAcceptable?: (request: Request) => Response | Promise<Response>;
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

/**
 * Additional settings for a collection dispatcher.
 */
export interface CollectionCallbackSetters<TContextData> {
  setCounter(
    counter: CollectionCounter<TContextData>,
  ): CollectionCallbackSetters<TContextData>;

  setFirstCursor(
    cursor: CollectionCursor<TContextData>,
  ): CollectionCallbackSetters<TContextData>;

  setLastCursor(
    cursor: CollectionCursor<TContextData>,
  ): CollectionCallbackSetters<TContextData>;
}

/**
 * Registry for inbox listeners for different activity types.
 */
export interface InboxListenerSetter<TContextData> {
  /**
   * Registers a listener for a specific incoming activity type.
   *
   * @param type A subclass of {@link Activity} to listen to.
   * @param listener A callback to handle an incoming activity.
   * @returns The setters object so that settings can be chained.
   */
  on<TActivity extends Activity>(
    // deno-lint-ignore no-explicit-any
    type: new (...args: any[]) => TActivity,
    listener: InboxListener<TContextData, TActivity>,
  ): InboxListenerSetter<TContextData>;

  /**
   * Registers an error handler for inbox listeners.  Any exceptions thrown
   * from the listeners are caught and passed to this handler.
   *
   * @param handler A callback to handle an error.
   * @returns The setters object so that settings can be chained.
   */
  onError(
    handler: InboxErrorHandler<TContextData>,
  ): InboxListenerSetter<TContextData>;
}

function notFound(_request: Request): Response {
  return new Response("Not Found", { status: 404 });
}

function notAcceptable(_request: Request): Response {
  return new Response("Not Acceptable", { status: 406 });
}
