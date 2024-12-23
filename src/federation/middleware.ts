import { verifyObject } from "@fedify/fedify";
import { getLogger, withContext } from "@logtape/logtape";
import {
  context,
  propagation,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
  type Tracer,
  type TracerProvider,
} from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
} from "@opentelemetry/semantic-conventions";
import metadata from "../deno.json" with { type: "json" };
import { handleNodeInfo, handleNodeInfoJrd } from "../nodeinfo/handler.ts";
import {
  type AuthenticatedDocumentLoaderFactory,
  type DocumentLoader,
  getAuthenticatedDocumentLoader,
  getDocumentLoader,
  type GetUserAgentOptions,
  kvCache,
} from "../runtime/docloader.ts";
import { verifyRequest } from "../sig/http.ts";
import { exportJwk, importJwk, validateCryptoKey } from "../sig/key.ts";
import { hasSignature, signJsonLd } from "../sig/ld.ts";
import { getKeyOwner } from "../sig/owner.ts";
import { signObject } from "../sig/proof.ts";
import type { Actor, Recipient } from "../vocab/actor.ts";
import {
  lookupObject,
  type LookupObjectOptions,
  traverseCollection,
  type TraverseCollectionOptions,
} from "../vocab/lookup.ts";
import { getTypeId } from "../vocab/type.ts";
import {
  Activity,
  type Collection,
  CryptographicKey,
  type Hashtag,
  type Like,
  type Link,
  Multikey,
  type Object,
} from "../vocab/vocab.ts";
import { handleWebFinger } from "../webfinger/handler.ts";
import type {
  ActorAliasMapper,
  ActorDispatcher,
  ActorHandleMapper,
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
  ForwardActivityOptions,
  InboxContext,
  ParseUriResult,
  RequestContext,
  RouteActivityOptions,
  SendActivityOptions,
} from "./context.ts";
import type {
  ActorCallbackSetters,
  CollectionCallbackSetters,
  Federation,
  FederationFetchOptions,
  FederationStartQueueOptions,
  InboxListenerSetters,
  ObjectCallbackSetters,
} from "./federation.ts";
import {
  type CollectionCallbacks,
  handleActor,
  handleCollection,
  handleInbox,
  handleObject,
} from "./handler.ts";
import { InboxListenerSet, routeActivity } from "./inbox.ts";
import { KvKeyCache } from "./keycache.ts";
import type { KvKey, KvStore } from "./kv.ts";
import type { MessageQueue } from "./mq.ts";
import type {
  InboxMessage,
  Message,
  OutboxMessage,
  SenderKeyJwkPair,
} from "./queue.ts";
import { createExponentialBackoffPolicy, type RetryPolicy } from "./retry.ts";
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
   * The message queue for sending and receiving activities.  If not provided,
   * activities will not be queued and will be processed immediately.
   *
   * If a `MessageQueue` is provided, both the `inbox` and `outbox` queues
   * will be set to the same queue.
   *
   * If a `FederationQueueOptions` object is provided, you can set the queues
   * separately (since Fedify 1.3.0).
   */
  queue?: FederationQueueOptions | MessageQueue;

  /**
   * Whether to start the task queue manually or automatically.
   *
   * If `true`, the task queue will not start automatically and you need to
   * manually start it by calling the {@link Federation.startQueue} method.
   *
   * If `false`, the task queue will start automatically as soon as
   * the first task is enqueued.
   *
   * By default, the queue starts automatically.
   *
   * @since 0.12.0
   */
  manuallyStartQueue?: boolean;

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
   * Whether to allow fetching private network addresses in the document loader.
   *
   * If turned on, {@link CreateFederationOptions.documentLoader},
   * {@link CreateFederationOptions.contextLoader}, and
   * {@link CreateFederationOptions.authenticatedDocumentLoaderFactory}
   * cannot be configured.
   *
   * Mostly useful for testing purposes.  *Do not use in production.*
   *
   * Turned off by default.
   */
  allowPrivateAddress?: boolean;

  /**
   * Options for making `User-Agent` strings for HTTP requests.
   * If a string is provided, it is used as the `User-Agent` header.
   * If an object is provided, it is passed to the {@link getUserAgent}
   * function.
   */
  userAgent?: GetUserAgentOptions | string;

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
   * The time window for verifying HTTP Signatures of incoming requests.  If the
   * request is older or newer than this window, it is rejected.  Or if it is
   * `false`, the request's timestamp is not checked at all.
   *
   * By default, the window is an hour.
   */
  signatureTimeWindow?: Temporal.Duration | Temporal.DurationLike | false;

  /**
   * Whether to skip HTTP Signatures verification for incoming activities.
   * This is useful for testing purposes, but should not be used in production.
   *
   * By default, this is `false` (i.e., signatures are verified).
   * @since 0.13.0
   */
  skipSignatureVerification?: boolean;

  /**
   * The retry policy for sending activities to recipients' inboxes.
   * By default, this uses an exponential backoff strategy with a maximum of
   * 10 attempts and a maximum delay of 12 hours.
   * @since 0.12.0
   */
  outboxRetryPolicy?: RetryPolicy;

  /**
   * The retry policy for processing incoming activities.  By default, this
   * uses an exponential backoff strategy with a maximum of 10 attempts and a
   * maximum delay of 12 hours.
   * @since 0.12.0
   */
  inboxRetryPolicy?: RetryPolicy;

  /**
   * Whether the router should be insensitive to trailing slashes in the URL
   * paths.  For example, if this option is `true`, `/foo` and `/foo/` are
   * treated as the same path.  Turned off by default.
   * @since 0.12.0
   */
  trailingSlashInsensitive?: boolean;

  /**
   * The OpenTelemetry tracer provider for tracing operations.  If not provided,
   * the default global tracer provider is used.
   * @since 1.3.0
   */
  tracerProvider?: TracerProvider;
}

/**
 * Configures the task queues for sending and receiving activities.
 * @since 1.3.0
 */
export interface FederationQueueOptions {
  /**
   * The message queue for incoming activities.  If not provided, incoming
   * activities will not be queued and will be processed immediately.
   */
  inbox?: MessageQueue;

  /**
   * The message queue for outgoing activities.  If not provided, outgoing
   * activities will not be queued and will be sent immediately.
   */
  outbox?: MessageQueue;
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

  /**
   * The key prefix used for caching public keys.
   * `["_fedify", "publicKey"]` by default.
   * @since 0.12.0
   */
  publicKey: KvKey;
}

/**
 * Create a new {@link Federation} instance.
 * @param parameters Parameters for initializing the instance.
 * @returns A new {@link Federation} instance.
 * @since 0.10.0
 */
export function createFederation<TContextData>(
  options: CreateFederationOptions,
): Federation<TContextData> {
  return new FederationImpl<TContextData>(options);
}

export class FederationImpl<TContextData> implements Federation<TContextData> {
  kv: KvStore;
  kvPrefixes: FederationKvPrefixes;
  inboxQueue?: MessageQueue;
  outboxQueue?: MessageQueue;
  inboxQueueStarted: boolean;
  outboxQueueStarted: boolean;
  manuallyStartQueue: boolean;
  router: Router;
  nodeInfoDispatcher?: NodeInfoDispatcher<TContextData>;
  actorCallbacks?: ActorCallbacks<TContextData>;
  objectCallbacks: Record<string, ObjectCallbacks<TContextData, string>>;
  objectTypeIds: Record<
    string,
    // deno-lint-ignore no-explicit-any
    (new (...args: any[]) => Object) & { typeId: URL }
  >;
  inboxPath?: string;
  inboxCallbacks?: CollectionCallbacks<
    Activity,
    RequestContext<TContextData>,
    TContextData,
    void
  >;
  outboxCallbacks?: CollectionCallbacks<
    Activity,
    RequestContext<TContextData>,
    TContextData,
    void
  >;
  followingCallbacks?: CollectionCallbacks<
    Actor | URL,
    RequestContext<TContextData>,
    TContextData,
    void
  >;
  followersCallbacks?: CollectionCallbacks<
    Recipient,
    Context<TContextData>,
    TContextData,
    URL
  >;
  likedCallbacks?: CollectionCallbacks<
    Like,
    RequestContext<TContextData>,
    TContextData,
    void
  >;
  featuredCallbacks?: CollectionCallbacks<
    Object,
    RequestContext<TContextData>,
    TContextData,
    void
  >;
  featuredTagsCallbacks?: CollectionCallbacks<
    Hashtag,
    RequestContext<TContextData>,
    TContextData,
    void
  >;
  inboxListeners?: InboxListenerSet<TContextData>;
  inboxErrorHandler?: InboxErrorHandler<TContextData>;
  sharedInboxKeyDispatcher?: SharedInboxKeyDispatcher<TContextData>;
  documentLoader: DocumentLoader;
  contextLoader: DocumentLoader;
  authenticatedDocumentLoaderFactory: AuthenticatedDocumentLoaderFactory;
  userAgent?: GetUserAgentOptions | string;
  onOutboxError?: OutboxErrorHandler;
  signatureTimeWindow: Temporal.Duration | Temporal.DurationLike | false;
  skipSignatureVerification: boolean;
  outboxRetryPolicy: RetryPolicy;
  inboxRetryPolicy: RetryPolicy;
  tracerProvider: TracerProvider;

  constructor(options: CreateFederationOptions) {
    this.kv = options.kv;
    this.kvPrefixes = {
      ...({
        activityIdempotence: ["_fedify", "activityIdempotence"],
        remoteDocument: ["_fedify", "remoteDocument"],
        publicKey: ["_fedify", "publicKey"],
      } satisfies FederationKvPrefixes),
      ...(options.kvPrefixes ?? {}),
    };
    if (options.queue == null) {
      this.inboxQueue = undefined;
      this.outboxQueue = undefined;
    } else if ("enqueue" in options.queue && "listen" in options.queue) {
      this.inboxQueue = options.queue;
      this.outboxQueue = options.queue;
    } else {
      this.inboxQueue = options.queue.inbox;
      this.outboxQueue = options.queue.outbox;
    }
    this.inboxQueueStarted = false;
    this.outboxQueueStarted = false;
    this.manuallyStartQueue = options.manuallyStartQueue ?? false;
    this.router = new Router({
      trailingSlashInsensitive: options.trailingSlashInsensitive,
    });
    this.router.add("/.well-known/webfinger", "webfinger");
    this.router.add("/.well-known/nodeinfo", "nodeInfoJrd");
    this.objectCallbacks = {};
    this.objectTypeIds = {};
    if (options.allowPrivateAddress || options.userAgent != null) {
      if (options.documentLoader != null) {
        throw new TypeError(
          "Cannot set documentLoader with allowPrivateAddress or " +
            "userAgent options.",
        );
      } else if (options.contextLoader != null) {
        throw new TypeError(
          "Cannot set contextLoader with allowPrivateAddress or " +
            "userAgent options.",
        );
      } else if (options.authenticatedDocumentLoaderFactory != null) {
        throw new TypeError(
          "Cannot set authenticatedDocumentLoaderFactory with " +
            "allowPrivateAddress or userAgent options.",
        );
      }
    }
    const { allowPrivateAddress, userAgent } = options;
    this.documentLoader = options.documentLoader ?? kvCache({
      loader: getDocumentLoader({ allowPrivateAddress, userAgent }),
      kv: options.kv,
      prefix: this.kvPrefixes.remoteDocument,
    });
    this.contextLoader = options.contextLoader ?? this.documentLoader;
    this.authenticatedDocumentLoaderFactory =
      options.authenticatedDocumentLoaderFactory ??
        ((identity) =>
          getAuthenticatedDocumentLoader(identity, {
            allowPrivateAddress,
            userAgent,
          }));
    this.userAgent = userAgent;
    this.onOutboxError = options.onOutboxError;
    this.signatureTimeWindow = options.signatureTimeWindow ?? { hours: 1 };
    this.skipSignatureVerification = options.skipSignatureVerification ?? false;
    this.outboxRetryPolicy = options.outboxRetryPolicy ??
      createExponentialBackoffPolicy();
    this.inboxRetryPolicy = options.inboxRetryPolicy ??
      createExponentialBackoffPolicy();
    this.tracerProvider = options.tracerProvider ?? trace.getTracerProvider();
  }

