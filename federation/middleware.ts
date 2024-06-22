import { getLogger } from "@logtape/logtape";
import { handleNodeInfo, handleNodeInfoJrd } from "../nodeinfo/handler.ts";
import {
  type AuthenticatedDocumentLoaderFactory,
  type DocumentLoader,
  fetchDocumentLoader,
  getAuthenticatedDocumentLoader,
  kvCache,
} from "../runtime/docloader.ts";
import { verifyRequest } from "../sig/http.ts";
import { exportJwk, importJwk, validateCryptoKey } from "../sig/key.ts";
import { getKeyOwner } from "../sig/owner.ts";
import type { Actor, Recipient } from "../vocab/actor.ts";
import {
  Activity,
  CryptographicKey,
  Multikey,
  type Object,
} from "../vocab/mod.ts";
import { handleWebFinger } from "../webfinger/handler.ts";
import type {
  ActorDispatcher,
  ActorKeyPairDispatcher,
  ActorKeyPairsDispatcher,
  AuthorizePredicate,
  CollectionCounter,
  CollectionCursor,
  CollectionDispatcher,
  InboxErrorHandler,
  InboxListener,
  NodeInfoDispatcher,
  ObjectAuthorizePredicate,
  ObjectDispatcher,
  OutboxErrorHandler,
  SharedInboxKeyDispatcher,
} from "./callback.ts";
import { buildCollectionSynchronizationHeader } from "./collection.ts";
import type {
  ActorKeyPair,
  Context,
  ParseUriResult,
  RequestContext,
  SendActivityOptions,
} from "./context.ts";
import {
  type CollectionCallbacks,
  handleActor,
  handleCollection,
  handleInbox,
  handleObject,
} from "./handler.ts";
import type { KvKey, KvStore } from "./kv.ts";
import type { MessageQueue } from "./mq.ts";
import type { OutboxMessage, SenderKeyJwkPair } from "./queue.ts";
import { Router, RouterError } from "./router.ts";
import { extractInboxes, sendActivity, type SenderKeyPair } from "./send.ts";

/**
 * Options for {@link createFederation} function.
 * @since 0.10.0
 */
export interface CreateFederationOptions {
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
   * A custom JSON-LD context loader.  By default, this uses the same loader
   * as the document loader.
   */
  contextLoader?: DocumentLoader;

  /**
   * A factory function that creates an authenticated document loader for a
   * given identity.  This is used for fetching documents that require
   * authentication.
   */
  authenticatedDocumentLoaderFactory?: AuthenticatedDocumentLoaderFactory;

  /**
   * A callback that handles errors during outbox processing.  Note that this
   * callback can be called multiple times for the same activity, because
   * the delivery is retried according to the backoff schedule until it
   * succeeds or reaches the maximum retry count.
   *
   * If any errors are thrown in this callback, they are ignored.
   */
  onOutboxError?: OutboxErrorHandler;

  /**
   * The time window for verifying the signature of incoming requests.  If the
   * request is older or newer than this window, it is rejected.  By default,
   * the window is a minute.
   */
  signatureTimeWindow?: Temporal.DurationLike;
}

/**
 * Parameters for initializing a {@link Federation} instance.
 * @deprecated
 */
export interface FederationParameters extends CreateFederationOptions {
  /**
   * The message queue for sending activities to recipients' inboxes.
   * If not provided, activities will not be queued and will be sent
   * immediately.
   * @since 0.5.0
   */
  queue?: MessageQueue;

  /**
   * A custom JSON-LD context loader.  By default, this uses the same loader
   * as the document loader.
   * @since 0.8.0
   */
  contextLoader?: DocumentLoader;

  /**
   * A factory function that creates an authenticated document loader for a
   * given identity.  This is used for fetching documents that require
   * authentication.
   *
   * @since 0.4.0
   */
  authenticatedDocumentLoaderFactory?: AuthenticatedDocumentLoaderFactory;

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

  /**
   * The time window for verifying the signature of incoming requests.  If the
   * request is older or newer than this window, it is rejected.  By default,
   * the window is a minute.
   */
  signatureTimeWindow?: Temporal.DurationLike;

