import { Temporal } from "@js-temporal/polyfill";
import { accepts } from "@std/http/negotiation";
import { doesActorOwnKey, verify } from "../httpsig/mod.ts";
import type { DocumentLoader } from "../runtime/docloader.ts";
import {
  Activity,
  type Link,
  type Object,
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
  InboxListener,
} from "./callback.ts";
import type { RequestContext } from "./context.ts";
import type { KvKey, KvStore } from "./kv.ts";

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
  handle: string;
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
    handle,
    context,
    actorDispatcher,
    authorizePredicate,
    onNotFound,
    onNotAcceptable,
    onUnauthorized,
  }: ActorHandlerParameters<TContextData>,
): Promise<Response> {
  if (actorDispatcher == null) return await onNotFound(request);
  const key = await context.getActorKey(handle);
  const actor = await actorDispatcher(context, handle, key);
  if (actor == null) return await onNotFound(request);
  if (!acceptsJsonLd(request)) return await onNotAcceptable(request);
  if (authorizePredicate != null) {
    const key = await context.getSignedKey();
    const keyOwner = await context.getSignedKeyOwner();
    if (!await authorizePredicate(context, handle, key, keyOwner)) {
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

/**
 * Callbacks for handling a collection.
 */
export interface CollectionCallbacks<TItem, TContextData> {
  /**
   * A callback that dispatches a collection.
   */
  dispatcher: CollectionDispatcher<TItem, TContextData>;

  /**
   * A callback that counts the number of items in a collection.
   */
  counter?: CollectionCounter<TContextData>;

  /**
   * A callback that returns the first cursor for a collection.
   */
  firstCursor?: CollectionCursor<TContextData>;

  /**
   * A callback that returns the last cursor for a collection.
   */
  lastCursor?: CollectionCursor<TContextData>;

  /**
   * A callback that determines if a request is authorized to access the collection.
   */
  authorizePredicate?: AuthorizePredicate<TContextData>;
}

export interface CollectionHandlerParameters<TItem, TContextData> {
  handle: string;
  context: RequestContext<TContextData>;
  collectionCallbacks?: CollectionCallbacks<TItem, TContextData>;
  onUnauthorized(request: Request): Response | Promise<Response>;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

export async function handleCollection<
  TItem extends URL | Object | Link,
  TContextData,
>(
  request: Request,
  {
    handle,
    context,
    collectionCallbacks,
    onUnauthorized,
    onNotFound,
    onNotAcceptable,
  }: CollectionHandlerParameters<TItem, TContextData>,
): Promise<Response> {
  if (collectionCallbacks == null) return await onNotFound(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  let collection: OrderedCollection | OrderedCollectionPage;
  if (cursor == null) {
    const firstCursor = await collectionCallbacks.firstCursor?.(
      context,
      handle,
    );
    const totalItems = await collectionCallbacks.counter?.(context, handle);
    if (firstCursor == null) {
      const page = await collectionCallbacks.dispatcher(context, handle, null);
      if (page == null) return await onNotFound(request);
      const { items } = page;
      collection = new OrderedCollection({
        totalItems: totalItems == null ? null : Number(totalItems),
        items,
      });
    } else {
      const lastCursor = await collectionCallbacks.lastCursor?.(
        context,
        handle,
      );
      const first = new URL(context.url);
      first.searchParams.set("cursor", firstCursor);
      let last = null;
      if (lastCursor != null) {
        last = new URL(context.url);
        last.searchParams.set("cursor", lastCursor);
      }
      collection = new OrderedCollection({
        totalItems: Number(totalItems),
        first,
        last,
      });
    }
  } else {
    const page = await collectionCallbacks.dispatcher(context, handle, cursor);
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
    collection = new OrderedCollectionPage({ prev, next, items, partOf });
  }
  if (!acceptsJsonLd(request)) return await onNotAcceptable(request);
  if (collectionCallbacks.authorizePredicate != null) {
    const key = await context.getSignedKey();
    const keyOwner = await context.getSignedKeyOwner();
    if (
      !await collectionCallbacks.authorizePredicate(
        context,
        handle,
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

export interface InboxHandlerParameters<TContextData> {
  handle: string | null;
  context: RequestContext<TContextData>;
  kv: KvStore;
  kvPrefix: KvKey;
  actorDispatcher?: ActorDispatcher<TContextData>;
  inboxListeners: Map<
    new (...args: unknown[]) => Activity,
    InboxListener<TContextData, Activity>
  >;
  inboxErrorHandler?: InboxErrorHandler<TContextData>;
  onNotFound(request: Request): Response | Promise<Response>;
}

export async function handleInbox<TContextData>(
  request: Request,
  {
    handle,
    context,
    kv,
    kvPrefix,
    actorDispatcher,
    inboxListeners,
    inboxErrorHandler,
    onNotFound,
  }: InboxHandlerParameters<TContextData>,
): Promise<Response> {
  if (actorDispatcher == null) return await onNotFound(request);
  else if (handle != null) {
    const key = await context.getActorKey(handle);
    const actor = await actorDispatcher(context, handle, key);
    if (actor == null) return await onNotFound(request);
  }
  const key = await verify(request, context.documentLoader);
  if (key == null) {
    const response = new Response("Failed to verify the request signature.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    return response;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch (e) {
    await inboxErrorHandler?.(context, e);
    return new Response("Invalid JSON.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  let activity: Activity;
  try {
    activity = await Activity.fromJsonLd(json, context);
  } catch (e) {
    await inboxErrorHandler?.(context, e);
    return new Response("Invalid activity.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const cacheKey = activity.id == null
    ? null
    : [...kvPrefix, activity.id.href] satisfies KvKey;
  if (cacheKey != null) {
    const cached = await kv.get(cacheKey);
    if (cached === true) {
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
    const response = new Response("Missing actor.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    return response;
  }
  if (!await doesActorOwnKey(activity, key, context.documentLoader)) {
    const response = new Response("The signer and the actor do not match.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    return response;
  }
  // deno-lint-ignore no-explicit-any
  let cls: new (...args: any[]) => Activity = activity
    // deno-lint-ignore no-explicit-any
    .constructor as unknown as new (...args: any[]) => Activity;
  while (true) {
    if (inboxListeners.has(cls)) break;
    if (cls === Activity) {
      return new Response("", {
        status: 202,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    cls = globalThis.Object.getPrototypeOf(cls);
  }
  const listener = inboxListeners.get(cls)!;
  try {
    await listener(context, activity);
  } catch (e) {
    await inboxErrorHandler?.(context, e);
    return new Response("Internal server error.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (cacheKey != null) {
    await kv.set(cacheKey, true, { ttl: Temporal.Duration.from({ days: 1 }) });
  }
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
   */
  documentLoader: DocumentLoader;
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
