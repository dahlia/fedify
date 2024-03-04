import { accepts } from "jsr:@std/http@^0.218.2";
import {
  ActorDispatcher,
  CollectionCounter,
  CollectionCursor,
  CollectionDispatcher,
  InboxListener,
} from "./callback.ts";
import { RequestContext } from "./context.ts";
import { verify } from "../httpsig/mod.ts";
import { DocumentLoader } from "../runtime/docloader.ts";
import { isActor } from "../vocab/actor.ts";
import {
  Activity,
  Link,
  Object,
  OrderedCollection,
  OrderedCollectionPage,
} from "../vocab/mod.ts";

function acceptsJsonLd(request: Request): boolean {
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
  documentLoader: DocumentLoader;
  actorDispatcher?: ActorDispatcher<TContextData>;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

export async function handleActor<TContextData>(
  request: Request,
  {
    handle,
    context,
    documentLoader,
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
  const jsonLd = await actor.toJsonLd({ documentLoader });
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
  documentLoader: DocumentLoader;
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
    documentLoader,
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
        totalItems: Number(totalItems),
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
    collection = new OrderedCollectionPage({ prev, next, items });
  }
  const jsonLd = await collection.toJsonLd({ documentLoader });
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
  inboxErrorHandler?: (error: Error) => void | Promise<void>;
  documentLoader: DocumentLoader;
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
    documentLoader,
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
  const keyId = await verify(request, documentLoader);
  if (keyId == null) {
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
    const promise = inboxErrorHandler?.(e);
    if (promise instanceof Promise) await promise;
    return new Response("Invalid JSON.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  let activity: Activity;
  try {
    activity = await Activity.fromJsonLd(json, { documentLoader });
  } catch (e) {
    const promise = inboxErrorHandler?.(e);
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
  if (!await doesActorOwnKey(activity, keyId)) {
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
  const promise = listener(context, activity);
  if (promise instanceof Promise) await promise;
  if (cacheKey != null) {
    await kv.set(cacheKey, true, { expireIn: 1000 * 60 * 60 * 24 });
  }
  return new Response("", {
    status: 202,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function doesActorOwnKey(
  activity: Activity,
  keyId: URL,
): Promise<boolean> {
  if (activity.actorId?.href === keyId.href.replace(/#.*$/, "")) return true;
  const actor = await activity.getActor();
  if (actor == null || !isActor(actor)) return false;
  for (const publicKeyId of actor.publicKeyIds) {
    if (publicKeyId.href === keyId.href) return true;
  }
  return false;
}