  /**
   * Whether to treat HTTP requests as HTTPS.  This is useful for testing and
   * local development.  However, it must be disabled in production.
   * Turned off by default.
   *
   * Note that this option is deprecated and will be removed in a future
   * release.  Instead, use the [x-forwarded-fetch] library to recognize
   * the `X-Forwarded-Host` and `X-Forwarded-Proto` headers.
   *
   * [x-forwarded-fetch]: https://github.com/dahlia/x-forwarded-fetch
   *
   * @deprecated
   */
  treatHttps?: boolean;

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

const invokedByCreateFederation = Symbol("invokedByCreateFederation");

/**
 * Create a new {@link Federation} instance.
 * @param parameters Parameters for initializing the instance.
 * @returns A new {@link Federation} instance.
 * @since 0.10.0
 */
export function createFederation<TContextData>(
  options: CreateFederationOptions,
): Federation<TContextData> {
  return new Federation<TContextData>({
    ...options,
    // @ts-ignore: This is a private symbol.
    [invokedByCreateFederation]: true,
  });
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
  #queueStarted: boolean;
  #router: Router;
  #nodeInfoDispatcher?: NodeInfoDispatcher<TContextData>;
  #actorCallbacks?: ActorCallbacks<TContextData>;
  #objectCallbacks: Record<string, ObjectCallbacks<TContextData, string>>;
  #objectTypeIds: Record<
    string,
    // deno-lint-ignore no-explicit-any
    (new (...args: any[]) => Object) & { typeId: URL }
  >;
  #inboxPath?: string;
  #inboxCallbacks?: CollectionCallbacks<Activity, TContextData, void>;
  #outboxCallbacks?: CollectionCallbacks<Activity, TContextData, void>;
  #followingCallbacks?: CollectionCallbacks<Actor | URL, TContextData, void>;
  #followersCallbacks?: CollectionCallbacks<Recipient, TContextData, URL>;
  #inboxListeners?: Map<
    new (...args: unknown[]) => Activity,
    InboxListener<TContextData, Activity>
  >;
  #inboxErrorHandler?: InboxErrorHandler<TContextData>;
  #sharedInboxKeyDispatcher?: SharedInboxKeyDispatcher<TContextData>;
  #documentLoader: DocumentLoader;
  #contextLoader: DocumentLoader;
  #authenticatedDocumentLoaderFactory: AuthenticatedDocumentLoaderFactory;
  #treatHttps: boolean;
  #onOutboxError?: OutboxErrorHandler;
  #signatureTimeWindow: Temporal.DurationLike;
  #backoffSchedule: Temporal.Duration[];

  /**
   * Create a new {@link Federation} instance.
   * @param parameters Parameters for initializing the instance.
   * @deprecated Use {@link createFederation} method instead.
   */
  constructor(options: FederationParameters) {
    const logger = getLogger(["fedify", "federation"]);
    // @ts-ignore: This is a private symbol.
    if (!options[invokedByCreateFederation]) {
      logger.warn(
        "The Federation constructor is deprecated.  Use the createFederation()" +
          "function instead.",
      );
    }
    this.#kv = options.kv;
    this.#kvPrefixes = {
      ...({
        activityIdempotence: ["_fedify", "activityIdempotence"],
        remoteDocument: ["_fedify", "remoteDocument"],
      } satisfies FederationKvPrefixes),
      ...(options.kvPrefixes ?? {}),
    };
    this.#queue = options.queue;
    this.#queueStarted = false;
    this.#router = new Router();
    this.#router.add("/.well-known/webfinger", "webfinger");
    this.#router.add("/.well-known/nodeinfo", "nodeInfoJrd");
    this.#objectCallbacks = {};
    this.#objectTypeIds = {};
    this.#documentLoader = options.documentLoader ?? kvCache({
      loader: fetchDocumentLoader,
      kv: options.kv,
      prefix: this.#kvPrefixes.remoteDocument,
    });
    this.#contextLoader = options.contextLoader ?? this.#documentLoader;
    this.#authenticatedDocumentLoaderFactory =
      options.authenticatedDocumentLoaderFactory ??
        getAuthenticatedDocumentLoader;
    this.#onOutboxError = options.onOutboxError;
    this.#treatHttps = options.treatHttps ?? false;
    if (options.treatHttps) {
      logger.warn(
        "The treatHttps option is deprecated and will be removed in " +
          "a future release.  Instead, use the x-forwarded-fetch library" +
          " to recognize the X-Forwarded-Host and X-Forwarded-Proto " +
          "headers.  See also: <https://github.com/dahlia/x-forwarded-fetch>.",
      );
    }
    this.#signatureTimeWindow = options.signatureTimeWindow ?? { minutes: 1 };
    this.#backoffSchedule = options.backoffSchedule ?? [
      3_000,
      15_000,
      60_000,
      15 * 60_000,
      60 * 60_000,
    ].map((ms) => Temporal.Duration.from({ milliseconds: ms }));
  }

  #startQueue() {
    if (this.#queue != null && !this.#queueStarted) {
      const logger = getLogger(["fedify", "federation", "outbox"]);
      logger.debug("Starting an outbox queue.");
      this.#queue?.listen(this.#listenQueue.bind(this));
      this.#queueStarted = true;
    }
  }

  async #listenQueue(message: OutboxMessage): Promise<void> {
    const logger = getLogger(["fedify", "federation", "outbox"]);
    const logData = {
      keyIds: message.keys.map((pair) => pair.keyId),
      inbox: message.inbox,
      activity: message.activity,
      trial: message.trial,
      headers: message.headers,
    };
    let activity: Activity | null = null;
    try {
      const keys: SenderKeyPair[] = [];
      let rsaKeyPair: SenderKeyPair | null = null;
      for (const { keyId, privateKey } of message.keys) {
        const pair: SenderKeyPair = {
          keyId: new URL(keyId),
          privateKey: await importJwk(privateKey, "private"),
        };
        if (
          rsaKeyPair == null &&
          pair.privateKey.algorithm.name === "RSASSA-PKCS1-v1_5"
        ) {
          rsaKeyPair = pair;
        }
        keys.push(pair);
      }
      const documentLoader = rsaKeyPair == null
        ? this.#documentLoader
        : this.#authenticatedDocumentLoaderFactory(rsaKeyPair);
      activity = await Activity.fromJsonLd(message.activity, {
        documentLoader,
        contextLoader: this.#contextLoader,
      });
      await sendActivity({
        keys,
        activity,
        inbox: new URL(message.inbox),
        contextLoader: this.#contextLoader,
        headers: new Headers(message.headers),
      });
    } catch (error) {
      try {
        this.#onOutboxError?.(error, activity);
      } catch (error) {
        logger.error(
          "An unexpected error occurred in onError handler:\n{error}",
          { ...logData, error, activityId: activity?.id?.href },
        );
      }
      if (message.trial < this.#backoffSchedule.length) {
        logger.error(
          "Failed to send activity {activityId} to {inbox} (trial #{trial})" +
            "; retry...:\n{error}",
          { ...logData, error, activityId: activity?.id?.href },
        );
        this.#queue?.enqueue({
          ...message,
          trial: message.trial + 1,
        }, { delay: this.#backoffSchedule[message.trial] });
      } else {
        logger.error(
          "Failed to send activity {activityId} to {inbox} after {trial} " +
            "trials; giving up:\n{error}",
          { ...logData, error, activityId: activity?.id?.href },
        );
      }
      return;
    }
    logger.info(
      "Successfully sent activity {activityId} to {inbox}.",
      { ...logData, activityId: activity?.id?.href },
    );
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
    return urlOrRequest instanceof Request
      ? this.#createContext(urlOrRequest, contextData)
      : this.#createContext(urlOrRequest, contextData);
  }

  #createContext(
    baseUrl: URL,
    contextData: TContextData,
  ): ContextImpl<TContextData>;

  #createContext(
    request: Request,
    contextData: TContextData,
    opts?: {
      documentLoader?: DocumentLoader;
      invokedFromActorDispatcher?: { handle: string };
      invokedFromObjectDispatcher?: {
        // deno-lint-ignore no-explicit-any
        cls: (new (...args: any[]) => Object) & { typeId: URL };
        values: Record<string, string>;
      };
    },
  ): RequestContextImpl<TContextData>;

  #createContext(
    urlOrRequest: Request | URL,
    contextData: TContextData,
    opts: {
      documentLoader?: DocumentLoader;
      invokedFromActorDispatcher?: { handle: string };
      invokedFromObjectDispatcher?: {
        // deno-lint-ignore no-explicit-any
        cls: (new (...args: any[]) => Object) & { typeId: URL };
        values: Record<string, string>;
      };
    } = {},
  ): ContextImpl<TContextData> | RequestContextImpl<TContextData> {
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
    const ctxOptions: ContextOptions<TContextData> = {
      url,
      federation: this,
      router: this.#router,
      objectTypeIds: this.#objectTypeIds,
      objectCallbacks: this.#objectCallbacks,
      actorCallbacks: this.#actorCallbacks,
      data: contextData,
      documentLoader: opts.documentLoader ?? this.#documentLoader,
      contextLoader: this.#contextLoader,
      authenticatedDocumentLoaderFactory:
        this.#authenticatedDocumentLoaderFactory,
    };
    if (request == null) return new ContextImpl(ctxOptions);
    return new RequestContextImpl({
      ...ctxOptions,
      request,
      signatureTimeWindow: this.#signatureTimeWindow,
      followersCallbacks: this.#followersCallbacks,
      invokedFromActorDispatcher: opts.invokedFromActorDispatcher,
      invokedFromObjectDispatcher: opts.invokedFromObjectDispatcher,
    });
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
   *   async (ctx, handle) => {
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
    path: `${string}{handle}${string}`,
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
    const callbacks: ActorCallbacks<TContextData> = {
      dispatcher: async (context, handle, key) => {
        const actor = await dispatcher(context, handle, key);
        if (actor == null) return null;
        const logger = getLogger(["fedify", "federation", "actor"]);
        if (
          this.#followingCallbacks != null &&
          this.#followingCallbacks.dispatcher != null
        ) {
          if (actor.followingId == null) {
            logger.warn(
              "You configured a following collection dispatcher, but the " +
                "actor does not have a following property.  Set the property " +
                "with Context.getFollowingUri(handle).",
            );
          } else if (
            actor.followingId.href != context.getFollowingUri(handle).href
          ) {
            logger.warn(
              "You configured a following collection dispatcher, but the " +
                "actor's following property does not match the following " +
                "collection URI.  Set the property with " +
                "Context.getFollowingUri(handle).",
            );
          }
        }
        if (
          this.#followersCallbacks != null &&
          this.#followersCallbacks.dispatcher != null
        ) {
          if (actor.followersId == null) {
            logger.warn(
              "You configured a followers collection dispatcher, but the " +
                "actor does not have a followers property.  Set the property " +
                "with Context.getFollowersUri(handle).",
            );
          } else if (
            actor.followersId.href != context.getFollowersUri(handle).href
          ) {
            logger.warn(
              "You configured a followers collection dispatcher, but the " +
                "actor's followers property does not match the followers " +
                "collection URI.  Set the property with " +
                "Context.getFollowersUri(handle).",
            );
          }
        }
        if (
          this.#outboxCallbacks != null &&
          this.#outboxCallbacks.dispatcher != null
        ) {
          if (actor?.outboxId == null) {
            logger.warn(
              "You configured an outbox collection dispatcher, but the " +
                "actor does not have an outbox property.  Set the property " +
                "with Context.getOutboxUri(handle).",
            );
          } else if (actor.outboxId.href != context.getOutboxUri(handle).href) {
            logger.warn(
              "You configured an outbox collection dispatcher, but the " +
                "actor's outbox property does not match the outbox collection " +
                "URI.  Set the property with Context.getOutboxUri(handle).",
            );
          }
        }
        if (this.#router.has("inbox")) {
          if (actor.inboxId == null) {
            logger.warn(
              "You configured inbox listeners, but the actor does not " +
                "have an inbox property.  Set the property with " +
                "Context.getInboxUri(handle).",
            );
          } else if (actor.inboxId.href != context.getInboxUri(handle).href) {
            logger.warn(
              "You configured inbox listeners, but the actor's inbox " +
                "property does not match the inbox URI.  Set the property " +
                "with Context.getInboxUri(handle).",
            );
          }
          if (actor.endpoints == null || actor.endpoints.sharedInbox == null) {
            logger.warn(
              "You configured inbox listeners, but the actor does not have " +
                "a endpoints.sharedInbox property.  Set the property with " +
                "Context.getInboxUri().",
            );
          } else if (
            actor.endpoints.sharedInbox.href != context.getInboxUri().href
          ) {
            logger.warn(
              "You configured inbox listeners, but the actor's " +
                "endpoints.sharedInbox property does not match the shared inbox " +
                "URI.  Set the property with Context.getInboxUri().",
            );
          }
        }
        if (callbacks.keyPairsDispatcher != null) {
          if (actor.publicKeyId == null) {
            logger.warn(
              "You configured a key pairs dispatcher, but the actor does " +
                "not have a publicKey property.  Set the property with " +
                "Context.getActorKeyPairs(handle).",
            );
          }
          if (actor.assertionMethodId == null) {
            logger.warn(
              "You configured a key pairs dispatcher, but the actor does " +
                "not have an assertionMethod property.  Set the property " +
                "with Context.getActorKeyPairs(handle).",
            );
          }
        }
        return actor;
      },
    };
    this.#actorCallbacks = callbacks;
    const setters: ActorCallbackSetters<TContextData> = {
      setKeyPairsDispatcher(dispatcher: ActorKeyPairsDispatcher<TContextData>) {
        callbacks.keyPairsDispatcher = dispatcher;
        return setters;
      },
      setKeyPairDispatcher(dispatcher: ActorKeyPairDispatcher<TContextData>) {
        getLogger(["fedify", "federation", "actor"]).warn(
          "The ActorCallbackSetters.setKeyPairDispatcher() method is " +
            "deprecated.  Use the ActorCallbackSetters.setKeyPairsDispatcher() " +
            "instead.",
        );
        callbacks.keyPairsDispatcher = async (ctxData, handle) => {
          const key = await dispatcher(ctxData, handle);
          if (key == null) return [];
          return [key];
        };
        return setters;
      },
      authorize(predicate: AuthorizePredicate<TContextData>) {
        callbacks.authorizePredicate = predicate;
        return setters;
      },
    };
    return setters;
  }

  /**
   * Registers an object dispatcher.
   *
   * @typeParam TContextData The context data to pass to the {@link Context}.
   * @typeParam TObject The type of object to dispatch.
   * @typeParam TParam The parameter names of the requested URL.
   * @param cls The Activity Vocabulary class of the object to dispatch.
   * @param path The URI path pattern for the object dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one or more variables.
   * @param dispatcher An object dispatcher callback to register.
   * @since 0.7.0
   */
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path:
      `${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;

  /**
   * Registers an object dispatcher.
   *
   * @typeParam TContextData The context data to pass to the {@link Context}.
   * @typeParam TObject The type of object to dispatch.
   * @typeParam TParam The parameter names of the requested URL.
   * @param cls The Activity Vocabulary class of the object to dispatch.
   * @param path The URI path pattern for the object dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one or more variables.
   * @param dispatcher An object dispatcher callback to register.
   * @since 0.7.0
   */
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path:
      `${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;

  /**
   * Registers an object dispatcher.
   *
   * @typeParam TContextData The context data to pass to the {@link Context}.
   * @typeParam TObject The type of object to dispatch.
   * @typeParam TParam The parameter names of the requested URL.
   * @param cls The Activity Vocabulary class of the object to dispatch.
   * @param path The URI path pattern for the object dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one or more variables.
   * @param dispatcher An object dispatcher callback to register.
   * @since 0.7.0
   */
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path:
      `${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;

  /**
   * Registers an object dispatcher.
   *
   * @typeParam TContextData The context data to pass to the {@link Context}.
   * @typeParam TObject The type of object to dispatch.
   * @typeParam TParam The parameter names of the requested URL.
   * @param cls The Activity Vocabulary class of the object to dispatch.
   * @param path The URI path pattern for the object dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one or more variables.
   * @param dispatcher An object dispatcher callback to register.
   * @since 0.7.0
   */
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path:
      `${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;

  /**
   * Registers an object dispatcher.
   *
   * @typeParam TContextData The context data to pass to the {@link Context}.
   * @typeParam TObject The type of object to dispatch.
   * @typeParam TParam The parameter names of the requested URL.
   * @param cls The Activity Vocabulary class of the object to dispatch.
   * @param path The URI path pattern for the object dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one or more variables.
   * @param dispatcher An object dispatcher callback to register.
   * @since 0.7.0
   */
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path: `${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;

  /**
   * Registers an object dispatcher.
   *
   * @typeParam TContextData The context data to pass to the {@link Context}.
   * @typeParam TObject The type of object to dispatch.
   * @typeParam TParam The parameter names of the requested URL.
   * @param cls The Activity Vocabulary class of the object to dispatch.
   * @param path The URI path pattern for the object dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one or more variables.
   * @param dispatcher An object dispatcher callback to register.
   * @since 0.7.0
   */
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path: `${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;

  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path: string,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam> {
    const routeName = `object:${cls.typeId.href}`;
    if (this.#router.has(routeName)) {
      throw new RouterError(`Object dispatcher for ${cls.name} already set.`);
    }
    const variables = this.#router.add(path, routeName);
    if (variables.size < 1) {
      throw new RouterError(
        "Path for object dispatcher must have at least one variable.",
      );
    }
    const callbacks: ObjectCallbacks<TContextData, TParam> = {
      dispatcher,
      parameters: variables as unknown as Set<TParam>,
    };
    this.#objectCallbacks[cls.typeId.href] = callbacks;
    this.#objectTypeIds[cls.typeId.href] = cls;
    const setters: ObjectCallbackSetters<TContextData, TObject, TParam> = {
      authorize(predicate: ObjectAuthorizePredicate<TContextData, TParam>) {
        callbacks.authorizePredicate = predicate;
        return setters;
      },
    };
    return setters;
  }

  /**
   * Registers an inbox dispatcher.
   *
   * @param path The URI path pattern for the outbox dispatcher.  The syntax is
   *             based on URI Template
   *             ([RFC 6570](https://tools.ietf.org/html/rfc6570)).  The path
   *             must have one variable: `{handle}`, and must match the inbox
   *             listener path.
   * @param dispatcher An inbox dispatcher callback to register.
   * @throws {@link RouterError} Thrown if the path pattern is invalid.
   * @since 0.11.0
   */
  setInboxDispatcher(
    path: `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<Activity, TContextData, void>,
  ): CollectionCallbackSetters<TContextData, void> {
    if (this.#inboxCallbacks != null) {
      throw new RouterError("Inbox dispatcher already set.");
    }
    if (this.#router.has("inbox")) {
      if (this.#inboxPath !== path) {
        throw new RouterError(
          "Inbox dispatcher path must match inbox listener path.",
        );
      }
    } else {
      const variables = this.#router.add(path, "inbox");
      if (variables.size !== 1 || !variables.has("handle")) {
        throw new RouterError(
          "Path for inbox dispatcher must have one variable: {handle}",
        );
      }
      this.#inboxPath = path;
    }
    const callbacks: CollectionCallbacks<Activity, TContextData, void> = {
      dispatcher,
    };
    this.#inboxCallbacks = callbacks;
    const setters: CollectionCallbackSetters<TContextData, void> = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: CollectionCursor<TContextData, void>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: CollectionCursor<TContextData, void>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
      authorize(predicate: AuthorizePredicate<TContextData>) {
        callbacks.authorizePredicate = predicate;
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
    path: `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<Activity, TContextData, void>,
  ): CollectionCallbackSetters<TContextData, void> {
    if (this.#router.has("outbox")) {
      throw new RouterError("Outbox dispatcher already set.");
    }
    const variables = this.#router.add(path, "outbox");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for outbox dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: CollectionCallbacks<Activity, TContextData, void> = {
      dispatcher,
    };
    this.#outboxCallbacks = callbacks;
    const setters: CollectionCallbackSetters<TContextData, void> = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: CollectionCursor<TContextData, void>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: CollectionCursor<TContextData, void>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
      authorize(predicate: AuthorizePredicate<TContextData>) {
        callbacks.authorizePredicate = predicate;
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
    path: `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<Actor | URL, TContextData, void>,
  ): CollectionCallbackSetters<TContextData, void> {
    if (this.#router.has("following")) {
      throw new RouterError("Following collection dispatcher already set.");
    }
    const variables = this.#router.add(path, "following");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for following collection dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: CollectionCallbacks<Actor | URL, TContextData, void> = {
      dispatcher,
    };
    this.#followingCallbacks = callbacks;
    const setters: CollectionCallbackSetters<TContextData, void> = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: CollectionCursor<TContextData, void>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: CollectionCursor<TContextData, void>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
      authorize(predicate: AuthorizePredicate<TContextData>) {
        callbacks.authorizePredicate = predicate;
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
    path: `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<
      Recipient,
      TContextData,
      URL
    >,
  ): CollectionCallbackSetters<TContextData, URL> {
    if (this.#router.has("followers")) {
      throw new RouterError("Followers collection dispatcher already set.");
    }
    const variables = this.#router.add(path, "followers");
    if (variables.size !== 1 || !variables.has("handle")) {
      throw new RouterError(
        "Path for followers collection dispatcher must have one variable: {handle}",
      );
    }
    const callbacks: CollectionCallbacks<
      Recipient,
      TContextData,
      URL
    > = {
      dispatcher,
    };
    this.#followersCallbacks = callbacks;
    const setters: CollectionCallbackSetters<TContextData, URL> = {
      setCounter(counter: CollectionCounter<TContextData, URL>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(cursor: CollectionCursor<TContextData, URL>) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(cursor: CollectionCursor<TContextData, URL>) {
        callbacks.lastCursor = cursor;
        return setters;
      },
      authorize(predicate: AuthorizePredicate<TContextData>) {
        callbacks.authorizePredicate = predicate;
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
   *                  The path must have one variable: `{handle}`, and must
   *                  match the inbox dispatcher path.
   * @param sharedInboxPath An optional URI path pattern for the shared inbox.
   *                        The syntax is based on URI Template
   *                        ([RFC 6570](https://tools.ietf.org/html/rfc6570)).
   *                        The path must have no variables.
   * @returns An object to register inbox listeners.
   * @throws {RouteError} Thrown if the path pattern is invalid.
   */
  setInboxListeners(
    inboxPath: `${string}{handle}${string}`,
    sharedInboxPath?: string,
  ): InboxListenerSetters<TContextData> {
    if (this.#inboxListeners != null) {
      throw new RouterError("Inbox listeners already set.");
    }
    if (this.#router.has("inbox")) {
      if (this.#inboxPath !== inboxPath) {
        throw new RouterError(
          "Inbox listener path must match inbox dispatcher path.",
        );
      }
    } else {
      const variables = this.#router.add(inboxPath, "inbox");
      if (variables.size !== 1 || !variables.has("handle")) {
        throw new RouterError(
          "Path for inbox must have one variable: {handle}",
        );
      }
    }
    if (sharedInboxPath != null) {
      const siVars = this.#router.add(sharedInboxPath, "sharedInbox");
      if (siVars.size !== 0) {
        throw new RouterError(
          "Path for shared inbox must have no variables.",
        );
      }
    }
    const listeners = this.#inboxListeners = new Map();
    const setters: InboxListenerSetters<TContextData> = {
      on<TActivity extends Activity>(
        // deno-lint-ignore no-explicit-any
        type: new (...args: any[]) => TActivity,
        listener: InboxListener<TContextData, TActivity>,
      ): InboxListenerSetters<TContextData> {
        if (listeners.has(type)) {
          throw new TypeError("Listener already set for this type.");
        }
        listeners.set(type, listener as InboxListener<TContextData, Activity>);
        return setters;
      },
      onError: (
        handler: InboxErrorHandler<TContextData>,
      ): InboxListenerSetters<TContextData> => {
        this.#inboxErrorHandler = handler;
        return setters;
      },
      setSharedKeyDispatcher: (
        dispatcher: SharedInboxKeyDispatcher<TContextData>,
      ): InboxListenerSetters<TContextData> => {
        this.#sharedInboxKeyDispatcher = dispatcher;
        return setters;
      },
    };
    return setters;
  }

  /**
   * Sends an activity to recipients' inboxes.  You would typically use
   * {@link Context.sendActivity} instead of this method.
   *
   * @param keys The sender's key pairs.
   * @param recipients The recipients of the activity.
   * @param activity The activity to send.
   * @param options Options for sending the activity.
   * @throws {TypeError} If the activity to send does not have an actor.
   */
  async sendActivity(
    keys: SenderKeyPair[],
    recipients: Recipient | Recipient[],
    activity: Activity,
    { preferSharedInbox, immediate, excludeBaseUris, collectionSync }:
      SendActivityInternalOptions = {},
  ): Promise<void> {
    const logger = getLogger(["fedify", "federation", "outbox"]);
    if (keys.length < 1) {
      throw new TypeError("The sender's keys must not be empty.");
    }
    for (const { privateKey } of keys) {
      validateCryptoKey(privateKey, "private");
    }
    if (activity.actorId == null) {
      logger.error(
        "Activity {activityId} to send does not have an actor.",
        { activity, activityId: activity?.id?.href },
      );
      throw new TypeError(
        "The activity to send must have at least one actor property.",
      );
    }
    this.#startQueue();
    if (activity.id == null) {
      activity = activity.clone({
        id: new URL(`urn:uuid:${crypto.randomUUID()}`),
      });
    }
    const inboxes = extractInboxes({
      recipients: Array.isArray(recipients) ? recipients : [recipients],
      preferSharedInbox,
      excludeBaseUris,
    });
    logger.debug("Sending activity {activityId} to inboxes:\n{inboxes}", {
      inboxes: globalThis.Object.keys(inboxes),
      activityId: activity.id?.href,
      activity,
    });
    if (immediate || this.#queue == null) {
      if (immediate) {
        logger.debug(
          "Sending activity immediately without queue since immediate option " +
            "is set.",
          { activityId: activity.id?.href, activity },
        );
      } else {
        logger.debug(
          "Sending activity immediately without queue since queue is not set.",
          { activityId: activity.id?.href, activity },
        );
      }
      const promises: Promise<void>[] = [];
      for (const inbox in inboxes) {
        promises.push(
          sendActivity({
            keys,
            activity,
            inbox: new URL(inbox),
            contextLoader: this.#contextLoader,
            headers: collectionSync == null ? undefined : new Headers({
              "Collection-Synchronization":
                await buildCollectionSynchronizationHeader(
                  collectionSync,
                  inboxes[inbox],
                ),
            }),
          }),
        );
      }
      await Promise.all(promises);
      return;
    }
    logger.debug(
      "Enqueuing activity {activityId} to send later.",
      { activityId: activity.id?.href, activity },
    );
    const keyJwkPairs: SenderKeyJwkPair[] = [];
    for (const { keyId, privateKey } of keys) {
      const privateKeyJwk = await exportJwk(privateKey);
      keyJwkPairs.push({ keyId: keyId.href, privateKey: privateKeyJwk });
    }
    const activityJson = await activity.toJsonLd({
      contextLoader: this.#contextLoader,
    });
    for (const inbox in inboxes) {
      const message: OutboxMessage = {
        type: "outbox",
        keys: keyJwkPairs,
        activity: activityJson,
        inbox,
        trial: 0,
        headers: collectionSync == null ? {} : {
          "Collection-Synchronization":
            await buildCollectionSynchronizationHeader(
              collectionSync,
              inboxes[inbox],
            ),
        },
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
   * @since 0.6.0
   */
  async fetch(
    request: Request,
    options: FederationFetchOptions<TContextData>,
  ): Promise<Response> {
    const response = await this.#fetch(request, options);
    const logger = getLogger(["fedify", "federation", "http"]);
    const url = new URL(request.url);
    const logTpl = "{method} {path}: {status}";
    const values = {
      method: request.method,
      path: `${url.pathname}${url.search}`,
      url: request.url,
      status: response.status,
    };
    if (response.status >= 500) logger.error(logTpl, values);
    else if (response.status >= 400) logger.warn(logTpl, values);
    else logger.info(logTpl, values);
    return response;
  }

  async #fetch(
    request: Request,
    {
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
      contextData,
    }: FederationFetchOptions<TContextData>,
  ): Promise<Response> {
    onNotFound ??= notFound;
    onNotAcceptable ??= notAcceptable;
    onUnauthorized ??= unauthorized;
    const url = new URL(request.url);
    const route = this.#router.route(url.pathname);
    if (route == null) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
    let context = this.#createContext(request, contextData);
    const routeName = route.name.replace(/:.*$/, "");
    switch (routeName) {
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
        // FIXME: When the deprecated last parameter (key) of ActorDispatcher
        //        is removed, uncomment the following line.
        // context = this.#createContext(request, contextData, {
        //   invokedFromActorDispatcher: { handle: route.values.handle },
        // });
        return await handleActor(request, {
          handle: route.values.handle,
          context,
          actorDispatcher: this.#actorCallbacks?.dispatcher,
          authorizePredicate: this.#actorCallbacks?.authorizePredicate,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      case "object": {
        const typeId = route.name.replace(/^object:/, "");
        const callbacks = this.#objectCallbacks[typeId];
        const cls = this.#objectTypeIds[typeId];
        context = this.#createContext(request, contextData, {
          invokedFromObjectDispatcher: { cls, values: route.values },
        });
        return await handleObject(request, {
          values: route.values,
          context,
          objectDispatcher: callbacks?.dispatcher,
          authorizePredicate: callbacks?.authorizePredicate,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      }
      case "outbox":
        return await handleCollection(request, {
          name: "outbox",
          handle: route.values.handle,
          context,
          collectionCallbacks: this.#outboxCallbacks,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      case "inbox":
        if (request.method !== "POST") {
          return await handleCollection(request, {
            name: "inbox",
            handle: route.values.handle,
            context,
            collectionCallbacks: this.#inboxCallbacks,
            onUnauthorized,
            onNotFound,
            onNotAcceptable,
          });
        }
        context = this.#createContext(request, contextData, {
          documentLoader: await context.getDocumentLoader({
            handle: route.values.handle,
          }),
        });
        // falls through
      case "sharedInbox":
        if (routeName !== "inbox" && this.#sharedInboxKeyDispatcher != null) {
          const identity = await this.#sharedInboxKeyDispatcher(context);
          context = this.#createContext(request, contextData, {
            documentLoader: "handle" in identity
              ? await context.getDocumentLoader(identity)
              : context.getDocumentLoader(identity),
          });
        }
        return await handleInbox(request, {
          handle: route.values.handle ?? null,
          context,
          kv: this.#kv,
          kvPrefix: this.#kvPrefixes.activityIdempotence,
          actorDispatcher: this.#actorCallbacks?.dispatcher,
          inboxListeners: this.#inboxListeners ?? new Map(),
          inboxErrorHandler: this.#inboxErrorHandler,
          onNotFound,
          signatureTimeWindow: this.#signatureTimeWindow,
        });
      case "following":
        return await handleCollection(request, {
          name: "following",
          handle: route.values.handle,
          context,
          collectionCallbacks: this.#followingCallbacks,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      case "followers": {
        let baseUrl = url.searchParams.get("base-url");
        if (baseUrl != null) {
          const u = new URL(baseUrl);
          baseUrl = `${u.origin}/`;
        }
        return await handleCollection(request, {
          name: "followers",
          handle: route.values.handle,
          context,
          filter: baseUrl != null ? new URL(baseUrl) : undefined,
          filterPredicate: baseUrl != null
            ? ((i) =>
              (i instanceof URL ? i.href : i.id?.href ?? "").startsWith(
                baseUrl!,
              ))
            : undefined,
          collectionCallbacks: this.#followersCallbacks,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      }
      default: {
        const response = onNotFound(request);
        return response instanceof Promise ? await response : response;
      }
    }
  }
}

interface ContextOptions<TContextData> {
  url: URL;
  federation: Federation<TContextData>;
  router: Router;
  objectTypeIds: Record<
    string,
    // deno-lint-ignore no-explicit-any
    (new (...args: any[]) => Object) & { typeId: URL }
  >;
  objectCallbacks: Record<string, ObjectCallbacks<TContextData, string>>;
  actorCallbacks?: ActorCallbacks<TContextData>;
  data: TContextData;
  documentLoader: DocumentLoader;
  contextLoader: DocumentLoader;
  authenticatedDocumentLoaderFactory: AuthenticatedDocumentLoaderFactory;
}

class ContextImpl<TContextData> implements Context<TContextData> {
  readonly #url: URL;
  readonly #federation: Federation<TContextData>;
  readonly #router: Router;
  readonly #objectTypeIds: Record<
    string,
    // deno-lint-ignore no-explicit-any
    (new (...args: any[]) => Object) & { typeId: URL }
  >;
  protected readonly objectCallbacks: Record<
    string,
    ObjectCallbacks<TContextData, string>
  >;
  protected readonly actorCallbacks?: ActorCallbacks<TContextData>;
  readonly data: TContextData;
  readonly documentLoader: DocumentLoader;
  readonly contextLoader: DocumentLoader;
  readonly #authenticatedDocumentLoaderFactory:
    AuthenticatedDocumentLoaderFactory;

  constructor(
    {
      url,
      federation,
      router,
      objectTypeIds,
      objectCallbacks,
      actorCallbacks,
      data,
      documentLoader,
      contextLoader,
      authenticatedDocumentLoaderFactory,
    }: ContextOptions<TContextData>,
  ) {
    this.#url = url;
    this.#federation = federation;
    this.#router = router;
    this.#objectTypeIds = objectTypeIds;
    this.objectCallbacks = objectCallbacks;
    this.actorCallbacks = actorCallbacks;
    this.data = data;
    this.documentLoader = documentLoader;
    this.contextLoader = contextLoader;
    this.#authenticatedDocumentLoaderFactory =
      authenticatedDocumentLoaderFactory;
  }

  getNodeInfoUri(): URL {
    const path = this.#router.build("nodeInfo", {});
    if (path == null) {
      throw new RouterError("No NodeInfo dispatcher registered.");
    }
    return new URL(path, this.#url);
  }

  getActorUri(handle: string): URL {
    const path = this.#router.build("actor", { handle });
    if (path == null) {
      throw new RouterError("No actor dispatcher registered.");
    }
    return new URL(path, this.#url);
  }

  getObjectUri<TObject extends Object>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    values: Record<string, string>,
  ): URL {
    const callbacks = this.objectCallbacks[cls.typeId.href];
    if (callbacks == null) {
      throw new RouterError("No object dispatcher registered.");
    }
    for (const param of callbacks.parameters) {
      if (!(param in values)) {
        throw new TypeError(`Missing parameter: ${param}`);
      }
    }
    const path = this.#router.build(`object:${cls.typeId.href}`, values);
    if (path == null) {
      throw new RouterError("No object dispatcher registered.");
    }
    return new URL(path, this.#url);
  }

  getOutboxUri(handle: string): URL {
    const path = this.#router.build("outbox", { handle });
    if (path == null) {
      throw new RouterError("No outbox dispatcher registered.");
    }
    return new URL(path, this.#url);
  }

  getInboxUri(): URL;
  getInboxUri(handle: string): URL;
  getInboxUri(handle?: string): URL {
    if (handle == null) {
      const path = this.#router.build("sharedInbox", {});
      if (path == null) {
        throw new RouterError("No shared inbox path registered.");
      }
      return new URL(path, this.#url);
    }
    const path = this.#router.build("inbox", { handle });
    if (path == null) {
      throw new RouterError("No inbox path registered.");
    }
    return new URL(path, this.#url);
  }

  getFollowingUri(handle: string): URL {
    const path = this.#router.build("following", { handle });
    if (path == null) {
      throw new RouterError("No following collection path registered.");
    }
    return new URL(path, this.#url);
  }

  getFollowersUri(handle: string): URL {
    const path = this.#router.build("followers", { handle });
    if (path == null) {
      throw new RouterError("No followers collection path registered.");
    }
    return new URL(path, this.#url);
  }

  parseUri(uri: URL): ParseUriResult | null {
    if (uri.origin !== this.#url.origin) return null;
    const route = this.#router.route(uri.pathname);
    if (route == null) return null;
    else if (route.name === "actor") {
      return { type: "actor", handle: route.values.handle };
    } else if (route.name.startsWith("object:")) {
      const typeId = route.name.replace(/^object:/, "");
      return {
        type: "object",
        class: this.#objectTypeIds[typeId],
        typeId: new URL(typeId),
        values: route.values,
      };
    } else if (route.name === "inbox") {
      return { type: "inbox", handle: route.values.handle };
    } else if (route.name === "sharedInbox") {
      return { type: "inbox" };
    } else if (route.name === "outbox") {
      return { type: "outbox", handle: route.values.handle };
    } else if (route.name === "following") {
      return { type: "following", handle: route.values.handle };
    } else if (route.name === "followers") {
      return { type: "followers", handle: route.values.handle };
    }
    return null;
  }

  getHandleFromActorUri(actorUri: URL): string | null {
    getLogger(["fedify", "federation"]).warn(
      "Context.getHandleFromActorUri() is deprecated; " +
        "use Context.parseUri() instead.",
    );
    const result = this.parseUri(actorUri);
    if (result?.type === "actor") return result.handle;
    return null;
  }

  async getActorKeyPairs(handle: string): Promise<ActorKeyPair[]> {
    let keyPairs: (CryptoKeyPair & { keyId: URL })[];
    try {
      keyPairs = await this.getKeyPairsFromHandle(
        this.#url,
        this.data,
        handle,
      );
    } catch (_) {
      getLogger(["fedify", "federation", "actor"])
        .warn("No actor key pairs dispatcher registered.");
      return [];
    }
    const owner = this.getActorUri(handle);
    const result = [];
    for (const keyPair of keyPairs) {
      const newPair: ActorKeyPair = {
        ...keyPair,
        cryptographicKey: new CryptographicKey({
          id: keyPair.keyId,
          owner,
          publicKey: keyPair.publicKey,
        }),
        multikey: new Multikey({
          id: keyPair.keyId,
          controller: owner,
          publicKey: keyPair.publicKey,
        }),
      };
      result.push(newPair);
    }
    return result;
  }

  protected async getKeyPairsFromHandle(
    url: URL | string,
    contextData: TContextData,
    handle: string,
  ): Promise<(CryptoKeyPair & { keyId: URL })[]> {
    const logger = getLogger(["fedify", "federation", "actor"]);
    if (this.actorCallbacks?.keyPairsDispatcher == null) {
      throw new Error("No actor key pairs dispatcher registered.");
    }
    const path = this.#router.build("actor", { handle });
    if (path == null) {
      logger.warn("No actor dispatcher registered.");
      return [];
    }
    const actorUri = new URL(path, url);
    const keyPairs = await this.actorCallbacks?.keyPairsDispatcher(
      contextData,
      handle,
    );
    if (keyPairs.length < 1) {
      logger.warn("No key pairs found for actor {handle}.", { handle });
    }
    let i = 0;
    const result = [];
    for (const keyPair of keyPairs) {
      result.push({
        ...keyPair,
        keyId: new URL(
          // For backwards compatibility, the first key is always the #main-key:
          i == 0 ? `#main-key` : `#key-${i + 1}`,
          actorUri,
        ),
      });
      i++;
    }
    return result;
  }

  async getActorKey(handle: string): Promise<CryptographicKey | null> {
    getLogger(["fedify", "federation", "actor"]).warn(
      "Context.getActorKey() method is deprecated; " +
        "use Context.getActorKeyPairs() method instead.",
    );
    let keyPair: CryptoKeyPair & { keyId: URL } | null;
    try {
      keyPair = await this.getRsaKeyPairFromHandle(handle);
    } catch (_) {
      return null;
    }
    if (keyPair == null) return null;
    return new CryptographicKey({
      id: keyPair.keyId,
      owner: this.getActorUri(handle),
      publicKey: keyPair.publicKey,
    });
  }

  protected async getRsaKeyPairFromHandle(
    handle: string,
  ): Promise<CryptoKeyPair & { keyId: URL } | null> {
    const keyPairs = await this.getKeyPairsFromHandle(
      this.#url,
      this.data,
      handle,
    );
    for (const keyPair of keyPairs) {
      const { privateKey } = keyPair;
      if (
        privateKey.algorithm.name === "RSASSA-PKCS1-v1_5" &&
        (privateKey.algorithm as unknown as { hash: { name: string } }).hash
            .name ===
          "SHA-256"
      ) {
        return keyPair;
      }
    }
    getLogger(["fedify", "federation", "actor"]).warn(
      "No RSA-PKCS#1-v1.5 SHA-256 key found for actor {handle}.",
      { handle },
    );
    return null;
  }

  getDocumentLoader(identity: { handle: string }): Promise<DocumentLoader>;
  getDocumentLoader(identity: SenderKeyPair): DocumentLoader;
  getDocumentLoader(
    identity: SenderKeyPair | { handle: string },
  ): DocumentLoader | Promise<DocumentLoader> {
    if ("handle" in identity) {
      const keyPair = this.getRsaKeyPairFromHandle(identity.handle);
      return keyPair.then((pair) =>
        pair == null
          ? this.documentLoader
          : this.#authenticatedDocumentLoaderFactory(pair)
      );
    }
    return this.#authenticatedDocumentLoaderFactory(identity);
  }

  async sendActivity(
    sender: SenderKeyPair | SenderKeyPair[] | { handle: string },
    recipients: Recipient | Recipient[] | "followers",
    activity: Activity,
    options: SendActivityOptions = {},
  ): Promise<void> {
    let keys: SenderKeyPair[];
    if ("handle" in sender) {
      keys = await this.getKeyPairsFromHandle(
        this.#url,
        this.data,
        sender.handle,
      );
      if (keys.length < 1) {
        throw new Error(
          `No key pair found for actor ${JSON.stringify(sender.handle)}.`,
        );
      }
    } else if (Array.isArray(sender)) {
      if (sender.length < 1) {
        throw new Error("The sender's key pairs are empty.");
      }
      keys = sender;
    } else {
      keys = [sender];
    }
    const opts: SendActivityInternalOptions = { ...options };
    let expandedRecipients: Recipient[];
    if (Array.isArray(recipients)) {
      expandedRecipients = recipients;
    } else if (recipients === "followers") {
      if (!("handle" in sender)) {
        throw new Error(
          "If recipients is 'followers', sender must be an actor handle.",
        );
      }
      expandedRecipients = [];
      for await (
        const recipient of this.getFollowers(sender.handle)
      ) {
        expandedRecipients.push(recipient);
      }
      const collectionId = this.#router.build("followers", sender);
      opts.collectionSync = collectionId == null
        ? undefined
        : new URL(collectionId, this.#url).href;
    } else {
      expandedRecipients = [recipients];
    }
    return await this.#federation.sendActivity(
      keys,
      expandedRecipients,
      activity,
      opts,
    );
  }

  protected getFollowers(_handle: string): AsyncIterable<Recipient> {
    throw new Error(
      '"followers" recipients are not supported in Context.  ' +
        "Use RequestContext instead.",
    );
  }
}

interface RequestContextOptions<TContextData>
  extends ContextOptions<TContextData> {
  request: Request;
  signatureTimeWindow?: Temporal.DurationLike;
  followersCallbacks?: CollectionCallbacks<Recipient, TContextData, URL>;
  invokedFromActorDispatcher?: { handle: string };
  invokedFromObjectDispatcher?: {
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => Object) & { typeId: URL };
    values: Record<string, string>;
  };
}

class RequestContextImpl<TContextData> extends ContextImpl<TContextData>
  implements RequestContext<TContextData> {
  readonly #options: RequestContextOptions<TContextData>;
  readonly #followersCallbacks?: CollectionCallbacks<
    Recipient,
    TContextData,
    URL
  >;
  readonly #signatureTimeWindow?: Temporal.DurationLike;
  readonly #invokedFromActorDispatcher?: { handle: string };
  readonly #invokedFromObjectDispatcher?: {
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => Object) & { typeId: URL };
    values: Record<string, string>;
  };
  readonly request: Request;
  readonly url: URL;

  constructor(options: RequestContextOptions<TContextData>) {
    super(options);
    this.#options = options;
    this.#followersCallbacks = options.followersCallbacks;
    this.#signatureTimeWindow = options.signatureTimeWindow;
    this.#invokedFromActorDispatcher = options.invokedFromActorDispatcher;
    this.#invokedFromObjectDispatcher = options.invokedFromObjectDispatcher;
    this.request = options.request;
    this.url = options.url;
  }

  protected async *getFollowers(handle: string): AsyncIterable<Recipient> {
    if (this.#followersCallbacks == null) {
      throw new Error("No followers collection dispatcher registered.");
    }
    const result = await this.#followersCallbacks.dispatcher(
      this,
      handle,
      null,
    );
    if (result != null) {
      for (const recipient of result.items) yield recipient;
      return;
    }
    if (this.#followersCallbacks.firstCursor == null) {
      throw new Error(
        "No first cursor dispatcher registered for followers collection.",
      );
    }
    let cursor = await this.#followersCallbacks.firstCursor(this, handle);
    while (cursor != null) {
      const result = await this.#followersCallbacks.dispatcher(
        this,
        handle,
        cursor,
      );
      if (result == null) break;
      for (const recipient of result.items) yield recipient;
      cursor = result.nextCursor ?? null;
    }
  }

  async getActor(handle: string): Promise<Actor | null> {
    if (
      this.actorCallbacks == null ||
      this.actorCallbacks.dispatcher == null
    ) {
      throw new Error("No actor dispatcher registered.");
    }
    if (this.#invokedFromActorDispatcher != null) {
      getLogger(["fedify", "federation"]).warn(
        "RequestContext.getActor({getActorHandle}) is invoked from " +
          "the actor dispatcher ({actorDispatcherHandle}); " +
          "this may cause an infinite loop.",
        {
          getActorHandle: handle,
          actorDispatcherHandle: this.#invokedFromActorDispatcher.handle,
        },
      );
    }
    let rsaKey: CryptoKeyPair & { keyId: URL } | null;
    try {
      rsaKey = await this.getRsaKeyPairFromHandle(handle);
    } catch (_) {
      rsaKey = null;
    }
    return await this.actorCallbacks.dispatcher(
      new RequestContextImpl({
        ...this.#options,
        invokedFromActorDispatcher: { handle },
      }),
      handle,
      rsaKey == null ? null : new CryptographicKey({
        id: rsaKey.keyId,
        owner: this.getActorUri(handle),
        publicKey: rsaKey.publicKey,
      }),
    );
  }

  async getObject<TObject extends Object>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    values: Record<string, string>,
  ): Promise<TObject | null> {
    const callbacks = this.objectCallbacks[cls.typeId.href];
    if (callbacks == null) {
      throw new Error("No object dispatcher registered.");
    }
    for (const param of callbacks.parameters) {
      if (!(param in values)) {
        throw new TypeError(`Missing parameter: ${param}`);
      }
    }
    if (this.#invokedFromObjectDispatcher != null) {
      getLogger(["fedify", "federation"]).warn(
        "RequestContext.getObject({getObjectClass}, " +
          "{getObjectValues}) is invoked from the object dispatcher " +
          "({actorDispatcherClass}, {actorDispatcherValues}); " +
          "this may cause an infinite loop.",
        {
          getObjectClass: cls.name,
          getObjectValues: values,
          actorDispatcherClass: this.#invokedFromObjectDispatcher.cls.name,
          actorDispatcherValues: this.#invokedFromObjectDispatcher.values,
        },
      );
    }
    return await callbacks.dispatcher(
      new RequestContextImpl({
        ...this.#options,
        invokedFromObjectDispatcher: { cls, values },
      }),
      values,
      // deno-lint-ignore no-explicit-any
    ) as any;
  }

  #signedKey: CryptographicKey | null | undefined = undefined;

  async getSignedKey(): Promise<CryptographicKey | null> {
    if (this.#signedKey !== undefined) return this.#signedKey;
    return this.#signedKey = await verifyRequest(this.request, {
      ...this,
      timeWindow: this.#signatureTimeWindow,
    });
  }

  #signedKeyOwner: Actor | null | undefined = undefined;

  async getSignedKeyOwner(): Promise<Actor | null> {
    if (this.#signedKeyOwner !== undefined) return this.#signedKeyOwner;
    const key = await this.getSignedKey();
    if (key == null) return this.#signedKeyOwner = null;
    return this.#signedKeyOwner = await getKeyOwner(key, this);
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

  /**
   * A callback to handle a request when the request is unauthorized.
   * If not provided, a 401 response is returned.
   * @param request The request object.
   * @returns The response to the request.
   * @since 0.7.0
   */
  onUnauthorized?: (request: Request) => Response | Promise<Response>;
}

interface ActorCallbacks<TContextData> {
  dispatcher?: ActorDispatcher<TContextData>;
  keyPairsDispatcher?: ActorKeyPairsDispatcher<TContextData>;
  authorizePredicate?: AuthorizePredicate<TContextData>;
}

/**
 * Additional settings for the actor dispatcher.
 *
 * ``` typescript
 * const federation = createFederation<void>({ ... });
 * federation.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
 *   ...
 * })
 *   .setKeyPairsDispatcher(async (ctxData, handle) => {
 *     ...
 *   });
 * ```
 */
export interface ActorCallbackSetters<TContextData> {
  /**
   * Sets the key pairs dispatcher for actors.
   * @param dispatcher A callback that returns the key pairs for an actor.
   * @returns The setters object so that settings can be chained.
   * @since 0.10.0
   */
  setKeyPairsDispatcher(
    dispatcher: ActorKeyPairsDispatcher<TContextData>,
  ): ActorCallbackSetters<TContextData>;

  /**
   * Sets the RSA-PKCS#1-v1.5 key pair dispatcher for actors.
   *
   * Use {@link ActorCallbackSetters.setKeyPairsDispatcher} instead.
   * @param dispatcher A callback that returns the key pair for an actor.
   * @returns The setters object so that settings can be chained.
   * @deprecated
   */
  setKeyPairDispatcher(
    dispatcher: ActorKeyPairDispatcher<TContextData>,
  ): ActorCallbackSetters<TContextData>;

  /**
   * Specifies the conditions under which requests are authorized.
   * @param predicate A callback that returns whether a request is authorized.
   * @returns The setters object so that settings can be chained.
   * @since 0.7.0
   */
  authorize(
    predicate: AuthorizePredicate<TContextData>,
  ): ActorCallbackSetters<TContextData>;
}

interface ObjectCallbacks<TContextData, TParam extends string> {
  dispatcher: ObjectDispatcher<TContextData, Object, string>;
  parameters: Set<TParam>;
  authorizePredicate?: ObjectAuthorizePredicate<TContextData, TParam>;
}

/**
 * Additional settings for an object dispatcher.
 */
export interface ObjectCallbackSetters<
  TContextData,
  TObject extends Object,
  TParam extends string,
> {
  /**
   * Specifies the conditions under which requests are authorized.
   * @param predicate A callback that returns whether a request is authorized.
   * @returns The setters object so that settings can be chained.
   * @since 0.7.0
   */
  authorize(
    predicate: ObjectAuthorizePredicate<TContextData, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;
}

/**
 * Additional settings for a collection dispatcher.
 *
 * @typeParam TContextData The context data to pass to the {@link Context}.
 * @typeParam TFilter The type of filter for the collection.
 */
export interface CollectionCallbackSetters<TContextData, TFilter> {
  /**
   * Sets the counter for the collection.
   * @param counter A callback that returns the number of items in the collection.
   * @returns The setters object so that settings can be chained.
   */
  setCounter(
    counter: CollectionCounter<TContextData, TFilter>,
  ): CollectionCallbackSetters<TContextData, TFilter>;

  /**
   * Sets the first cursor for the collection.
   * @param cursor The cursor for the first item in the collection.
   * @returns The setters object so that settings can be chained.
   */
  setFirstCursor(
    cursor: CollectionCursor<TContextData, TFilter>,
  ): CollectionCallbackSetters<TContextData, TFilter>;

  /**
   * Sets the last cursor for the collection.
   * @param cursor The cursor for the last item in the collection.
   * @returns The setters object so that settings can be chained.
   */
  setLastCursor(
    cursor: CollectionCursor<TContextData, TFilter>,
  ): CollectionCallbackSetters<TContextData, TFilter>;

  /**
   * Specifies the conditions under which requests are authorized.
   * @param predicate A callback that returns whether a request is authorized.
   * @returns The setters object so that settings can be chained.
   * @since 0.7.0
   */
  authorize(
    predicate: AuthorizePredicate<TContextData>,
  ): CollectionCallbackSetters<TContextData, TFilter>;
}

/**
 * Registry for inbox listeners for different activity types.
 */
export interface InboxListenerSetters<TContextData> {
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
  ): InboxListenerSetters<TContextData>;

  /**
   * Registers an error handler for inbox listeners.  Any exceptions thrown
   * from the listeners are caught and passed to this handler.
   *
   * @param handler A callback to handle an error.
   * @returns The setters object so that settings can be chained.
   */
  onError(
    handler: InboxErrorHandler<TContextData>,
  ): InboxListenerSetters<TContextData>;

  /**
   * Configures a callback to dispatch the key pair for the authenticated
   * document loader of the {@link Context} passed to the shared inbox listener.
   *
   * @param dispatcher A callback to dispatch the key pair for the authenticated
   *                   document loader.
   * @returns The setters object so that settings can be chained.
   * @since 0.11.0
   */
  setSharedKeyDispatcher(
    dispatcher: SharedInboxKeyDispatcher<TContextData>,
  ): InboxListenerSetters<TContextData>;
}

interface SendActivityInternalOptions extends SendActivityOptions {
  collectionSync?: string;
}

function notFound(_request: Request): Response {
  return new Response("Not Found", { status: 404 });
}

function notAcceptable(_request: Request): Response {
  return new Response("Not Acceptable", {
    status: 406,
    headers: {
      Vary: "Accept, Signature",
    },
  });
}

function unauthorized(_request: Request): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      Vary: "Accept, Signature",
    },
  });
}
