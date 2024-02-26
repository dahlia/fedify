import { OrderedCollection, OrderedCollectionPage } from "../vocab/mod.ts";
import {
  ActorDispatcher,
  OutboxCounter,
  OutboxCursor,
  OutboxDispatcher,
} from "./callback.ts";
import { Context } from "./context.ts";
import { Router } from "./router.ts";
import { accepts } from "https://deno.land/std@0.217.0/http/mod.ts";

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
  router: Router;
  contextData: TContextData;
  actorDispatcher?: ActorDispatcher<TContextData>;
  onNotFound(request: Request): Response | Promise<Response>;
  onNotAcceptable(request: Request): Response | Promise<Response>;
}

export async function handleActor<TContextData>(
  request: Request,
  {
    handle,
    router,
    contextData,
    actorDispatcher,
    onNotFound,
    onNotAcceptable,
  }: ActorHandlerParameters<TContextData>,
) {
  if (actorDispatcher == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  if (!acceptsJsonLd(request)) {
    const response = onNotAcceptable(request);
    return response instanceof Promise ? await response : response;
  }
  const context = new Context(router, request, contextData);
  const actor = await actorDispatcher(context, handle);
  if (actor == null) {
    const response = onNotFound(request);
    return response instanceof Promise ? await response : response;
  }
  const jsonLd = await actor.toJsonLd();
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
  router: Router;
  contextData: TContextData;
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
    router,
    contextData,
    outboxCounter,
    outboxFirstCursor,
    outboxLastCursor,
    outboxDispatcher,
    onNotFound,
    onNotAcceptable,
  }: OutboxHandlerParameters<TContextData>,
) {
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
  const context = new Context(router, request, contextData);
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
  const jsonLd = await collection.toJsonLd();
  return new Response(JSON.stringify(jsonLd), {
    headers: {
      "Content-Type":
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
      Vary: "Accept",
    },
  });
}
