import { accepts } from "@std/http";
import { doesActorOwnKey, verify } from "../httpsig/mod.ts";
import { DocumentLoader } from "../runtime/docloader.ts";
import {
  Activity,
  Link,
  Object,
  OrderedCollection,
  OrderedCollectionPage,
} from "../vocab/vocab.ts";
import {
  ActorDispatcher,
  CollectionCounter,
  CollectionCursor,
  CollectionDispatcher,
  InboxErrorHandler,
  InboxListener,
} from "./callback.ts";
import { RequestContext } from "./context.ts";

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
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

export async function handleActor<TContextData>(
  request: Request,
  {
    handle,
    context,
    actorDispatcher,
    onNotFound,
    onNotAcceptable,
  }: ActorHandlerParameters<TContextData>,
): Promise<Response> {
  if (actorDispatcher == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  if (!acceptsJsonLd(request)) {
    const response = onNotAcceptable(request);
    return response instanceof Promise ? await response : response;
  }
  const key = await context.getActorKey(handle);
  const actor = await actorDispatcher(context, handle, key);
  if (actor == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
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
}

export interface CollectionHandlerParameters<TItem, TContextData> {
  handle: string;
  context: RequestContext<TContextData>;
  collectionCallbacks?: CollectionCallbacks<TItem, TContextData>;
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
    onNotFound,
    onNotAcceptable,
  }: CollectionHandlerParameters<TItem, TContextData>,
): Promise<Response> {
  if (collectionCallbacks == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  if (!acceptsJsonLd(request)) {
    const response = onNotAcceptable(request);
    return response instanceof Promise ? await response : response;
  }
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  let collection: OrderedCollection | OrderedCollectionPage;
  if (cursor == null) {
    const firstCursorPromise = collectionCallbacks.firstCursor?.(
      context,
      handle,
    );
    const firstCursor = firstCursorPromise instanceof Promise
      ? await firstCursorPromise
      : firstCursorPromise;
    const totalItemsPromise = collectionCallbacks.counter?.(context, handle);
    const totalItems = totalItemsPromise instanceof Promise
      ? await totalItemsPromise
      : totalItemsPromise;
    if (firstCursor == null) {
      const pagePromise = collectionCallbacks.dispatcher(context, handle, null);
      const page = pagePromise instanceof Promise
        ? await pagePromise
        : pagePromise;
      if (page == null) {
        const response = onNotFound(request);
        return response instanceof Promise ? await response : response;
      }
      const { items } = page;
      collection = new OrderedCollection({
        totalItems: totalItems == null ? null : Number(totalItems),
        items,
      });
    } else {
      const lastCursorPromise = collectionCallbacks.lastCursor?.(
        context,
        handle,
      );
      const lastCursor = lastCursorPromise instanceof Promise
        ? await lastCursorPromise
        : lastCursorPromise;
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
    const pagePromise = collectionCallbacks.dispatcher(context, handle, cursor);
    const page = pagePromise instanceof Promise
      ? await pagePromise
      : pagePromise;
    if (page == null) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
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
  kv: Deno.Kv;
  kvPrefix: Deno.KvKey;
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
  if (actorDispatcher == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  } else if (handle != null) {
    const key = await context.getActorKey(handle);
    const promise = actorDispatcher(context, handle, key);
    const actor = promise instanceof Promise ? await promise : promise;
    if (actor == null) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
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
    const promise = inboxErrorHandler?.(context, e);
    if (promise instanceof Promise) await promise;
    return new Response("Invalid JSON.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  let activity: Activity;
  try {
    activity = await Activity.fromJsonLd(json, context);
  } catch (e) {
    const promise = inboxErrorHandler?.(context, e);
    if (promise instanceof Promise) await promise;
    return new Response("Invalid activity.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const cacheKey = activity.id == null ? null : [...kvPrefix, activity.id.href];
  if (cacheKey != null) {
    const cached = await kv.get(cacheKey);
    if (cached != null && cached.value === true) {
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
    const promise = listener(context, activity);
    if (promise instanceof Promise) await promise;
  } catch (e) {
    const promise = inboxErrorHandler?.(context, e);
    if (promise instanceof Promise) await promise;
    return new Response("Internal server error.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (cacheKey != null) {
    await kv.set(cacheKey, true, { expireIn: 1000 * 60 * 60 * 24 });
  }
  return new Response("", {
    status: 202,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Options for the {@link respondWithObject} and
 * {@link respondWithObjectIfAcceptable} functions.
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
