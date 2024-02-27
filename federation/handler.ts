import { accepts } from "https://deno.land/std@0.217.0/http/mod.ts";
import {
  ActorDispatcher,
  InboxListener,
  OutboxCounter,
  OutboxCursor,
  OutboxDispatcher,
} from "./callback.ts";
import { Context } from "./context.ts";
import { verify } from "../httpsig/mod.ts";
import { DocumentLoader } from "../runtime/docloader.ts";
import { isActor } from "../vocab/actor.ts";
import {
  Activity,
  OrderedCollection,
  OrderedCollectionPage,
} from "../vocab/mod.ts";

function acceptsJsonLd(request: Request): boolean {
  const types = accepts(request);
  if (types == null) return true;
  if (types[0] === "text/html" || types[0] === "application/xhtml+xml") {
    return false;
  }
  return types.includes("application/ld+json") ||
    types.includes("application/json");
}

export interface ActorHandlerParameters<TContextData> {
  handle: string;
  context: Context<TContextData>;
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
  const actor = await actorDispatcher(context, handle);
  if (actor == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  const jsonLd = await actor.toJsonLd({ documentLoader });
  return new Response(JSON.stringify(jsonLd), {
    headers: {
      "Content-Type":
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
      Vary: "Accept",
    },
  });
}

export interface OutboxHandlerParameters<TContextData> {
  handle: string;
  context: Context<TContextData>;
  documentLoader: DocumentLoader;
  outboxDispatcher?: OutboxDispatcher<TContextData>;
  outboxCounter?: OutboxCounter<TContextData>;
  outboxFirstCursor?: OutboxCursor<TContextData>;
  outboxLastCursor?: OutboxCursor<TContextData>;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

export async function handleOutbox<TContextData>(
  request: Request,
  {
    handle,
    context,
    documentLoader,
    outboxCounter,
    outboxFirstCursor,
    outboxLastCursor,
    outboxDispatcher,
    onNotFound,
    onNotAcceptable,
  }: OutboxHandlerParameters<TContextData>,
): Promise<Response> {
  if (outboxDispatcher == null) {
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
    const firstCursorPromise = outboxFirstCursor?.(context, handle);
    const firstCursor = firstCursorPromise instanceof Promise
      ? await firstCursorPromise
      : firstCursorPromise;
    const totalItemsPromise = outboxCounter?.(context, handle);
    const totalItems = totalItemsPromise instanceof Promise
      ? await totalItemsPromise
      : totalItemsPromise;
    if (firstCursor == null) {
      const pagePromise = outboxDispatcher(context, handle, null);
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
      const lastCursorPromise = outboxLastCursor?.(context, handle);
      const lastCursor = lastCursorPromise instanceof Promise
        ? await lastCursorPromise
        : lastCursorPromise;
      collection = new OrderedCollection({
        totalItems: Number(totalItems),
        first: new URL(
          `${context.getOutboxUri(handle).href}?cursor=${
            encodeURIComponent(firstCursor)
          }`,
        ),
        last: lastCursor == null ? null : new URL(
          `${context.getOutboxUri(handle).href}?cursor=${
            encodeURIComponent(lastCursor)
          }`,
        ),
      });
    }
  } else {
    const pagePromise = outboxDispatcher(context, handle, cursor);
    const page = pagePromise instanceof Promise
      ? await pagePromise
      : pagePromise;
    if (page == null) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
    const { items, prevCursor, nextCursor } = page;
    collection = new OrderedCollectionPage({
      prev: prevCursor == null ? null : new URL(
        `${context.getOutboxUri(handle).href}?cursor=${
          encodeURIComponent(prevCursor)
        }`,
      ),
      next: nextCursor == null ? null : new URL(
        `${context.getOutboxUri(handle).href}?cursor=${
          encodeURIComponent(nextCursor)
        }`,
      ),
      items,
    });
  }
  const jsonLd = await collection.toJsonLd({ documentLoader });
  return new Response(JSON.stringify(jsonLd), {
    headers: {
      "Content-Type":
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
      Vary: "Accept",
    },
  });
}

export interface InboxHandlerParameters<TContextData> {
  handle: string;
  context: Context<TContextData>;
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
  } else {
    const promise = actorDispatcher(context, handle);
    const actor = promise instanceof Promise ? await promise : promise;
    if (actor == null) {
      const response = onNotFound(request);
      return response instanceof Promise ? await response : response;
    }
  }
  const keyId = await verify(request, documentLoader);
  if (keyId == null) {
    const response = new Response("Failed to verify the reuqest signature.", {
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
    cls = Object.getPrototypeOf(cls);
  }
  const listener = inboxListeners.get(cls)!;
  const promise = listener(context, activity);
  if (promise instanceof Promise) await promise;
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