  #getTracer() {
    return this.tracerProvider.getTracer(metadata.name, metadata.version);
  }

  async #startQueue(
    ctxData: TContextData,
    signal?: AbortSignal,
    queue?: keyof FederationQueueOptions,
  ): Promise<void> {
    if (this.inboxQueue == null && this.outboxQueue == null) return;
    const logger = getLogger(["fedify", "federation", "queue"]);
    const promises: Promise<void>[] = [];
    if (
      this.inboxQueue != null && (queue == null || queue === "inbox") &&
      !this.inboxQueueStarted
    ) {
      logger.debug("Starting an inbox task worker.");
      this.inboxQueueStarted = true;
      promises.push(
        this.inboxQueue.listen(
          (msg) => this.#listenQueue(ctxData, msg),
          { signal },
        ),
      );
    }
    if (
      this.outboxQueue != null &&
      this.outboxQueue !== this.inboxQueue &&
      (queue == null || queue === "outbox") &&
      !this.outboxQueueStarted
    ) {
      logger.debug("Starting an outbox task worker.");
      this.outboxQueueStarted = true;
      promises.push(
        this.outboxQueue.listen(
          (msg) => this.#listenQueue(ctxData, msg),
          { signal },
        ),
      );
    }
    await Promise.all(promises);
  }

  #listenQueue(ctxData: TContextData, message: Message): Promise<void> {
    const tracer = this.#getTracer();
    const extractedContext = propagation.extract(
      context.active(),
      message.traceContext,
    );
    return withContext({ messageId: message.id }, async () => {
      if (message.type === "outbox") {
        await tracer.startActiveSpan(
          "activitypub.outbox",
          {
            kind: SpanKind.CONSUMER,
            attributes: {
              "activitypub.activity.type": message.activityType,
              "activitypub.activity.retries": message.attempt,
            },
          },
          extractedContext,
          async (span) => {
            if (message.activityId != null) {
              span.setAttribute("activitypub.activity.id", message.activityId);
            }
            try {
              await this.#listenOutboxMessage(ctxData, message, span);
            } catch (e) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: String(e),
              });
              throw e;
            } finally {
              span.end();
            }
          },
        );
      } else if (message.type === "inbox") {
        await tracer.startActiveSpan(
          "activitypub.inbox",
          {
            kind: SpanKind.CONSUMER,
            attributes: {
              "activitypub.shared_inbox": message.identifier == null,
            },
          },
          extractedContext,
          async (span) => {
            try {
              await this.#listenInboxMessage(ctxData, message, span);
            } catch (e) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: String(e),
              });
              throw e;
            } finally {
              span.end();
            }
          },
        );
      }
    });
  }

  async #listenOutboxMessage(
    _: TContextData,
    message: OutboxMessage,
    span: Span,
  ): Promise<void> {
    const logger = getLogger(["fedify", "federation", "outbox"]);
    const logData = {
      keyIds: message.keys.map((pair) => pair.keyId),
      inbox: message.inbox,
      activity: message.activity,
      activityId: message.activityId,
      attempt: message.attempt,
      headers: message.headers,
    };
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
    try {
      await sendActivity({
        keys,
        activity: message.activity,
        activityId: message.activityId,
        activityType: message.activityType,
        inbox: new URL(message.inbox),
        sharedInbox: message.sharedInbox,
        headers: new Headers(message.headers),
        tracerProvider: this.tracerProvider,
      });
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      const activity = await Activity.fromJsonLd(message.activity, {
        contextLoader: this.contextLoader,
        documentLoader: rsaKeyPair == null
          ? this.documentLoader
          : this.authenticatedDocumentLoaderFactory(rsaKeyPair),
        tracerProvider: this.tracerProvider,
      });
      try {
        this.onOutboxError?.(error as Error, activity);
      } catch (error) {
        logger.error(
          "An unexpected error occurred in onError handler:\n{error}",
          { ...logData, error },
        );
      }
      const delay = this.outboxRetryPolicy({
        elapsedTime: Temporal.Instant.from(message.started).until(
          Temporal.Now.instant(),
        ),
        attempts: message.attempt,
      });
      if (delay != null) {
        logger.error(
          "Failed to send activity {activityId} to {inbox} (attempt " +
            "#{attempt}); retry...:\n{error}",
          { ...logData, error },
        );
        await this.outboxQueue?.enqueue(
          {
            ...message,
            attempt: message.attempt + 1,
          } satisfies OutboxMessage,
          {
            delay: Temporal.Duration.compare(delay, { seconds: 0 }) < 0
              ? Temporal.Duration.from({ seconds: 0 })
              : delay,
          },
        );
      } else {
        logger.error(
          "Failed to send activity {activityId} to {inbox} after {attempt} " +
            "attempts; giving up:\n{error}",
          { ...logData, error },
        );
      }
      return;
    }
    logger.info(
      "Successfully sent activity {activityId} to {inbox}.",
      { ...logData },
    );
  }

  async #listenInboxMessage(
    ctxData: TContextData,
    message: InboxMessage,
    span: Span,
  ): Promise<void> {
    const logger = getLogger(["fedify", "federation", "inbox"]);
    const baseUrl = new URL(message.baseUrl);
    let context = this.#createContext(baseUrl, ctxData);
    if (message.identifier != null) {
      context = this.#createContext(baseUrl, ctxData, {
        documentLoader: await context.getDocumentLoader({
          identifier: message.identifier,
        }),
      });
    } else if (this.sharedInboxKeyDispatcher != null) {
      const identity = await this.sharedInboxKeyDispatcher(context);
      if (identity != null) {
        context = this.#createContext(baseUrl, ctxData, {
          documentLoader: "identifier" in identity || "username" in identity ||
              "handle" in identity
            ? await context.getDocumentLoader(identity)
            : context.getDocumentLoader(identity),
        });
      }
    }
    const activity = await Activity.fromJsonLd(message.activity, context);
    span.setAttribute("activitypub.activity.type", getTypeId(activity).href);
    if (activity.id != null) {
      span.setAttribute("activitypub.activity.id", activity.id.href);
    }
    const cacheKey = activity.id == null ? null : [
      ...this.kvPrefixes.activityIdempotence,
      context.origin,
      activity.id.href,
    ] satisfies KvKey;
    if (cacheKey != null) {
      const cached = await this.kv.get(cacheKey);
      if (cached === true) {
        logger.debug("Activity {activityId} has already been processed.", {
          activityId: activity.id?.href,
          activity: message.activity,
          recipient: message.identifier,
        });
        return;
      }
    }
    await this.#getTracer().startActiveSpan(
      "activitypub.dispatch_inbox_listener",
      { kind: SpanKind.INTERNAL },
      async (span) => {
        const dispatched = this.inboxListeners?.dispatchWithClass(activity);
        if (dispatched == null) {
          logger.error(
            "Unsupported activity type:\n{activity}",
            {
              activityId: activity.id?.href,
              activity: message.activity,
              recipient: message.identifier,
              trial: message.attempt,
            },
          );
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Unsupported activity type: ${getTypeId(activity).href}`,
          });
          span.end();
          return;
        }
        const { class: cls, listener } = dispatched;
        span.updateName(`activitypub.dispatch_inbox_listener ${cls.name}`);
        try {
          await listener(
            context.toInboxContext(
              message.identifier,
              message.activity,
              activity.id?.href,
              getTypeId(activity).href,
            ),
            activity,
          );
        } catch (error) {
          try {
            await this.inboxErrorHandler?.(context, error as Error);
          } catch (error) {
            logger.error(
              "An unexpected error occurred in inbox error handler:\n{error}",
              {
                error,
                trial: message.attempt,
                activityId: activity.id?.href,
                activity: message.activity,
                recipient: message.identifier,
              },
            );
          }
          const delay = this.inboxRetryPolicy({
            elapsedTime: Temporal.Instant.from(message.started).until(
              Temporal.Now.instant(),
            ),
            attempts: message.attempt,
          });
          if (delay != null) {
            logger.error(
              "Failed to process the incoming activity {activityId} (attempt " +
                "#{attempt}); retry...:\n{error}",
              {
                error,
                attempt: message.attempt,
                activityId: activity.id?.href,
                activity: message.activity,
                recipient: message.identifier,
              },
            );
            await this.inboxQueue?.enqueue(
              {
                ...message,
                attempt: message.attempt + 1,
              } satisfies InboxMessage,
              {
                delay: Temporal.Duration.compare(delay, { seconds: 0 }) < 0
                  ? Temporal.Duration.from({ seconds: 0 })
                  : delay,
              },
            );
          } else {
            logger.error(
              "Failed to process the incoming activity {activityId} after " +
                "{trial} attempts; giving up:\n{error}",
              {
                error,
                activityId: activity.id?.href,
                activity: message.activity,
                recipient: message.identifier,
              },
            );
          }
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String(error),
          });
          span.end();
          return;
        }
        if (cacheKey != null) {
          await this.kv.set(cacheKey, true, {
            ttl: Temporal.Duration.from({ days: 1 }),
          });
        }
        logger.info(
          "Activity {activityId} has been processed.",
          {
            activityId: activity.id?.href,
            activity: message.activity,
            recipient: message.identifier,
          },
        );
        span.end();
      },
    );
  }

  startQueue(
    contextData: TContextData,
    options: FederationStartQueueOptions = {},
  ): Promise<void> {
    return this.#startQueue(contextData, options.signal, options.queue);
  }

  createContext(baseUrl: URL, contextData: TContextData): Context<TContextData>;
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
    opts?: { documentLoader?: DocumentLoader },
  ): ContextImpl<TContextData>;

  #createContext(
    request: Request,
    contextData: TContextData,
    opts?: {
      documentLoader?: DocumentLoader;
      invokedFromActorDispatcher?: { identifier: string };
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
      invokedFromActorDispatcher?: { identifier: string };
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
    const ctxOptions: ContextOptions<TContextData> = {
      url,
      federation: this,
      data: contextData,
      documentLoader: opts.documentLoader ?? this.documentLoader,
    };
    if (request == null) return new ContextImpl(ctxOptions);
    return new RequestContextImpl({
      ...ctxOptions,
      request,
      invokedFromActorDispatcher: opts.invokedFromActorDispatcher,
      invokedFromObjectDispatcher: opts.invokedFromObjectDispatcher,
    });
  }

  setNodeInfoDispatcher(
    path: string,
    dispatcher: NodeInfoDispatcher<TContextData>,
  ) {
    if (this.router.has("nodeInfo")) {
      throw new RouterError("NodeInfo dispatcher already set.");
    }
    const variables = this.router.add(path, "nodeInfo");
    if (variables.size !== 0) {
      throw new RouterError(
        "Path for NodeInfo dispatcher must have no variables.",
      );
    }
    this.nodeInfoDispatcher = dispatcher;
  }

  setActorDispatcher(
    path: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    dispatcher: ActorDispatcher<TContextData>,
  ): ActorCallbackSetters<TContextData> {
    if (this.router.has("actor")) {
      throw new RouterError("Actor dispatcher already set.");
    }
    const variables = this.router.add(path, "actor");
    if (
      variables.size !== 1 ||
      !(variables.has("identifier") || variables.has("handle"))
    ) {
      throw new RouterError(
        "Path for actor dispatcher must have one variable: {identifier}",
      );
    }
    if (variables.has("handle")) {
      getLogger(["fedify", "federation", "actor"]).warn(
        "The {{handle}} variable in the actor dispatcher path is deprecated. " +
          "Use {{identifier}} instead.",
      );
    }
    const callbacks: ActorCallbacks<TContextData> = {
      dispatcher: async (context, identifier) => {
        const actor = await this.#getTracer().startActiveSpan(
          "activitypub.dispatch_actor",
          {
            kind: SpanKind.SERVER,
            attributes: { "fedify.actor.identifier": identifier },
          },
          async (span) => {
            try {
              const actor = await dispatcher(context, identifier);
              span.setAttribute(
                "activitypub.actor.id",
                (actor?.id ?? context.getActorUri(identifier)).href,
              );
              if (actor == null) {
                span.setStatus({ code: SpanStatusCode.ERROR });
              } else {
                span.setAttribute(
                  "activitypub.actor.type",
                  getTypeId(actor).href,
                );
              }
              return actor;
            } catch (error) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: String(error),
              });
              throw error;
            } finally {
              span.end();
            }
          },
        );
        if (actor == null) return null;
        const logger = getLogger(["fedify", "federation", "actor"]);
        if (actor.id == null) {
          logger.warn(
            "Actor dispatcher returned an actor without an id property.  " +
              "Set the property with Context.getActorUri(identifier).",
          );
        } else if (actor.id.href != context.getActorUri(identifier).href) {
          logger.warn(
            "Actor dispatcher returned an actor with an id property that " +
              "does not match the actor URI.  Set the property with " +
              "Context.getActorUri(identifier).",
          );
        }
        if (
          this.followingCallbacks != null &&
          this.followingCallbacks.dispatcher != null
        ) {
          if (actor.followingId == null) {
            logger.warn(
              "You configured a following collection dispatcher, but the " +
                "actor does not have a following property.  Set the property " +
                "with Context.getFollowingUri(identifier).",
            );
          } else if (
            actor.followingId.href != context.getFollowingUri(identifier).href
          ) {
            logger.warn(
              "You configured a following collection dispatcher, but the " +
                "actor's following property does not match the following " +
                "collection URI.  Set the property with " +
                "Context.getFollowingUri(identifier).",
            );
          }
        }
        if (
          this.followersCallbacks != null &&
          this.followersCallbacks.dispatcher != null
        ) {
          if (actor.followersId == null) {
            logger.warn(
              "You configured a followers collection dispatcher, but the " +
                "actor does not have a followers property.  Set the property " +
                "with Context.getFollowersUri(identifier).",
            );
          } else if (
            actor.followersId.href != context.getFollowersUri(identifier).href
          ) {
            logger.warn(
              "You configured a followers collection dispatcher, but the " +
                "actor's followers property does not match the followers " +
                "collection URI.  Set the property with " +
                "Context.getFollowersUri(identifier).",
            );
          }
        }
        if (
          this.outboxCallbacks != null &&
          this.outboxCallbacks.dispatcher != null
        ) {
          if (actor?.outboxId == null) {
            logger.warn(
              "You configured an outbox collection dispatcher, but the " +
                "actor does not have an outbox property.  Set the property " +
                "with Context.getOutboxUri(identifier).",
            );
          } else if (
            actor.outboxId.href != context.getOutboxUri(identifier).href
          ) {
            logger.warn(
              "You configured an outbox collection dispatcher, but the " +
                "actor's outbox property does not match the outbox collection " +
                "URI.  Set the property with Context.getOutboxUri(identifier).",
            );
          }
        }
        if (
          this.likedCallbacks != null &&
          this.likedCallbacks.dispatcher != null
        ) {
          if (actor?.likedId == null) {
            logger.warn(
              "You configured a liked collection dispatcher, but the " +
                "actor does not have a liked property.  Set the property " +
                "with Context.getLikedUri(identifier).",
            );
          } else if (
            actor.likedId.href != context.getLikedUri(identifier).href
          ) {
            logger.warn(
              "You configured a liked collection dispatcher, but the " +
                "actor's liked property does not match the liked collection " +
                "URI.  Set the property with Context.getLikedUri(identifier).",
            );
          }
        }
        if (
          this.featuredCallbacks != null &&
          this.featuredCallbacks.dispatcher != null
        ) {
          if (actor?.featuredId == null) {
            logger.warn(
              "You configured a featured collection dispatcher, but the " +
                "actor does not have a featured property.  Set the property " +
                "with Context.getFeaturedUri(identifier).",
            );
          } else if (
            actor.featuredId.href != context.getFeaturedUri(identifier).href
          ) {
            logger.warn(
              "You configured a featured collection dispatcher, but the " +
                "actor's featured property does not match the featured collection " +
                "URI.  Set the property with Context.getFeaturedUri(identifier).",
            );
          }
        }
        if (
          this.featuredTagsCallbacks != null &&
          this.featuredTagsCallbacks.dispatcher != null
        ) {
          if (actor?.featuredTagsId == null) {
            logger.warn(
              "You configured a featured tags collection dispatcher, but the " +
                "actor does not have a featuredTags property.  Set the property " +
                "with Context.getFeaturedTagsUri(identifier).",
            );
          } else if (
            actor.featuredTagsId.href !=
              context.getFeaturedTagsUri(identifier).href
          ) {
            logger.warn(
              "You configured a featured tags collection dispatcher, but the " +
                "actor's featuredTags property does not match the featured tags " +
                "collection URI.  Set the property with " +
                "Context.getFeaturedTagsUri(identifier).",
            );
          }
        }
        if (this.router.has("inbox")) {
          if (actor.inboxId == null) {
            logger.warn(
              "You configured inbox listeners, but the actor does not " +
                "have an inbox property.  Set the property with " +
                "Context.getInboxUri(identifier).",
            );
          } else if (
            actor.inboxId.href != context.getInboxUri(identifier).href
          ) {
            logger.warn(
              "You configured inbox listeners, but the actor's inbox " +
                "property does not match the inbox URI.  Set the property " +
                "with Context.getInboxUri(identifier).",
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
                "Context.getActorKeyPairs(identifier).",
            );
          }
          if (actor.assertionMethodId == null) {
            logger.warn(
              "You configured a key pairs dispatcher, but the actor does " +
                "not have an assertionMethod property.  Set the property " +
                "with Context.getActorKeyPairs(identifier).",
            );
          }
        }
        return actor;
      },
    };
    this.actorCallbacks = callbacks;
    const setters: ActorCallbackSetters<TContextData> = {
      setKeyPairsDispatcher: (
        dispatcher: ActorKeyPairsDispatcher<TContextData>,
      ) => {
        callbacks.keyPairsDispatcher = (ctx, identifier) =>
          this.#getTracer().startActiveSpan(
            "activitypub.dispatch_actor_key_pairs",
            {
              kind: SpanKind.SERVER,
              attributes: {
                "activitypub.actor.id": ctx.getActorUri(identifier).href,
                "fedify.actor.identifier": identifier,
              },
            },
            async (span) => {
              try {
                return await dispatcher(ctx, identifier);
              } catch (e) {
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: String(e),
                });
                throw e;
              } finally {
                span.end();
              }
            },
          );
        return setters;
      },
      mapHandle(mapper: ActorHandleMapper<TContextData>) {
        callbacks.handleMapper = mapper;
        return setters;
      },
      mapAlias(mapper: ActorAliasMapper<TContextData>) {
        callbacks.aliasMapper = mapper;
        return setters;
      },
      authorize(predicate: AuthorizePredicate<TContextData>) {
        callbacks.authorizePredicate = predicate;
        return setters;
      },
    };
    return setters;
  }

  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path:
      `${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path:
      `${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path:
      `${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path:
      `${string}{${TParam}}${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;
  setObjectDispatcher<TObject extends Object, TParam extends string>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    path: `${string}{${TParam}}${string}{${TParam}}${string}`,
    dispatcher: ObjectDispatcher<TContextData, TObject, TParam>,
  ): ObjectCallbackSetters<TContextData, TObject, TParam>;
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
    if (this.router.has(routeName)) {
      throw new RouterError(`Object dispatcher for ${cls.name} already set.`);
    }
    const variables = this.router.add(path, routeName);
    if (variables.size < 1) {
      throw new RouterError(
        "Path for object dispatcher must have at least one variable.",
      );
    }
    const callbacks: ObjectCallbacks<TContextData, TParam> = {
      dispatcher: (ctx, values) => {
        const tracer = this.#getTracer();
        return tracer.startActiveSpan(
          "activitypub.dispatch_object",
          {
            kind: SpanKind.SERVER,
            attributes: {
              "fedify.object.type": cls.typeId.href,
              ...globalThis.Object.fromEntries(
                globalThis.Object.entries(values).map(([k, v]) => [
                  `fedify.object.values.${k}`,
                  v,
                ]),
              ),
            },
          },
          async (span) => {
            try {
              const object = await dispatcher(ctx, values);
              span.setAttribute(
                "activitypub.object.id",
                (object?.id ?? ctx.getObjectUri(cls, values)).href,
              );
              if (object == null) {
                span.setStatus({ code: SpanStatusCode.ERROR });
              } else {
                span.setAttribute(
                  "activitypub.object.type",
                  getTypeId(object).href,
                );
              }
              return object;
            } catch (e) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: String(e),
              });
              throw e;
            } finally {
              span.end();
            }
          },
        );
      },
      parameters: variables as unknown as Set<TParam>,
    };
    this.objectCallbacks[cls.typeId.href] = callbacks;
    this.objectTypeIds[cls.typeId.href] = cls;
    const setters: ObjectCallbackSetters<TContextData, TObject, TParam> = {
      authorize(predicate: ObjectAuthorizePredicate<TContextData, TParam>) {
        callbacks.authorizePredicate = predicate;
        return setters;
      },
    };
    return setters;
  }

  setInboxDispatcher(
    path: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<
      Activity,
      RequestContext<TContextData>,
      TContextData,
      void
    >,
  ): CollectionCallbackSetters<
    RequestContext<TContextData>,
    TContextData,
    void
  > {
    if (this.inboxCallbacks != null) {
      throw new RouterError("Inbox dispatcher already set.");
    }
    if (this.router.has("inbox")) {
      if (this.inboxPath !== path) {
        throw new RouterError(
          "Inbox dispatcher path must match inbox listener path.",
        );
      }
    } else {
      const variables = this.router.add(path, "inbox");
      if (
        variables.size !== 1 ||
        !(variables.has("identifier") || variables.has("handle"))
      ) {
        throw new RouterError(
          "Path for inbox dispatcher must have one variable: {identifier}",
        );
      }
      if (variables.has("handle")) {
        getLogger(["fedify", "federation", "inbox"]).warn(
          "The {{handle}} variable in the inbox dispatcher path is deprecated. " +
            "Use {{identifier}} instead.",
        );
      }
      this.inboxPath = path;
    }
    const callbacks: CollectionCallbacks<
      Activity,
      RequestContext<TContextData>,
      TContextData,
      void
    > = { dispatcher };
    this.inboxCallbacks = callbacks;
    const setters: CollectionCallbackSetters<
      RequestContext<TContextData>,
      TContextData,
      void
    > = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
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

  setOutboxDispatcher(
    path: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<
      Activity,
      RequestContext<TContextData>,
      TContextData,
      void
    >,
  ): CollectionCallbackSetters<
    RequestContext<TContextData>,
    TContextData,
    void
  > {
    if (this.router.has("outbox")) {
      throw new RouterError("Outbox dispatcher already set.");
    }
    const variables = this.router.add(path, "outbox");
    if (
      variables.size !== 1 ||
      !(variables.has("identifier") || variables.has("handle"))
    ) {
      throw new RouterError(
        "Path for outbox dispatcher must have one variable: {identifier}",
      );
    }
    if (variables.has("handle")) {
      getLogger(["fedify", "federation", "outbox"]).warn(
        "The {{handle}} variable in the outbox dispatcher path is deprecated. " +
          "Use {{identifier}} instead.",
      );
    }
    const callbacks: CollectionCallbacks<
      Activity,
      RequestContext<TContextData>,
      TContextData,
      void
    > = { dispatcher };
    this.outboxCallbacks = callbacks;
    const setters: CollectionCallbackSetters<
      RequestContext<TContextData>,
      TContextData,
      void
    > = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
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

  setFollowingDispatcher(
    path: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<
      Actor | URL,
      RequestContext<TContextData>,
      TContextData,
      void
    >,
  ): CollectionCallbackSetters<
    RequestContext<TContextData>,
    TContextData,
    void
  > {
    if (this.router.has("following")) {
      throw new RouterError("Following collection dispatcher already set.");
    }
    const variables = this.router.add(path, "following");
    if (
      variables.size !== 1 ||
      !(variables.has("identifier") || variables.has("handle"))
    ) {
      throw new RouterError(
        "Path for following collection dispatcher must have one variable: " +
          "{identifier}",
      );
    }
    if (variables.has("handle")) {
      getLogger(["fedify", "federation", "collection"]).warn(
        "The {{handle}} variable in the following collection dispatcher path " +
          "is deprecated. Use {{identifier}} instead.",
      );
    }
    const callbacks: CollectionCallbacks<
      Actor | URL,
      RequestContext<TContextData>,
      TContextData,
      void
    > = { dispatcher };
    this.followingCallbacks = callbacks;
    const setters: CollectionCallbackSetters<
      RequestContext<TContextData>,
      TContextData,
      void
    > = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
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

  setFollowersDispatcher(
    path: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<
      Recipient,
      Context<TContextData>,
      TContextData,
      URL
    >,
  ): CollectionCallbackSetters<Context<TContextData>, TContextData, URL> {
    if (this.router.has("followers")) {
      throw new RouterError("Followers collection dispatcher already set.");
    }
    const variables = this.router.add(path, "followers");
    if (
      variables.size !== 1 ||
      !(variables.has("identifier") || variables.has("handle"))
    ) {
      throw new RouterError(
        "Path for followers collection dispatcher must have one variable: " +
          "{identifier}",
      );
    }
    if (variables.has("handle")) {
      getLogger(["fedify", "federation", "collection"]).warn(
        "The {{handle}} variable in the followers collection dispatcher path " +
          "is deprecated. Use {{identifier}} instead.",
      );
    }
    const callbacks: CollectionCallbacks<
      Recipient,
      Context<TContextData>,
      TContextData,
      URL
    > = { dispatcher };
    this.followersCallbacks = callbacks;
    const setters: CollectionCallbackSetters<
      Context<TContextData>,
      TContextData,
      URL
    > = {
      setCounter(counter: CollectionCounter<TContextData, URL>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(
        cursor: CollectionCursor<Context<TContextData>, TContextData, URL>,
      ) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(
        cursor: CollectionCursor<Context<TContextData>, TContextData, URL>,
      ) {
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

  setLikedDispatcher(
    path: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<
      Like,
      RequestContext<TContextData>,
      TContextData,
      void
    >,
  ): CollectionCallbackSetters<
    RequestContext<TContextData>,
    TContextData,
    void
  > {
    if (this.router.has("liked")) {
      throw new RouterError("Liked collection dispatcher already set.");
    }
    const variables = this.router.add(path, "liked");
    if (
      variables.size !== 1 ||
      !(variables.has("identifier") || variables.has("handle"))
    ) {
      throw new RouterError(
        "Path for liked collection dispatcher must have one variable: " +
          "{identifier}",
      );
    }
    if (variables.has("handle")) {
      getLogger(["fedify", "federation", "collection"]).warn(
        "The {{handle}} variable in the liked collection dispatcher path " +
          "is deprecated. Use {{identifier}} instead.",
      );
    }
    const callbacks: CollectionCallbacks<
      Like,
      RequestContext<TContextData>,
      TContextData,
      void
    > = { dispatcher };
    this.likedCallbacks = callbacks;
    const setters: CollectionCallbackSetters<
      RequestContext<TContextData>,
      TContextData,
      void
    > = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
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

  setFeaturedDispatcher(
    path: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<
      Object,
      RequestContext<TContextData>,
      TContextData,
      void
    >,
  ): CollectionCallbackSetters<
    RequestContext<TContextData>,
    TContextData,
    void
  > {
    if (this.router.has("featured")) {
      throw new RouterError("Featured collection dispatcher already set.");
    }
    const variables = this.router.add(path, "featured");
    if (
      variables.size !== 1 ||
      !(variables.has("identifier") || variables.has("handle"))
    ) {
      throw new RouterError(
        "Path for featured collection dispatcher must have one variable: " +
          "{identifier}",
      );
    }
    if (variables.has("handle")) {
      getLogger(["fedify", "federation", "collection"]).warn(
        "The {{handle}} variable in the featured collection dispatcher path " +
          "is deprecated. Use {{identifier}} instead.",
      );
    }
    const callbacks: CollectionCallbacks<
      Object,
      RequestContext<TContextData>,
      TContextData,
      void
    > = { dispatcher };
    this.featuredCallbacks = callbacks;
    const setters: CollectionCallbackSetters<
      RequestContext<TContextData>,
      TContextData,
      void
    > = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
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

  setFeaturedTagsDispatcher(
    path: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    dispatcher: CollectionDispatcher<
      Hashtag,
      RequestContext<TContextData>,
      TContextData,
      void
    >,
  ): CollectionCallbackSetters<
    RequestContext<TContextData>,
    TContextData,
    void
  > {
    if (this.router.has("featuredTags")) {
      throw new RouterError("Featured tags collection dispatcher already set.");
    }
    const variables = this.router.add(path, "featuredTags");
    if (
      variables.size !== 1 ||
      !(variables.has("identifier") || variables.has("handle"))
    ) {
      throw new RouterError(
        "Path for featured tags collection dispatcher must have one " +
          "variable: {identifier}",
      );
    }
    if (variables.has("handle")) {
      getLogger(["fedify", "federation", "collection"]).warn(
        "The {{handle}} variable in the featured tags collection dispatcher " +
          "path is deprecated. Use {{identifier}} instead.",
      );
    }
    const callbacks: CollectionCallbacks<
      Hashtag,
      RequestContext<TContextData>,
      TContextData,
      void
    > = { dispatcher };
    this.featuredTagsCallbacks = callbacks;
    const setters: CollectionCallbackSetters<
      RequestContext<TContextData>,
      TContextData,
      void
    > = {
      setCounter(counter: CollectionCounter<TContextData, void>) {
        callbacks.counter = counter;
        return setters;
      },
      setFirstCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
        callbacks.firstCursor = cursor;
        return setters;
      },
      setLastCursor(
        cursor: CollectionCursor<
          RequestContext<TContextData>,
          TContextData,
          void
        >,
      ) {
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

  setInboxListeners(
    inboxPath: `${string}{identifier}${string}` | `${string}{handle}${string}`,
    sharedInboxPath?: string,
  ): InboxListenerSetters<TContextData> {
    if (this.inboxListeners != null) {
      throw new RouterError("Inbox listeners already set.");
    }
    if (this.router.has("inbox")) {
      if (this.inboxPath !== inboxPath) {
        throw new RouterError(
          "Inbox listener path must match inbox dispatcher path.",
        );
      }
    } else {
      const variables = this.router.add(inboxPath, "inbox");
      if (
        variables.size !== 1 ||
        !(variables.has("identifier") || variables.has("handle"))
      ) {
        throw new RouterError(
          "Path for inbox must have one variable: {identifier}",
        );
      }
      this.inboxPath = inboxPath;
      if (variables.has("handle")) {
        getLogger(["fedify", "federation", "inbox"]).warn(
          "The {{handle}} variable in the inbox path is deprecated. " +
            "Use {{identifier}} instead.",
        );
      }
    }
    if (sharedInboxPath != null) {
      const siVars = this.router.add(sharedInboxPath, "sharedInbox");
      if (siVars.size !== 0) {
        throw new RouterError(
          "Path for shared inbox must have no variables.",
        );
      }
    }
    const listeners = this.inboxListeners = new InboxListenerSet();
    const setters: InboxListenerSetters<TContextData> = {
      on<TActivity extends Activity>(
        // deno-lint-ignore no-explicit-any
        type: new (...args: any[]) => TActivity,
        listener: InboxListener<TContextData, TActivity>,
      ): InboxListenerSetters<TContextData> {
        listeners.add(type, listener as InboxListener<TContextData, Activity>);
        return setters;
      },
      onError: (
        handler: InboxErrorHandler<TContextData>,
      ): InboxListenerSetters<TContextData> => {
        this.inboxErrorHandler = handler;
        return setters;
      },
      setSharedKeyDispatcher: (
        dispatcher: SharedInboxKeyDispatcher<TContextData>,
      ): InboxListenerSetters<TContextData> => {
        this.sharedInboxKeyDispatcher = dispatcher;
        return setters;
      },
    };
    return setters;
  }

  async sendActivity(
    keys: SenderKeyPair[],
    recipients: Recipient | Recipient[],
    activity: Activity,
    options: SendActivityInternalOptions<TContextData>,
    span?: Span,
  ): Promise<void> {
    const logger = getLogger(["fedify", "federation", "outbox"]);
    const {
      preferSharedInbox,
      immediate,
      excludeBaseUris,
      collectionSync,
      contextData,
    } = options;
    if (keys.length < 1) {
      throw new TypeError("The sender's keys must not be empty.");
    }
    for (const { privateKey } of keys) {
      validateCryptoKey(privateKey, "private");
    }
    if (activity.id == null) {
      const id = new URL(`urn:uuid:${crypto.randomUUID()}`);
      activity = activity.clone({ id });
      logger.warn(
        "As the activity to send does not have an id, a new id {id} has " +
          "been generated for it.  However, it is recommended to explicitly " +
          "set the id for the activity.",
        { id: id.href },
      );
    }
    span?.setAttribute("activitypub.activity.id", activity.id!.href);
    if (activity.actorId == null) {
      logger.error(
        "Activity {activityId} to send does not have an actor.",
        { activity, activityId: activity?.id?.href },
      );
      throw new TypeError(
        "The activity to send must have at least one actor property.",
      );
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
    if (activity.id == null) {
      throw new TypeError("The activity to send must have an id.");
    }
    if (activity.actorId == null) {
      throw new TypeError(
        "The activity to send must have at least one actor property.",
      );
    } else if (keys.length < 1) {
      throw new TypeError("The keys must not be empty.");
    }
    const activityId = activity.id.href;
    let proofCreated = false;
    let rsaKey: { keyId: URL; privateKey: CryptoKey } | null = null;
    for (const { keyId, privateKey } of keys) {
      validateCryptoKey(privateKey, "private");
      if (rsaKey == null && privateKey.algorithm.name === "RSASSA-PKCS1-v1_5") {
        rsaKey = { keyId, privateKey };
        continue;
      }
      if (privateKey.algorithm.name === "Ed25519") {
        activity = await signObject(activity, privateKey, keyId, {
          contextLoader: this.contextLoader,
          tracerProvider: this.tracerProvider,
        });
        proofCreated = true;
      }
    }
    let jsonLd = await activity.toJsonLd({
      format: "compact",
      contextLoader: this.contextLoader,
    });
    if (rsaKey == null) {
      logger.warn(
        "No supported key found to create a Linked Data signature for " +
          "the activity {activityId}.  The activity will be sent without " +
          "a Linked Data signature.  In order to create a Linked Data " +
          "signature, at least one RSASSA-PKCS1-v1_5 key must be provided.",
        {
          activityId,
          keys: keys.map((pair) => ({
            keyId: pair.keyId.href,
            privateKey: pair.privateKey,
          })),
        },
      );
    } else {
      jsonLd = await signJsonLd(jsonLd, rsaKey.privateKey, rsaKey.keyId, {
        contextLoader: this.contextLoader,
        tracerProvider: this.tracerProvider,
      });
    }
    if (!proofCreated) {
      logger.warn(
        "No supported key found to create a proof for the activity {activityId}.  " +
          "The activity will be sent without a proof.  " +
          "In order to create a proof, at least one Ed25519 key must be provided.",
        {
          activityId,
          keys: keys.map((pair) => ({
            keyId: pair.keyId.href,
            privateKey: pair.privateKey,
          })),
        },
      );
    }
    if (immediate || this.outboxQueue == null) {
      if (immediate) {
        logger.debug(
          "Sending activity immediately without queue since immediate option " +
            "is set.",
          { activityId: activity.id!.href, activity: jsonLd },
        );
      } else {
        logger.debug(
          "Sending activity immediately without queue since queue is not set.",
          { activityId: activity.id!.href, activity: jsonLd },
        );
      }
      const promises: Promise<void>[] = [];
      for (const inbox in inboxes) {
        promises.push(
          sendActivity({
            keys,
            activity: jsonLd,
            activityId: activity.id?.href,
            activityType: getTypeId(activity).href,
            inbox: new URL(inbox),
            sharedInbox: inboxes[inbox].sharedInbox,
            headers: collectionSync == null ? undefined : new Headers({
              "Collection-Synchronization":
                await buildCollectionSynchronizationHeader(
                  collectionSync,
                  inboxes[inbox].actorIds,
                ),
            }),
            tracerProvider: this.tracerProvider,
          }),
        );
      }
      await Promise.all(promises);
      return;
    }
    logger.debug(
      "Enqueuing activity {activityId} to send later.",
      { activityId: activity.id!.href, activity: jsonLd },
    );
    const keyJwkPairs: SenderKeyJwkPair[] = [];
    for (const { keyId, privateKey } of keys) {
      const privateKeyJwk = await exportJwk(privateKey);
      keyJwkPairs.push({ keyId: keyId.href, privateKey: privateKeyJwk });
    }
    if (!this.manuallyStartQueue) this.#startQueue(contextData);
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);
    const promises: Promise<void>[] = [];
    for (const inbox in inboxes) {
      const message: OutboxMessage = {
        type: "outbox",
        id: crypto.randomUUID(),
        keys: keyJwkPairs,
        activity: jsonLd,
        activityId: activity.id?.href,
        activityType: getTypeId(activity).href,
        inbox,
        sharedInbox: inboxes[inbox].sharedInbox,
        started: new Date().toISOString(),
        attempt: 0,
        headers: collectionSync == null ? {} : {
          "Collection-Synchronization":
            await buildCollectionSynchronizationHeader(
              collectionSync,
              inboxes[inbox].actorIds,
            ),
        },
        traceContext: carrier,
      };
      promises.push(this.outboxQueue.enqueue(message));
    }
    const results = await Promise.allSettled(promises);
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason);
    if (errors.length > 0) {
      logger.error(
        "Failed to enqueue activity {activityId} to send later: {errors}",
        { activityId: activity.id!.href, errors },
      );
      if (errors.length > 1) {
        throw new AggregateError(
          errors,
          `Failed to enqueue activity ${activityId} to send later.`,
        );
      }
      throw errors[0];
    }
  }

  fetch(
    request: Request,
    options: FederationFetchOptions<TContextData>,
  ): Promise<Response> {
    const requestId = getRequestId(request);
    return withContext({ requestId }, async () => {
      const tracer = this.#getTracer();
      return await tracer.startActiveSpan(
        request.method,
        {
          kind: SpanKind.SERVER,
          attributes: {
            [ATTR_HTTP_REQUEST_METHOD]: request.method,
            [ATTR_URL_FULL]: request.url,
          },
        },
        async (span) => {
          const logger = getLogger(["fedify", "federation", "http"]);
          if (span.isRecording()) {
            for (const [k, v] of request.headers) {
              span.setAttribute(ATTR_HTTP_REQUEST_HEADER(k), [v]);
            }
          }
          let response: Response;
          try {
            response = await this.#fetch(request, { ...options, span, tracer });
          } catch (error) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `${error}`,
            });
            span.end();
            logger.error(
              "An error occurred while serving request {method} {url}: {error}",
              { method: request.method, url: request.url, error },
            );
            throw error;
          }
          if (span.isRecording()) {
            span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);
            for (const [k, v] of response.headers) {
              span.setAttribute(ATTR_HTTP_RESPONSE_HEADER(k), [v]);
            }
            span.setStatus({
              code: response.status >= 500
                ? SpanStatusCode.ERROR
                : SpanStatusCode.UNSET,
              message: response.statusText,
            });
          }
          span.end();
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
        },
      );
    });
  }

  async #fetch(
    request: Request,
    {
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
      contextData,
      span,
      tracer,
    }: FederationFetchOptions<TContextData> & { span: Span; tracer: Tracer },
  ): Promise<Response> {
    onNotFound ??= notFound;
    onNotAcceptable ??= notAcceptable;
    onUnauthorized ??= unauthorized;
    const url = new URL(request.url);
    const route = this.router.route(url.pathname);
    if (route == null) return await onNotFound(request);
    span.updateName(`${request.method} ${route.template}`);
    let context = this.#createContext(request, contextData);
    const routeName = route.name.replace(/:.*$/, "");
    switch (routeName) {
      case "webfinger":
        return await handleWebFinger(request, {
          context,
          actorDispatcher: this.actorCallbacks?.dispatcher,
          actorHandleMapper: this.actorCallbacks?.handleMapper,
          actorAliasMapper: this.actorCallbacks?.aliasMapper,
          onNotFound,
          tracer,
        });
      case "nodeInfoJrd":
        return await handleNodeInfoJrd(request, context);
      case "nodeInfo":
        return await handleNodeInfo(request, {
          context,
          nodeInfoDispatcher: this.nodeInfoDispatcher!,
        });
      case "actor":
        context = this.#createContext(request, contextData, {
          invokedFromActorDispatcher: {
            identifier: route.values.identifier ?? route.values.handle,
          },
        });
        return await handleActor(request, {
          identifier: route.values.identifier ?? route.values.handle,
          context,
          actorDispatcher: this.actorCallbacks?.dispatcher,
          authorizePredicate: this.actorCallbacks?.authorizePredicate,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      case "object": {
        const typeId = route.name.replace(/^object:/, "");
        const callbacks = this.objectCallbacks[typeId];
        const cls = this.objectTypeIds[typeId];
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
          identifier: route.values.identifier ?? route.values.handle,
          uriGetter: context.getOutboxUri.bind(context),
          context,
          collectionCallbacks: this.outboxCallbacks,
          tracerProvider: this.tracerProvider,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      case "inbox":
        if (request.method !== "POST") {
          return await handleCollection(request, {
            name: "inbox",
            identifier: route.values.identifier ?? route.values.handle,
            uriGetter: context.getInboxUri.bind(context),
            context,
            collectionCallbacks: this.inboxCallbacks,
            tracerProvider: this.tracerProvider,
            onUnauthorized,
            onNotFound,
            onNotAcceptable,
          });
        }
        context = this.#createContext(request, contextData, {
          documentLoader: await context.getDocumentLoader({
            identifier: route.values.identifier ?? route.values.handle,
          }),
        });
        // falls through
      case "sharedInbox":
        if (routeName !== "inbox" && this.sharedInboxKeyDispatcher != null) {
          const identity = await this.sharedInboxKeyDispatcher(context);
          if (identity != null) {
            context = this.#createContext(request, contextData, {
              documentLoader:
                "identifier" in identity || "username" in identity ||
                  "handle" in identity
                  ? await context.getDocumentLoader(identity)
                  : context.getDocumentLoader(identity),
            });
          }
        }
        if (!this.manuallyStartQueue) this.#startQueue(contextData);
        return await handleInbox(request, {
          recipient: route.values.identifier ?? route.values.handle ?? null,
          context,
          inboxContextFactory: context.toInboxContext.bind(context),
          kv: this.kv,
          kvPrefixes: this.kvPrefixes,
          queue: this.inboxQueue,
          actorDispatcher: this.actorCallbacks?.dispatcher,
          inboxListeners: this.inboxListeners,
          inboxErrorHandler: this.inboxErrorHandler,
          onNotFound,
          signatureTimeWindow: this.signatureTimeWindow,
          skipSignatureVerification: this.skipSignatureVerification,
          tracerProvider: this.tracerProvider,
        });
      case "following":
        return await handleCollection(request, {
          name: "following",
          identifier: route.values.identifier ?? route.values.handle,
          uriGetter: context.getFollowingUri.bind(context),
          context,
          collectionCallbacks: this.followingCallbacks,
          tracerProvider: this.tracerProvider,
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
          identifier: route.values.identifier ?? route.values.handle,
          uriGetter: context.getFollowersUri.bind(context),
          context,
          filter: baseUrl != null ? new URL(baseUrl) : undefined,
          filterPredicate: baseUrl != null
            ? ((i) =>
              (i instanceof URL ? i.href : i.id?.href ?? "").startsWith(
                baseUrl!,
              ))
            : undefined,
          collectionCallbacks: this.followersCallbacks,
          tracerProvider: this.tracerProvider,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      }
      case "liked":
        return await handleCollection(request, {
          name: "liked",
          identifier: route.values.identifier ?? route.values.handle,
          uriGetter: context.getLikedUri.bind(context),
          context,
          collectionCallbacks: this.likedCallbacks,
          tracerProvider: this.tracerProvider,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      case "featured":
        return await handleCollection(request, {
          name: "featured",
          identifier: route.values.identifier ?? route.values.handle,
          uriGetter: context.getFeaturedUri.bind(context),
          context,
          collectionCallbacks: this.featuredCallbacks,
          tracerProvider: this.tracerProvider,
          onUnauthorized,
          onNotFound,
          onNotAcceptable,
        });
      case "featuredTags":
        return await handleCollection(request, {
          name: "featured tags",
          identifier: route.values.identifier ?? route.values.handle,
          uriGetter: context.getFeaturedTagsUri.bind(context),
          context,
          collectionCallbacks: this.featuredTagsCallbacks,
          tracerProvider: this.tracerProvider,
          onUnauthorized,
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

interface ContextOptions<TContextData> {
  url: URL;
  federation: FederationImpl<TContextData>;
  data: TContextData;
  documentLoader: DocumentLoader;
  invokedFromActorKeyPairsDispatcher?: { identifier: string };
}

export class ContextImpl<TContextData> implements Context<TContextData> {
  readonly url: URL;
  readonly federation: FederationImpl<TContextData>;
  readonly data: TContextData;
  readonly documentLoader: DocumentLoader;
  readonly invokedFromActorKeyPairsDispatcher?: { identifier: string };

  constructor(
    {
      url,
      federation,
      data,
      documentLoader,
      invokedFromActorKeyPairsDispatcher,
    }: ContextOptions<TContextData>,
  ) {
    this.url = url;
    this.federation = federation;
    this.data = data;
    this.documentLoader = documentLoader;
    this.invokedFromActorKeyPairsDispatcher =
      invokedFromActorKeyPairsDispatcher;
  }

  toInboxContext(
    recipient: string | null,
    activity: unknown,
    activityId: string | undefined,
    activityType: string,
  ): InboxContextImpl<TContextData> {
    return new InboxContextImpl(recipient, activity, activityId, activityType, {
      url: this.url,
      federation: this.federation,
      data: this.data,
      documentLoader: this.documentLoader,
      invokedFromActorKeyPairsDispatcher:
        this.invokedFromActorKeyPairsDispatcher,
    });
  }

  get hostname(): string {
    return this.url.hostname;
  }

  get host(): string {
    return this.url.host;
  }

  get origin(): string {
    return this.url.origin;
  }

  get contextLoader(): DocumentLoader {
    return this.federation.contextLoader;
  }

  get tracerProvider(): TracerProvider {
    return this.federation.tracerProvider;
  }

  getNodeInfoUri(): URL {
    const path = this.federation.router.build("nodeInfo", {});
    if (path == null) {
      throw new RouterError("No NodeInfo dispatcher registered.");
    }
    return new URL(path, this.url);
  }

  getActorUri(identifier: string): URL {
    const path = this.federation.router.build(
      "actor",
      { identifier, handle: identifier },
    );
    if (path == null) {
      throw new RouterError("No actor dispatcher registered.");
    }
    return new URL(path, this.url);
  }

  getObjectUri<TObject extends Object>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    values: Record<string, string>,
  ): URL {
    const callbacks = this.federation.objectCallbacks[cls.typeId.href];
    if (callbacks == null) {
      throw new RouterError("No object dispatcher registered.");
    }
    for (const param of callbacks.parameters) {
      if (!(param in values)) {
        throw new TypeError(`Missing parameter: ${param}`);
      }
    }
    const path = this.federation.router.build(
      `object:${cls.typeId.href}`,
      values,
    );
    if (path == null) {
      throw new RouterError("No object dispatcher registered.");
    }
    return new URL(path, this.url);
  }

  getOutboxUri(identifier: string): URL {
    const path = this.federation.router.build(
      "outbox",
      { identifier, handle: identifier },
    );
    if (path == null) {
      throw new RouterError("No outbox dispatcher registered.");
    }
    return new URL(path, this.url);
  }

  getInboxUri(): URL;
  getInboxUri(identifier: string): URL;
  getInboxUri(identifier?: string): URL {
    if (identifier == null) {
      const path = this.federation.router.build("sharedInbox", {});
      if (path == null) {
        throw new RouterError("No shared inbox path registered.");
      }
      return new URL(path, this.url);
    }
    const path = this.federation.router.build(
      "inbox",
      { identifier, handle: identifier },
    );
    if (path == null) {
      throw new RouterError("No inbox path registered.");
    }
    return new URL(path, this.url);
  }

  getFollowingUri(identifier: string): URL {
    const path = this.federation.router.build(
      "following",
      { identifier, handle: identifier },
    );
    if (path == null) {
      throw new RouterError("No following collection path registered.");
    }
    return new URL(path, this.url);
  }

  getFollowersUri(identifier: string): URL {
    const path = this.federation.router.build(
      "followers",
      { identifier, handle: identifier },
    );
    if (path == null) {
      throw new RouterError("No followers collection path registered.");
    }
    return new URL(path, this.url);
  }

  getLikedUri(identifier: string): URL {
    const path = this.federation.router.build(
      "liked",
      { identifier, handle: identifier },
    );
    if (path == null) {
      throw new RouterError("No liked collection path registered.");
    }
    return new URL(path, this.url);
  }

  getFeaturedUri(identifier: string): URL {
    const path = this.federation.router.build(
      "featured",
      { identifier, handle: identifier },
    );
    if (path == null) {
      throw new RouterError("No featured collection path registered.");
    }
    return new URL(path, this.url);
  }

  getFeaturedTagsUri(identifier: string): URL {
    const path = this.federation.router.build(
      "featuredTags",
      { identifier, handle: identifier },
    );
    if (path == null) {
      throw new RouterError("No featured tags collection path registered.");
    }
    return new URL(path, this.url);
  }

  parseUri(uri: URL | null): ParseUriResult | null {
    if (uri == null) return null;
    if (uri.origin !== this.url.origin) return null;
    const route = this.federation.router.route(uri.pathname);
    const logger = getLogger(["fedify", "federation"]);
    if (route == null) return null;
    else if (route.name === "sharedInbox") {
      return {
        type: "inbox",
        identifier: undefined,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return undefined;
        },
      };
    }
    const identifier = "identifier" in route.values
      ? route.values.identifier
      : route.values.handle;
    if (route.name === "actor") {
      return {
        type: "actor",
        identifier,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return identifier;
        },
      };
    } else if (route.name.startsWith("object:")) {
      const typeId = route.name.replace(/^object:/, "");
      return {
        type: "object",
        class: this.federation.objectTypeIds[typeId],
        typeId: new URL(typeId),
        values: route.values,
      };
    } else if (route.name === "inbox") {
      return {
        type: "inbox",
        identifier,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return identifier;
        },
      };
    } else if (route.name === "outbox") {
      return {
        type: "outbox",
        identifier,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return identifier;
        },
      };
    } else if (route.name === "following") {
      return {
        type: "following",
        identifier,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return identifier;
        },
      };
    } else if (route.name === "followers") {
      return {
        type: "followers",
        identifier,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return identifier;
        },
      };
    } else if (route.name === "liked") {
      return {
        type: "liked",
        identifier,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return identifier;
        },
      };
    } else if (route.name === "featured") {
      return {
        type: "featured",
        identifier,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return identifier;
        },
      };
    } else if (route.name === "featuredTags") {
      return {
        type: "featuredTags",
        identifier,
        get handle() {
          logger.warn(
            "The ParseUriResult.handle property is deprecated; " +
              "use ParseUriResult.identifier instead.",
          );
          return identifier;
        },
      };
    }
    return null;
  }

  async getActorKeyPairs(identifier: string): Promise<ActorKeyPair[]> {
    const logger = getLogger(["fedify", "federation", "actor"]);
    if (this.invokedFromActorKeyPairsDispatcher != null) {
      logger.warn(
        "Context.getActorKeyPairs({getActorKeyPairsIdentifier}) method is " +
          "invoked from the actor key pairs dispatcher " +
          "({actorKeyPairsDispatcherIdentifier}); this may cause " +
          "an infinite loop.",
        {
          getActorKeyPairsIdentifier: identifier,
          actorKeyPairsDispatcherIdentifier:
            this.invokedFromActorKeyPairsDispatcher.identifier,
        },
      );
    }
    let keyPairs: (CryptoKeyPair & { keyId: URL })[];
    try {
      keyPairs = await this.getKeyPairsFromIdentifier(identifier);
    } catch (_) {
      logger.warn("No actor key pairs dispatcher registered.");
      return [];
    }
    const owner = this.getActorUri(identifier);
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

  protected async getKeyPairsFromIdentifier(
    identifier: string,
  ): Promise<(CryptoKeyPair & { keyId: URL })[]> {
    const logger = getLogger(["fedify", "federation", "actor"]);
    if (this.federation.actorCallbacks?.keyPairsDispatcher == null) {
      throw new Error("No actor key pairs dispatcher registered.");
    }
    const path = this.federation.router.build(
      "actor",
      { identifier, handle: identifier },
    );
    if (path == null) {
      logger.warn("No actor dispatcher registered.");
      return [];
    }
    const actorUri = new URL(path, this.url);
    const keyPairs = await this.federation.actorCallbacks?.keyPairsDispatcher(
      new ContextImpl({
        ...this,
        invokedFromActorKeyPairsDispatcher: { identifier },
      }),
      identifier,
    );
    if (keyPairs.length < 1) {
      logger.warn("No key pairs found for actor {identifier}.", { identifier });
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

  protected async getRsaKeyPairFromIdentifier(
    identifier: string,
  ): Promise<CryptoKeyPair & { keyId: URL } | null> {
    const keyPairs = await this.getKeyPairsFromIdentifier(identifier);
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
      "No RSA-PKCS#1-v1.5 SHA-256 key found for actor {identifier}.",
      { identifier },
    );
    return null;
  }

  getDocumentLoader(
    identity:
      | { identifier: string }
      | { username: string }
      | { handle: string },
  ): Promise<DocumentLoader>;
  getDocumentLoader(identity: SenderKeyPair): DocumentLoader;
  getDocumentLoader(
    identity:
      | SenderKeyPair
      | { identifier: string }
      | { username: string }
      | { handle: string },
  ): DocumentLoader | Promise<DocumentLoader> {
    if (
      "identifier" in identity || "username" in identity || "handle" in identity
    ) {
      let identifierPromise: Promise<string | null>;
      if ("username" in identity || "handle" in identity) {
        let username: string;
        if ("username" in identity) {
          username = identity.username;
        } else {
          username = identity.handle;
          getLogger(["fedify", "runtime", "docloader"]).warn(
            'The "handle" property is deprecated; use "identifier" or ' +
              '"username" instead.',
            { identity },
          );
        }
        const mapper = this.federation.actorCallbacks?.handleMapper;
        if (mapper == null) {
          identifierPromise = Promise.resolve(username);
        } else {
          const identifier = mapper(this, username);
          identifierPromise = identifier instanceof Promise
            ? identifier
            : Promise.resolve(identifier);
        }
      } else {
        identifierPromise = Promise.resolve(identity.identifier);
      }
      return identifierPromise.then((identifier) => {
        if (identifier == null) return this.documentLoader;
        const keyPair = this.getRsaKeyPairFromIdentifier(identifier);
        return keyPair.then((pair) =>
          pair == null
            ? this.documentLoader
            : this.federation.authenticatedDocumentLoaderFactory(pair)
        );
      });
    }
    return this.federation.authenticatedDocumentLoaderFactory(identity);
  }

  lookupObject(
    identifier: string | URL,
    options: LookupObjectOptions = {},
  ): Promise<Object | null> {
    return lookupObject(identifier, {
      documentLoader: options.documentLoader ?? this.documentLoader,
      contextLoader: options.contextLoader ?? this.contextLoader,
      userAgent: options.userAgent ?? this.federation.userAgent,
      tracerProvider: options.tracerProvider ?? this.tracerProvider,
    });
  }

  traverseCollection(
    collection: Collection,
    options: TraverseCollectionOptions = {},
  ): AsyncIterable<Object | Link> {
    return traverseCollection(collection, {
      documentLoader: options.documentLoader ?? this.documentLoader,
      contextLoader: options.contextLoader ?? this.contextLoader,
    });
  }

  sendActivity(
    sender:
      | SenderKeyPair
      | SenderKeyPair[]
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: Recipient | Recipient[] | "followers",
    activity: Activity,
    options: SendActivityOptions = {},
  ): Promise<void> {
    const tracer = this.tracerProvider.getTracer(
      metadata.name,
      metadata.version,
    );
    return tracer.startActiveSpan(
      "activitypub.outbox",
      {
        kind: this.federation.outboxQueue == null || options.immediate
          ? SpanKind.CLIENT
          : SpanKind.PRODUCER,
        attributes: {
          "activitypub.activity.type": getTypeId(activity).href,
          "activitypub.activity.to": activity.toIds.map((to) => to.href),
          "activitypub.activity.cc": activity.toIds.map((cc) => cc.href),
          "activitypub.activity.bto": activity.btoIds.map((bto) => bto.href),
          "activitypub.activity.bcc": activity.toIds.map((bcc) => bcc.href),
        },
      },
      async (span) => {
        try {
          if (activity.id != null) {
            span.setAttribute("activitypub.activity.id", activity.id.href);
          }
          await this.sendActivityInternal(
            sender,
            recipients,
            activity,
            options,
            span,
          );
        } catch (e) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
          throw e;
        } finally {
          span.end();
        }
      },
    );
  }

  protected async sendActivityInternal(
    sender:
      | SenderKeyPair
      | SenderKeyPair[]
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: Recipient | Recipient[] | "followers",
    activity: Activity,
    options: SendActivityOptions = {},
    span: Span,
  ): Promise<void> {
    let keys: SenderKeyPair[];
    let identifier: string | null = null;
    if ("identifier" in sender || "username" in sender || "handle" in sender) {
      if ("identifier" in sender) {
        identifier = sender.identifier;
      } else {
        let username: string;
        if ("username" in sender) {
          username = sender.username;
        } else {
          username = sender.handle;
          getLogger(["fedify", "federation", "outbox"]).warn(
            'The "handle" property for the sender parameter is deprecated; ' +
              'use "identifier" or "username" instead.',
            { sender },
          );
        }
        if (this.federation.actorCallbacks?.handleMapper == null) {
          identifier = username;
        } else {
          const mapped = await this.federation.actorCallbacks.handleMapper(
            this,
            username,
          );
          if (mapped == null) {
            throw new Error(
              `No actor found for the given username ${
                JSON.stringify(username)
              }.`,
            );
          }
          identifier = mapped;
        }
      }
      span.setAttribute("fedify.actor.identifier", identifier);
      keys = await this.getKeyPairsFromIdentifier(identifier);
      if (keys.length < 1) {
        throw new Error(
          `No key pair found for actor ${JSON.stringify(identifier)}.`,
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
    const opts: SendActivityInternalOptions<TContextData> = {
      contextData: this.data,
      ...options,
    };
    let expandedRecipients: Recipient[];
    if (Array.isArray(recipients)) {
      expandedRecipients = recipients;
    } else if (recipients === "followers") {
      if (identifier == null) {
        throw new Error(
          'If recipients is "followers", ' +
            "sender must be an actor identifier or username.",
        );
      }
      expandedRecipients = [];
      for await (
        const recipient of this.getFollowers(identifier)
      ) {
        expandedRecipients.push(recipient);
      }
      const collectionId = this.federation.router.build(
        "followers",
        { identifier, handle: identifier },
      );
      opts.collectionSync = collectionId == null
        ? undefined
        : new URL(collectionId, this.url).href;
    } else {
      expandedRecipients = [recipients];
    }
    span.setAttribute("activitypub.inboxes", expandedRecipients.length);
    return await this.federation.sendActivity(
      keys,
      expandedRecipients,
      activity,
      opts,
      span,
    );
  }

  async *getFollowers(identifier: string): AsyncIterable<Recipient> {
    if (this.federation.followersCallbacks == null) {
      throw new Error("No followers collection dispatcher registered.");
    }
    const result = await this.federation.followersCallbacks.dispatcher(
      this,
      identifier,
      null,
    );
    if (result != null) {
      for (const recipient of result.items) yield recipient;
      return;
    }
    if (this.federation.followersCallbacks.firstCursor == null) {
      throw new Error(
        "No first cursor dispatcher registered for followers collection.",
      );
    }
    let cursor = await this.federation.followersCallbacks.firstCursor(
      this,
      identifier,
    );
    while (cursor != null) {
      const result = await this.federation.followersCallbacks.dispatcher(
        this,
        identifier,
        cursor,
      );
      if (result == null) break;
      for (const recipient of result.items) yield recipient;
      cursor = result.nextCursor ?? null;
    }
  }

  routeActivity(
    recipient: string | null,
    activity: Activity,
    options: RouteActivityOptions = {},
  ): Promise<boolean> {
    const tracerProvider = this.tracerProvider ?? this.tracerProvider;
    const tracer = tracerProvider.getTracer(metadata.name, metadata.version);
    return tracer.startActiveSpan(
      "activitypub.inbox",
      {
        kind: this.federation.inboxQueue == null || options.immediate
          ? SpanKind.INTERNAL
          : SpanKind.PRODUCER,
        attributes: {
          "activitypub.activity.type": getTypeId(activity).href,
        },
      },
      async (span) => {
        if (activity.id != null) {
          span.setAttribute("activitypub.activity.id", activity.id.href);
        }
        if (activity.toIds.length > 0) {
          span.setAttribute(
            "activitypub.activity.to",
            activity.toIds.map((to) => to.href),
          );
        }
        if (activity.ccIds.length > 0) {
          span.setAttribute(
            "activitypub.activity.cc",
            activity.ccIds.map((cc) => cc.href),
          );
        }
        if (activity.btoIds.length > 0) {
          span.setAttribute(
            "activitypub.activity.bto",
            activity.btoIds.map((bto) => bto.href),
          );
        }
        if (activity.bccIds.length > 0) {
          span.setAttribute(
            "activitypub.activity.bcc",
            activity.bccIds.map((bcc) => bcc.href),
          );
        }
        try {
          const ok = await this.routeActivityInternal(
            recipient,
            activity,
            options,
            span,
          );
          if (ok) {
            span.setAttribute("activitypub.shared_inbox", recipient == null);
            if (recipient != null) {
              span.setAttribute("fedify.inbox.recipient", recipient);
            }
          } else {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
          return ok;
        } catch (e) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
          throw e;
        } finally {
          span.end();
        }
      },
    );
  }

  protected async routeActivityInternal(
    recipient: string | null,
    activity: Activity,
    options: RouteActivityOptions = {},
    span: Span,
  ): Promise<boolean> {
    const logger = getLogger(["fedify", "federation", "inbox"]);
    const contextLoader = options.contextLoader ?? this.contextLoader;
    const json = await activity.toJsonLd({ contextLoader });
    const keyCache = new KvKeyCache(
      this.federation.kv,
      this.federation.kvPrefixes.publicKey,
      this,
    );
    const verified = await verifyObject(
      Activity,
      json,
      {
        contextLoader,
        documentLoader: options.documentLoader ?? this.documentLoader,
        tracerProvider: options.tracerProvider ?? this.tracerProvider,
        keyCache,
      },
    );
    if (verified == null) {
      logger.debug(
        "Object Integrity Proofs are not verified.",
        { recipient, activity: json },
      );
      if (activity.id == null) {
        logger.debug(
          "Activity is missing an ID; unable to fetch.",
          { recipient, activity: json },
        );
        return false;
      }
      const fetched = await this.lookupObject(activity.id, options);
      if (fetched == null) {
        logger.debug(
          "Failed to fetch the remote activity object {activityId}.",
          { recipient, activity: json, activityId: activity.id.href },
        );
        return false;
      } else if (!(fetched instanceof Activity)) {
        logger.debug(
          "Fetched object is not an Activity.",
          { recipient, activity: await fetched.toJsonLd({ contextLoader }) },
        );
        return false;
      } else if (fetched.id?.href !== activity.id.href) {
        logger.debug(
          "Fetched activity object has a different ID; failed to verify.",
          { recipient, activity: await fetched.toJsonLd({ contextLoader }) },
        );
        return false;
      } else if (fetched.actorIds.length < 1) {
        logger.debug(
          "Fetched activity object is missing an actor; unable to verify.",
          { recipient, activity: await fetched.toJsonLd({ contextLoader }) },
        );
        return false;
      }
      const activityId = fetched.id;
      if (
        !fetched.actorIds.every((actor) => actor.origin === activityId.origin)
      ) {
        logger.debug(
          "Fetched activity object has actors from different origins; " +
            "unable to verify.",
          { recipient, activity: await fetched.toJsonLd({ contextLoader }) },
        );
        return false;
      }
      logger.debug(
        "Successfully fetched the remote activity object {activityId}; " +
          "ignore the original activity and use the fetched one, which is trustworthy.",
      );
      activity = fetched;
    } else {
      logger.debug(
        "Object Integrity Proofs are verified.",
        { recipient, activity: json },
      );
    }
    const routeResult = await routeActivity({
      context: this,
      json,
      activity,
      recipient,
      inboxListeners: this.federation.inboxListeners,
      inboxContextFactory: this.toInboxContext.bind(this),
      inboxErrorHandler: this.federation.inboxErrorHandler,
      kv: this.federation.kv,
      kvPrefixes: this.federation.kvPrefixes,
      queue: this.federation.inboxQueue,
      span,
      tracerProvider: options.tracerProvider ?? this.tracerProvider,
    });
    return routeResult === "alreadyProcessed" || routeResult === "enqueued" ||
      routeResult === "unsupportedActivity" || routeResult === "success";
  }
}

interface RequestContextOptions<TContextData>
  extends ContextOptions<TContextData> {
  request: Request;
  invokedFromActorDispatcher?: { identifier: string };
  invokedFromObjectDispatcher?: {
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => Object) & { typeId: URL };
    values: Record<string, string>;
  };
}

class RequestContextImpl<TContextData> extends ContextImpl<TContextData>
  implements RequestContext<TContextData> {
  readonly #invokedFromActorDispatcher?: { identifier: string };
  readonly #invokedFromObjectDispatcher?: {
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => Object) & { typeId: URL };
    values: Record<string, string>;
  };
  readonly request: Request;
  override readonly url: URL;

  constructor(options: RequestContextOptions<TContextData>) {
    super(options);
    this.#invokedFromActorDispatcher = options.invokedFromActorDispatcher;
    this.#invokedFromObjectDispatcher = options.invokedFromObjectDispatcher;
    this.request = options.request;
    this.url = options.url;
  }

  async getActor(identifier: string): Promise<Actor | null> {
    if (
      this.federation.actorCallbacks == null ||
      this.federation.actorCallbacks.dispatcher == null
    ) {
      throw new Error("No actor dispatcher registered.");
    }
    if (this.#invokedFromActorDispatcher != null) {
      getLogger(["fedify", "federation", "actor"]).warn(
        "RequestContext.getActor({getActorIdentifier}) is invoked from " +
          "the actor dispatcher ({actorDispatcherIdentifier}); " +
          "this may cause an infinite loop.",
        {
          getActorIdentifier: identifier,
          actorDispatcherIdentifier:
            this.#invokedFromActorDispatcher.identifier,
        },
      );
    }
    return await this.federation.actorCallbacks.dispatcher(
      new RequestContextImpl({
        ...this,
        invokedFromActorDispatcher: { identifier },
      }),
      identifier,
    );
  }

  async getObject<TObject extends Object>(
    // deno-lint-ignore no-explicit-any
    cls: (new (...args: any[]) => TObject) & { typeId: URL },
    values: Record<string, string>,
  ): Promise<TObject | null> {
    const callbacks = this.federation.objectCallbacks[cls.typeId.href];
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
        ...this,
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
      timeWindow: this.federation.signatureTimeWindow,
      tracerProvider: this.tracerProvider,
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

export class InboxContextImpl<TContextData> extends ContextImpl<TContextData>
  implements InboxContext<TContextData> {
  readonly recipient: string | null;
  readonly activity: unknown;
  readonly activityId?: string;
  readonly activityType: string;

  constructor(
    recipient: string | null,
    activity: unknown,
    activityId: string | undefined,
    activityType: string,
    options: ContextOptions<TContextData>,
  ) {
    super(options);
    this.recipient = recipient;
    this.activity = activity;
    this.activityId = activityId;
    this.activityType = activityType;
  }

  forwardActivity(
    forwarder:
      | SenderKeyPair
      | SenderKeyPair[]
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: Recipient | Recipient[],
    options?: ForwardActivityOptions,
  ): Promise<void>;
  forwardActivity(
    forwarder:
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: "followers",
    options?: ForwardActivityOptions,
  ): Promise<void>;
  forwardActivity(
    forwarder:
      | SenderKeyPair
      | SenderKeyPair[]
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: Recipient | Recipient[] | "followers",
    options?: ForwardActivityOptions,
  ): Promise<void> {
    const tracer = this.tracerProvider.getTracer(
      metadata.name,
      metadata.version,
    );
    return tracer.startActiveSpan(
      "activitypub.outbox",
      {
        kind: this.federation.outboxQueue == null || options?.immediate
          ? SpanKind.CLIENT
          : SpanKind.PRODUCER,
        attributes: { "activitypub.activity.type": this.activityType },
      },
      async (span) => {
        try {
          if (this.activityId != null) {
            span.setAttribute("activitypub.activity.id", this.activityId);
          }
          await this.forwardActivityInternal(forwarder, recipients, options);
        } catch (e) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
          throw e;
        } finally {
          span.end();
        }
      },
    );
  }

  private async forwardActivityInternal(
    forwarder:
      | SenderKeyPair
      | SenderKeyPair[]
      | { identifier: string }
      | { username: string }
      | { handle: string },
    recipients: Recipient | Recipient[] | "followers",
    options?: ForwardActivityOptions,
  ): Promise<void> {
    const logger = getLogger(["fedify", "federation", "inbox"]);
    let keys: SenderKeyPair[];
    let identifier: string | null = null;
    if (
      "identifier" in forwarder || "username" in forwarder ||
      "handle" in forwarder
    ) {
      if ("identifier" in forwarder) {
        identifier = forwarder.identifier;
      } else {
        let username: string;
        if ("username" in forwarder) {
          username = forwarder.username;
        } else {
          username = forwarder.handle;
          logger.warn(
            'The "handle" property for the forwarder parameter is deprecated; ' +
              'use "identifier" or "username" instead.',
            { forwarder },
          );
        }
        if (this.federation.actorCallbacks?.handleMapper == null) {
          identifier = username;
        } else {
          const mapped = await this.federation.actorCallbacks.handleMapper(
            this,
            username,
          );
          if (mapped == null) {
            throw new Error(
              `No actor found for the given username ${
                JSON.stringify(username)
              }.`,
            );
          }
          identifier = mapped;
        }
      }
      keys = await this.getKeyPairsFromIdentifier(identifier);
      if (keys.length < 1) {
        throw new Error(
          `No key pair found for actor ${JSON.stringify(identifier)}.`,
        );
      }
    } else if (Array.isArray(forwarder)) {
      if (forwarder.length < 1) {
        throw new Error("The forwarder's key pairs are empty.");
      }
      keys = forwarder;
    } else {
      keys = [forwarder];
    }
    if (!hasSignature(this.activity)) {
      let hasProof: boolean;
      try {
        const activity = await Activity.fromJsonLd(this.activity, this);
        hasProof = await activity.getProof() != null;
      } catch {
        hasProof = false;
      }
      if (!hasProof) {
        if (options?.skipIfUnsigned) return;
        logger.warn(
          "The received activity {activityId} is not signed; even if it is " +
            "forwarded to other servers as is, it may not be accepted by " +
            "them due to the lack of a signature/proof.",
        );
      }
    }
    if (recipients === "followers") {
      if (identifier == null) {
        throw new Error(
          'If recipients is "followers", ' +
            "forwarder must be an actor identifier or username.",
        );
      }
      const followers: Recipient[] = [];
      for await (const recipient of this.getFollowers(identifier)) {
        followers.push(recipient);
      }
      recipients = followers;
    }
    const inboxes = extractInboxes({
      recipients: Array.isArray(recipients) ? recipients : [recipients],
      preferSharedInbox: options?.preferSharedInbox,
      excludeBaseUris: options?.excludeBaseUris,
    });
    logger.debug("Forwarding activity {activityId} to inboxes:\n{inboxes}", {
      inboxes: globalThis.Object.keys(inboxes),
      activityId: this.activityId,
      activity: this.activity,
    });
    if (options?.immediate || this.federation.outboxQueue == null) {
      if (options?.immediate) {
        logger.debug(
          "Forwarding activity immediately without queue since immediate " +
            "option is set.",
        );
      } else {
        logger.debug(
          "Forwarding activity immediately without queue since queue is not " +
            "set.",
        );
      }
      const promises: Promise<void>[] = [];
      for (const inbox in inboxes) {
        promises.push(
          sendActivity({
            keys,
            activity: this.activity,
            activityId: this.activityId,
            activityType: this.activityType,
            inbox: new URL(inbox),
            sharedInbox: inboxes[inbox].sharedInbox,
            tracerProvider: this.tracerProvider,
          }),
        );
      }
      await Promise.all(promises);
      return;
    }
    logger.debug(
      "Enqueuing activity {activityId} to forward later.",
      { activityId: this.activityId, activity: this.activity },
    );
    const keyJwkPairs: SenderKeyJwkPair[] = [];
    for (const { keyId, privateKey } of keys) {
      const privateKeyJwk = await exportJwk(privateKey);
      keyJwkPairs.push({ keyId: keyId.href, privateKey: privateKeyJwk });
    }
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);
    const promises: Promise<void>[] = [];
    for (const inbox in inboxes) {
      const message: OutboxMessage = {
        type: "outbox",
        id: crypto.randomUUID(),
        keys: keyJwkPairs,
        activity: this.activity,
        activityId: this.activityId,
        activityType: this.activityType,
        inbox,
        sharedInbox: inboxes[inbox].sharedInbox,
        started: new Date().toISOString(),
        attempt: 0,
        headers: {},
        traceContext: carrier,
      };
      promises.push(this.federation.outboxQueue.enqueue(message));
    }
    const results = await Promise.allSettled(promises);
    const errors: unknown[] = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason);
    if (errors.length > 0) {
      logger.error(
        "Failed to enqueue activity {activityId} to forward later:\n{errors}",
        { activityId: this.activityId, errors },
      );
      if (errors.length > 1) {
        throw new AggregateError(
          errors,
          `Failed to enqueue activity ${this.activityId} to forward later.`,
        );
      }
      throw errors[0];
    }
  }
}

interface ActorCallbacks<TContextData> {
  dispatcher?: ActorDispatcher<TContextData>;
  keyPairsDispatcher?: ActorKeyPairsDispatcher<TContextData>;
  handleMapper?: ActorHandleMapper<TContextData>;
  aliasMapper?: ActorAliasMapper<TContextData>;
  authorizePredicate?: AuthorizePredicate<TContextData>;
}

interface ObjectCallbacks<TContextData, TParam extends string> {
  dispatcher: ObjectDispatcher<TContextData, Object, string>;
  parameters: Set<TParam>;
  authorizePredicate?: ObjectAuthorizePredicate<TContextData, TParam>;
}

interface SendActivityInternalOptions<TContextData>
  extends SendActivityOptions {
  collectionSync?: string;
  contextData: TContextData;
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

/**
 * Generates or extracts a unique identifier for a request.
 *
 * This function first attempts to extract an existing request ID from standard
 * tracing headers. If none exists, it generates a new one. The ID format is:
 *
 *  -  If from headers, uses the existing ID.
 *  -  If generated, uses format `req_` followed by a base36 timestamp and
 *     6 random chars.
 *
 * @param request The incoming HTTP request.
 * @returns A string identifier unique to this request.
 */
function getRequestId(request: Request): string {
  // First try to get existing trace ID from standard headers:
  const traceId = request.headers.get("X-Request-Id") ||
    request.headers.get("X-Correlation-Id") ||
    request.headers.get("Traceparent")?.split("-")[1];
  if (traceId != null) return traceId;
  // Generate new ID if none exists:
  // - Use timestamp for rough chronological ordering
  // - Add random suffix for uniqueness within same millisecond
  // - Prefix to distinguish from potential existing IDs
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `req_${timestamp}${random}`;
}
