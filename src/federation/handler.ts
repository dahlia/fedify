import { getLogger } from "@logtape/logtape";
import { accepts } from "@std/http/negotiation";
import type { DocumentLoader } from "../runtime/docloader.ts";
import { verifyRequest } from "../sig/http.ts";
import type { KeyCache } from "../sig/key.ts";
import { detachSignature, verifyJsonLd } from "../sig/ld.ts";
import { doesActorOwnKey } from "../sig/owner.ts";
import { verifyObject } from "../sig/proof.ts";
import type { Recipient } from "../vocab/actor.ts";
import {
  Activity,
  CryptographicKey,
  Link,
  Multikey,
  Object,
  OrderedCollection,
  OrderedCollectionPage,
} from "../vocab/vocab.ts";
import type {
  ActorDispatcher,
  AuthorizePredicate,
  CollectionCounter,
  CollectionCursor,
  CollectionDispatcher,
  InboxErrorHandler,
  ObjectAuthorizePredicate,
  ObjectDispatcher,
} from "./callback.ts";
import type { Context, InboxContext, RequestContext } from "./context.ts";
import type { InboxListenerSet } from "./inbox.ts";
import type { KvKey, KvStore } from "./kv.ts";
import type { MessageQueue } from "./mq.ts";
import type { InboxMessage } from "./queue.ts";

export function acceptsJsonLd(request: Request): boolean {
  const types = accepts(request);
  if (types == null) return true;
  if (types[0] === "text/html" || types[0] === "application/xhtml+xml") {
    return false;
  }
  return types.includes("application/activity+json") ||
    types.includes("application/ld+json") ||
    types.includes("application/json");
}

export interface ActorHandlerParameters<TContextData> {
  identifier: string;
  context: RequestContext<TContextData>;
  actorDispatcher?: ActorDispatcher<TContextData>;
  authorizePredicate?: AuthorizePredicate<TContextData>;
  onUnauthorized(request: Request): Response | Promise<Response>;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

export async function handleActor<TContextData>(
  request: Request,
  {
    identifier,
    context,
    actorDispatcher,
    authorizePredicate,
    onNotFound,
    onNotAcceptable,
    onUnauthorized,
  }: ActorHandlerParameters<TContextData>,
): Promise<Response> {
  const logger = getLogger(["fedify", "federation", "actor"]);
  if (actorDispatcher == null) {
    logger.debug("Actor dispatcher is not set.", { identifier });
    return await onNotFound(request);
  }
  const actor = await actorDispatcher(context, identifier);
  if (actor == null) {
    logger.debug("Actor {identifier} not found.", { identifier });
    return await onNotFound(request);
  }
  if (!acceptsJsonLd(request)) return await onNotAcceptable(request);
  if (authorizePredicate != null) {
    const key = await context.getSignedKey();
    const keyOwner = await context.getSignedKeyOwner();
    if (!await authorizePredicate(context, identifier, key, keyOwner)) {
      return await onUnauthorized(request);
    }
  }
  const jsonLd = await actor.toJsonLd(context);
  return new Response(JSON.stringify(jsonLd), {
    headers: {
      "Content-Type": "application/activity+json",
      Vary: "Accept",
    },
  });
}

export interface ObjectHandlerParameters<TContextData> {
  values: Record<string, string>;
  context: RequestContext<TContextData>;
  objectDispatcher?: ObjectDispatcher<TContextData, Object, string>;
  authorizePredicate?: ObjectAuthorizePredicate<TContextData, string>;
  onUnauthorized(request: Request): Response | Promise<Response>;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

export async function handleObject<TContextData>(
  request: Request,
  {
    values,
    context,
    objectDispatcher,
    authorizePredicate,
    onNotFound,
    onNotAcceptable,
    onUnauthorized,
  }: ObjectHandlerParameters<TContextData>,
): Promise<Response> {
  if (objectDispatcher == null) return await onNotFound(request);
  const object = await objectDispatcher(context, values);
  if (object == null) return await onNotFound(request);
  if (!acceptsJsonLd(request)) return await onNotAcceptable(request);
  if (authorizePredicate != null) {
    const key = await context.getSignedKey();
    const keyOwner = await context.getSignedKeyOwner();
    if (!await authorizePredicate(context, values, key, keyOwner)) {
      return await onUnauthorized(request);
    }
  }
  const jsonLd = await object.toJsonLd(context);
  return new Response(JSON.stringify(jsonLd), {
    headers: {
      "Content-Type": "application/activity+json",
      Vary: "Accept",
    },
  });
}

/**
 * Callbacks for handling a collection.
 */
export interface CollectionCallbacks<
  TItem,
  TContext extends Context<TContextData>,
  TContextData,
  TFilter,
> {
  /**
   * A callback that dispatches a collection.
   */
  dispatcher: CollectionDispatcher<TItem, TContext, TContextData, TFilter>;

  /**
   * A callback that counts the number of items in a collection.
   */
  counter?: CollectionCounter<TContextData, TFilter>;

  /**
   * A callback that returns the first cursor for a collection.
   */
  firstCursor?: CollectionCursor<TContext, TContextData, TFilter>;

  /**
   * A callback that returns the last cursor for a collection.
   */
  lastCursor?: CollectionCursor<TContext, TContextData, TFilter>;

  /**
   * A callback that determines if a request is authorized to access the collection.
   */
  authorizePredicate?: AuthorizePredicate<TContextData>;
}

export interface CollectionHandlerParameters<
  TItem,
  TContext extends RequestContext<TContextData>,
  TContextData,
  TFilter,
> {
  name: string;
  identifier: string;
  uriGetter: (handle: string) => URL;
  filter?: TFilter;
  filterPredicate?: (item: TItem) => boolean;
  context: TContext;
  collectionCallbacks?: CollectionCallbacks<
    TItem,
    TContext,
    TContextData,
    TFilter
  >;
  onUnauthorized(request: Request): Response | Promise<Response>;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

export async function handleCollection<
  TItem extends URL | Object | Link | Recipient,
  TContext extends RequestContext<TContextData>,
  TContextData,
  TFilter,
>(
  request: Request,
  {
    name,
    identifier,
    uriGetter,
    filter,
    filterPredicate,
    context,
    collectionCallbacks,
    onUnauthorized,
    onNotFound,
    onNotAcceptable,
  }: CollectionHandlerParameters<TItem, TContext, TContextData, TFilter>,
): Promise<Response> {
  if (collectionCallbacks == null) return await onNotFound(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  let collection: OrderedCollection | OrderedCollectionPage;
  const baseUri = uriGetter(identifier);
  if (cursor == null) {
    const firstCursor = await collectionCallbacks.firstCursor?.(
      context,
      identifier,
    );
    const totalItems = await collectionCallbacks.counter?.(context, identifier);
    if (firstCursor == null) {
      const page = await collectionCallbacks.dispatcher(
        context,
        identifier,
        null,
        filter,
      );
      if (page == null) return await onNotFound(request);
      const { items } = page;
      collection = new OrderedCollection({
        id: baseUri,
        totalItems: totalItems == null ? null : Number(totalItems),
        items: filterCollectionItems(items, name, filterPredicate),
      });
    } else {
      const lastCursor = await collectionCallbacks.lastCursor?.(
        context,
        identifier,
      );
      const first = new URL(context.url);
      first.searchParams.set("cursor", firstCursor);
      let last = null;
      if (lastCursor != null) {
        last = new URL(context.url);
        last.searchParams.set("cursor", lastCursor);
      }
      collection = new OrderedCollection({
        id: baseUri,
        totalItems: Number(totalItems),
        first,
        last,
      });
    }
  } else {
    const uri = new URL(baseUri);
    uri.searchParams.set("cursor", cursor);
    const page = await collectionCallbacks.dispatcher(
      context,
      identifier,
      cursor,
      filter,
    );
    if (page == null) return await onNotFound(request);
    const { items, prevCursor, nextCursor } = page;
    let prev = null;
    if (prevCursor != null) {
      prev = new URL(context.url);
      prev.searchParams.set("cursor", prevCursor);
    }
    let next = null;
    if (nextCursor != null) {
      next = new URL(context.url);
      next.searchParams.set("cursor", nextCursor);
    }
    const partOf = new URL(context.url);
    partOf.searchParams.delete("cursor");
    collection = new OrderedCollectionPage({
      id: uri,
      prev,
      next,
      items: filterCollectionItems(items, name, filterPredicate),
      partOf,
    });
  }
  if (!acceptsJsonLd(request)) return await onNotAcceptable(request);
  if (collectionCallbacks.authorizePredicate != null) {
    const key = await context.getSignedKey();
    const keyOwner = await context.getSignedKeyOwner();
    if (
      !await collectionCallbacks.authorizePredicate(
        context,
        identifier,
        key,
        keyOwner,
      )
    ) {
      return await onUnauthorized(request);
    }
  }
  const jsonLd = await collection.toJsonLd(context);
  return new Response(JSON.stringify(jsonLd), {
    headers: {
      "Content-Type": "application/activity+json",
      Vary: "Accept",
    },
  });
}

function filterCollectionItems<TItem extends Object | Link | Recipient | URL>(
  items: TItem[],
  collectionName: string,
  filterPredicate?: (item: TItem) => boolean,
): (Object | Link | URL)[] {
  const result: (Object | Link | URL)[] = [];
  let logged = false;
  for (const item of items) {
    let mappedItem: Object | Link | URL;
    if (item instanceof Object || item instanceof Link || item instanceof URL) {
      mappedItem = item;
    } else if (item.id == null) continue;
    else mappedItem = item.id;
    if (filterPredicate != null && !filterPredicate(item)) {
      if (!logged) {
        getLogger(["fedify", "federation", "collection"]).warn(
          `The ${collectionName} collection apparently does not implement ` +
            "filtering.  This may result in a large response payload.  " +
            "Please consider implementing filtering for the collection.",
        );
        logged = true;
      }
      continue;
    }
    result.push(mappedItem);
  }
  return result;
}

export interface InboxHandlerParameters<TContextData> {
  recipient: string | null;
  context: RequestContext<TContextData>;
  inboxContextFactory(
    recipient: string | null,
    activity: unknown,
  ): InboxContext<TContextData>;
  kv: KvStore;
  kvPrefixes: {
    activityIdempotence: KvKey;
    publicKey: KvKey;
  };
  queue?: MessageQueue;
  actorDispatcher?: ActorDispatcher<TContextData>;
  inboxListeners?: InboxListenerSet<TContextData>;
  inboxErrorHandler?: InboxErrorHandler<TContextData>;
  onNotFound(request: Request): Response | Promise<Response>;
  signatureTimeWindow: Temporal.Duration | Temporal.DurationLike | false;
  skipSignatureVerification: boolean;
}

export async function handleInbox<TContextData>(
  request: Request,
  {
    recipient,
    context,
    inboxContextFactory,
    kv,
    kvPrefixes,
    queue,
    actorDispatcher,
    inboxListeners,
    inboxErrorHandler,
    onNotFound,
    signatureTimeWindow,
    skipSignatureVerification,
  }: InboxHandlerParameters<TContextData>,
): Promise<Response> {
  const logger = getLogger(["fedify", "federation", "inbox"]);
  if (actorDispatcher == null) {
    logger.error("Actor dispatcher is not set.", { recipient });
    return await onNotFound(request);
  } else if (recipient != null) {
    const actor = await actorDispatcher(context, recipient);
    if (actor == null) {
      logger.error("Actor {recipient} not found.", { recipient });
      return await onNotFound(request);
    }
  }
  let json: unknown;
  try {
    json = await request.clone().json();
  } catch (error) {
    logger.error("Failed to parse JSON:\n{error}", { recipient, error });
    try {
      await inboxErrorHandler?.(context, error as Error);
    } catch (error) {
      logger.error(
        "An unexpected error occurred in inbox error handler:\n{error}",
        { error, activity: json, recipient },
      );
    }
    return new Response("Invalid JSON.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const keyCache: KeyCache = {
    async get(keyId: URL) {
      const serialized = await kv.get([
        ...kvPrefixes.publicKey,
        keyId.href,
      ]);
      if (serialized == null) return null;
      let object: Object;
      try {
        object = await Object.fromJsonLd(serialized, context);
      } catch {
        return null;
      }
      if (object instanceof CryptographicKey || object instanceof Multikey) {
        return object;
      }
      return null;
    },
    async set(keyId: URL, key: CryptographicKey | Multikey) {
      const serialized = await key.toJsonLd(context);
      await kv.set([...kvPrefixes.publicKey, keyId.href], serialized);
    },
  };
  const ldSigVerified = await verifyJsonLd(json, {
    contextLoader: context.contextLoader,
    documentLoader: context.documentLoader,
    keyCache,
  });
  const jsonWithoutSig = detachSignature(json);
  let activity: Activity | null = null;
  if (ldSigVerified) {
    logger.debug("Linked Data Signatures are verified.", { recipient, json });
    activity = await Activity.fromJsonLd(jsonWithoutSig, context);
  } else {
    logger.debug(
      "Linked Data Signatures are not verified.",
      { recipient, json },
    );
    try {
      activity = await verifyObject(Activity, jsonWithoutSig, {
        contextLoader: context.contextLoader,
        documentLoader: context.documentLoader,
        keyCache,
      });
    } catch (error) {
      logger.error("Failed to parse activity:\n{error}", {
        recipient,
        activity: json,
        error,
      });
      try {
        await inboxErrorHandler?.(context, error as Error);
      } catch (error) {
        logger.error(
          "An unexpected error occurred in inbox error handler:\n{error}",
          { error, activity: json, recipient },
        );
      }
      return new Response("Invalid activity.", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (activity == null) {
      logger.debug(
        "Object Integrity Proofs are not verified.",
        { recipient, activity: json },
      );
    } else {
      logger.debug(
        "Object Integrity Proofs are verified.",
        { recipient, activity: json },
      );
    }
  }
  let httpSigKey: CryptographicKey | null = null;
  if (activity == null) {
    if (!skipSignatureVerification) {
      const key = await verifyRequest(request, {
        contextLoader: context.contextLoader,
        documentLoader: context.documentLoader,
        timeWindow: signatureTimeWindow,
        keyCache,
      });
      if (key == null) {
        logger.error(
          "Failed to verify the request's HTTP Signatures.",
          { recipient },
        );
        const response = new Response(
          "Failed to verify the request signature.",
          {
            status: 401,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          },
        );
        return response;
      } else {
        logger.debug("HTTP Signatures are verified.", { recipient });
      }
      httpSigKey = key;
    }
    activity = await Activity.fromJsonLd(jsonWithoutSig, context);
  }
  const cacheKey = activity.id == null
    ? null
    : [...kvPrefixes.activityIdempotence, activity.id.href] satisfies KvKey;
  if (cacheKey != null) {
    const cached = await kv.get(cacheKey);
    if (cached === true) {
      logger.debug("Activity {activityId} has already been processed.", {
        activityId: activity.id?.href,
        activity: json,
        recipient,
      });
      return new Response(
        `Activity <${activity.id}> has already been processed.`,
        {
          status: 202,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }
  }
  if (activity.actorId == null) {
    logger.error("Missing actor.", { activity: json });
    const response = new Response("Missing actor.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    return response;
  }
  if (
    httpSigKey != null && !await doesActorOwnKey(activity, httpSigKey, context)
  ) {
    logger.error(
      "The signer ({keyId}) and the actor ({actorId}) do not match.",
      {
        activity: json,
        recipient,
        keyId: httpSigKey.id?.href,
        actorId: activity.actorId.href,
      },
    );
    const response = new Response("The signer and the actor do not match.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    return response;
  }
  if (queue != null) {
    await queue.enqueue(
      {
        type: "inbox",
        id: crypto.randomUUID(),
        baseUrl: request.url,
        activity: json,
        identifier: recipient,
        attempt: 0,
        started: new Date().toISOString(),
      } satisfies InboxMessage,
    );
    logger.info(
      "Activity {activityId} is enqueued.",
      { activityId: activity.id?.href, activity: json, recipient },
    );
    return new Response("Activity is enqueued.", {
      status: 202,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const listener = inboxListeners?.dispatch(activity);
  if (listener == null) {
    logger.error(
      "Unsupported activity type:\n{activity}",
      { activity: json, recipient },
    );
    return new Response("", {
      status: 202,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  try {
    await listener(inboxContextFactory(recipient, json), activity);
  } catch (error) {
    try {
      await inboxErrorHandler?.(context, error as Error);
    } catch (error) {
      logger.error(
        "An unexpected error occurred in inbox error handler:\n{error}",
        {
          error,
          activityId: activity.id?.href,
          activity: json,
          recipient,
        },
      );
    }
    logger.error(
      "Failed to process the incoming activity {activityId}:\n{error}",
      {
        error,
        activityId: activity.id?.href,
        activity: json,
        recipient,
      },
    );
    return new Response("Internal server error.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (cacheKey != null) {
    await kv.set(cacheKey, true, { ttl: Temporal.Duration.from({ days: 1 }) });
  }
  logger.info(
    "Activity {activityId} has been processed.",
    { activityId: activity.id?.href, activity: json, recipient },
  );
  return new Response("", {
    status: 202,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Options for the {@link respondWithObject} and
 * {@link respondWithObjectIfAcceptable} functions.
 * @since 0.3.0
 */
export interface RespondWithObjectOptions {
  /**
   * The document loader to use for compacting JSON-LD.
   * @since 0.8.0
   */
  contextLoader: DocumentLoader;
}

/**
 * Responds with the given object in JSON-LD format.
 *
 * @param object The object to respond with.
 * @param options Options.
 * @since 0.3.0
 */
export async function respondWithObject(
  object: Object,
  options?: RespondWithObjectOptions,
): Promise<Response> {
  const jsonLd = await object.toJsonLd(options);
  return new Response(JSON.stringify(jsonLd), {
    headers: {
      "Content-Type": "application/activity+json",
    },
  });
}

/**
 * Responds with the given object in JSON-LD format if the request accepts
 * JSON-LD.
 *
 * @param object The object to respond with.
 * @param request The request to check for JSON-LD acceptability.
 * @param options Options.
 * @since 0.3.0
 */
export async function respondWithObjectIfAcceptable(
  object: Object,
  request: Request,
  options?: RespondWithObjectOptions,
): Promise<Response | null> {
  if (!acceptsJsonLd(request)) return null;
  const response = await respondWithObject(object, options);
  response.headers.set("Vary", "Accept");
  return response;
}
