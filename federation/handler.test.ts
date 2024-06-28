import { assert, assertEquals, assertFalse } from "@std/assert";
import { createRequestContext } from "../testing/context.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { rsaPublicKey2 } from "../testing/keys.ts";
import { test } from "../testing/mod.ts";
import {
  type Activity,
  Create,
  Note,
  type Object,
  Person,
} from "../vocab/vocab.ts";
import type {
  ActorDispatcher,
  CollectionCounter,
  CollectionCursor,
  CollectionDispatcher,
  ObjectDispatcher,
} from "./callback.ts";
import {
  acceptsJsonLd,
  handleActor,
  handleCollection,
  handleObject,
  respondWithObject,
  respondWithObjectIfAcceptable,
} from "./handler.ts";

test("acceptsJsonLd()", () => {
  assert(acceptsJsonLd(
    new Request("https://example.com/", {
      headers: { Accept: "application/activity+json" },
    }),
  ));
  assert(acceptsJsonLd(
    new Request("https://example.com/", {
      headers: { Accept: "application/ld+json" },
    }),
  ));
  assert(acceptsJsonLd(
    new Request("https://example.com/", {
      headers: { Accept: "application/json" },
    }),
  ));
  assertFalse(acceptsJsonLd(
    new Request("https://example.com/", {
      headers: { Accept: "application/ld+json; q=0.5, text/html; q=0.8" },
    }),
  ));
  assertFalse(acceptsJsonLd(
    new Request("https://example.com/", {
      headers: {
        Accept: "application/ld+json; q=0.4, application/xhtml+xml; q=0.9",
      },
    }),
  ));
});

test("handleActor()", async () => {
  let context = createRequestContext<void>({
    data: undefined,
    url: new URL("https://example.com/"),
    getActorUri(handle) {
      return new URL(`https://example.com/users/${handle}`);
    },
  });
  const actorDispatcher: ActorDispatcher<void> = (ctx, handle, _key) => {
    if (handle !== "someone") return null;
    return new Person({
      id: ctx.getActorUri(handle),
      name: "Someone",
    });
  };
  let onNotFoundCalled: Request | null = null;
  const onNotFound = (request: Request) => {
    onNotFoundCalled = request;
    return new Response("Not found", { status: 404 });
  };
  let onNotAcceptableCalled: Request | null = null;
  const onNotAcceptable = (request: Request) => {
    onNotAcceptableCalled = request;
    return new Response("Not acceptable", { status: 406 });
  };
  let onUnauthorizedCalled: Request | null = null;
  const onUnauthorized = (request: Request) => {
    onUnauthorizedCalled = request;
    return new Response("Unauthorized", { status: 401 });
  };
  let response = await handleActor(
    context.request,
    {
      context,
      handle: "someone",
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  context = createRequestContext<void>({
    ...context,
    getActor(handle) {
      return Promise.resolve(actorDispatcher(context, handle, null));
    },
  });
  response = await handleActor(
    context.request,
    {
      context,
      handle: "someone",
      actorDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 406);
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, context.request);
  assertEquals(onUnauthorizedCalled, null);

  onNotAcceptableCalled = null;
  response = await handleActor(
    context.request,
    {
      context,
      handle: "no-one",
      actorDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  context = createRequestContext<void>({
    ...context,
    request: new Request(context.url, {
      headers: {
        Accept: "application/activity+json",
      },
    }),
  });
  response = await handleActor(
    context.request,
    {
      context,
      handle: "someone",
      actorDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      "https://w3id.org/security/data-integrity/v1",
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/multikey/v1",
      {
        manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
        featured: {
          "@id": "toot:featured",
          "@type": "@id",
        },
        featuredTags: {
          "@id": "toot:featuredTags",
          "@type": "@id",
        },
        discoverable: "toot:discoverable",
        indexable: "toot:indexable",
        memorial: "toot:memorial",
        suspended: "toot:suspended",
        toot: "http://joinmastodon.org/ns#",
        schema: "http://schema.org#",
        PropertyValue: "schema:PropertyValue",
        value: "schema:value",
      },
    ],
    id: "https://example.com/users/someone",
    type: "Person",
    name: "Someone",
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  response = await handleActor(
    context.request,
    {
      context,
      handle: "no-one",
      actorDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  response = await handleActor(
    context.request,
    {
      context,
      handle: "someone",
      actorDispatcher,
      authorizePredicate: (_ctx, _handle, signedKey, signedKeyOwner) =>
        signedKey != null && signedKeyOwner != null,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 401);
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, context.request);

  onUnauthorizedCalled = null;
  context = createRequestContext<void>({
    ...context,
    getSignedKey: () => Promise.resolve(rsaPublicKey2),
    getSignedKeyOwner: () => Promise.resolve(new Person({})),
  });
  response = await handleActor(
    context.request,
    {
      context,
      handle: "someone",
      actorDispatcher,
      authorizePredicate: (_ctx, _handle, signedKey, signedKeyOwner) =>
        signedKey != null && signedKeyOwner != null,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      "https://w3id.org/security/data-integrity/v1",
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/multikey/v1",
      {
        manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
        featured: {
          "@id": "toot:featured",
          "@type": "@id",
        },
        featuredTags: {
          "@id": "toot:featuredTags",
          "@type": "@id",
        },
        discoverable: "toot:discoverable",
        indexable: "toot:indexable",
        memorial: "toot:memorial",
        suspended: "toot:suspended",
        toot: "http://joinmastodon.org/ns#",
        schema: "http://schema.org#",
        PropertyValue: "schema:PropertyValue",
        value: "schema:value",
      },
    ],
    id: "https://example.com/users/someone",
    type: "Person",
    name: "Someone",
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);
});

test("handleObject()", async () => {
  let context = createRequestContext<void>({
    data: undefined,
    url: new URL("https://example.com/"),
    getObjectUri(_cls, values) {
      return new URL(
        `https://example.com/users/${values.handle}/notes/${values.id}`,
      );
    },
  });
  const objectDispatcher: ObjectDispatcher<void, Object, string> = (
    ctx,
    values,
  ) => {
    if (values.handle !== "someone" || values.id !== "123") return null;
    return new Note({
      id: ctx.getObjectUri(Note, values),
      summary: "Hello, world!",
    });
  };
  let onNotFoundCalled: Request | null = null;
  const onNotFound = (request: Request) => {
    onNotFoundCalled = request;
    return new Response("Not found", { status: 404 });
  };
  let onNotAcceptableCalled: Request | null = null;
  const onNotAcceptable = (request: Request) => {
    onNotAcceptableCalled = request;
    return new Response("Not acceptable", { status: 406 });
  };
  let onUnauthorizedCalled: Request | null = null;
  const onUnauthorized = (request: Request) => {
    onUnauthorizedCalled = request;
    return new Response("Unauthorized", { status: 401 });
  };
  let response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "someone", id: "123" },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "someone", id: "123" },
      objectDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 406);
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, context.request);
  assertEquals(onUnauthorizedCalled, null);

  onNotAcceptableCalled = null;
  response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "no-one", id: "123" },
      objectDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "someone", id: "not-exist" },
      objectDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  context = createRequestContext<void>({
    ...context,
    request: new Request(context.url, {
      headers: {
        Accept: "application/activity+json",
      },
    }),
  });
  response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "someone", id: "123" },
      objectDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    id: "https://example.com/users/someone/notes/123",
    summary: "Hello, world!",
    type: "Note",
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "no-one", id: "123" },
      objectDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "someone", id: "not-exist" },
      objectDispatcher,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "someone", id: "123" },
      objectDispatcher,
      authorizePredicate: (_ctx, _values, signedKey, signedKeyOwner) =>
        signedKey != null && signedKeyOwner != null,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 401);
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, context.request);

  onUnauthorizedCalled = null;
  context = createRequestContext<void>({
    ...context,
    getSignedKey: () => Promise.resolve(rsaPublicKey2),
    getSignedKeyOwner: () => Promise.resolve(new Person({})),
  });
  response = await handleObject(
    context.request,
    {
      context,
      values: { handle: "someone", id: "123" },
      objectDispatcher,
      authorizePredicate: (_ctx, _values, signedKey, signedKeyOwner) =>
        signedKey != null && signedKeyOwner != null,
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    id: "https://example.com/users/someone/notes/123",
    summary: "Hello, world!",
    type: "Note",
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);
});

test("handleCollection()", async () => {
  let context = createRequestContext<void>({
    data: undefined,
    url: new URL("https://example.com/"),
    getActorUri(handle) {
      return new URL(`https://example.com/users/${handle}`);
    },
  });
  const dispatcher: CollectionDispatcher<Activity, void, void> = (
    _ctx,
    handle,
    cursor,
  ) => {
    if (handle !== "someone") return null;
    const items = [
      new Create({ id: new URL("https://example.com/activities/1") }),
      new Create({ id: new URL("https://example.com/activities/2") }),
      new Create({ id: new URL("https://example.com/activities/3") }),
    ];
    if (cursor != null) {
      const idx = parseInt(cursor);
      return {
        items: [items[idx]],
        nextCursor: idx < items.length - 1 ? (idx + 1).toString() : null,
        prevCursor: idx > 0 ? (idx - 1).toString() : null,
      };
    }
    return { items };
  };
  const counter: CollectionCounter<void, void> = (_ctx, handle) =>
    handle === "someone" ? 3 : null;
  const firstCursor: CollectionCursor<void, void> = (_ctx, handle) =>
    handle === "someone" ? "0" : null;
  const lastCursor: CollectionCursor<void, void> = (_ctx, handle) =>
    handle === "someone" ? "2" : null;
  let onNotFoundCalled: Request | null = null;
  const onNotFound = (request: Request) => {
    onNotFoundCalled = request;
    return new Response("Not found", { status: 404 });
  };
  let onNotAcceptableCalled: Request | null = null;
  const onNotAcceptable = (request: Request) => {
    onNotAcceptableCalled = request;
    return new Response("Not acceptable", { status: 406 });
  };
  let onUnauthorizedCalled: Request | null = null;
  const onUnauthorized = (request: Request) => {
    onUnauthorizedCalled = request;
    return new Response("Unauthorized", { status: 401 });
  };
  let response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "someone",
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "someone",
      collectionCallbacks: { dispatcher },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 406);
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, context.request);
  assertEquals(onUnauthorizedCalled, null);

  onNotAcceptableCalled = null;
  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "no-one",
      collectionCallbacks: { dispatcher },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  context = createRequestContext<void>({
    ...context,
    request: new Request(context.url, {
      headers: {
        Accept: "application/activity+json",
      },
    }),
  });
  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "no-one",
      collectionCallbacks: { dispatcher },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  onNotFoundCalled = null;
  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "someone",
      collectionCallbacks: { dispatcher },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    type: "OrderedCollection",
    orderedItems: [
      { type: "Create", id: "https://example.com/activities/1" },
      { type: "Create", id: "https://example.com/activities/2" },
      { type: "Create", id: "https://example.com/activities/3" },
    ],
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "someone",
      collectionCallbacks: {
        dispatcher,
        authorizePredicate: (_ctx, _handle, key, keyOwner) =>
          key != null && keyOwner != null,
      },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 401);
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, context.request);

  onUnauthorizedCalled = null;
  context = createRequestContext<void>({
    ...context,
    getSignedKey: () => Promise.resolve(rsaPublicKey2),
    getSignedKeyOwner: () => Promise.resolve(new Person({})),
  });
  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "someone",
      collectionCallbacks: {
        dispatcher,
        authorizePredicate: (_ctx, _handle, key, keyOwner) =>
          key != null && keyOwner != null,
      },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    type: "OrderedCollection",
    orderedItems: [
      { type: "Create", id: "https://example.com/activities/1" },
      { type: "Create", id: "https://example.com/activities/2" },
      { type: "Create", id: "https://example.com/activities/3" },
    ],
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "someone",
      collectionCallbacks: {
        dispatcher,
        counter,
        firstCursor,
        lastCursor,
      },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    type: "OrderedCollection",
    totalItems: 3,
    first: "https://example.com/?cursor=0",
    last: "https://example.com/?cursor=2",
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  let url = new URL("https://example.com/?cursor=0");
  context = createRequestContext({
    ...context,
    url,
    request: new Request(url, {
      headers: {
        Accept: "application/activity+json",
      },
    }),
  });
  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "someone",
      collectionCallbacks: {
        dispatcher,
        counter,
        firstCursor,
        lastCursor,
      },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    type: "OrderedCollectionPage",
    partOf: "https://example.com/",
    next: "https://example.com/?cursor=1",
    orderedItems: [{
      id: "https://example.com/activities/1",
      type: "Create",
    }],
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);

  url = new URL("https://example.com/?cursor=2");
  context = createRequestContext({
    ...context,
    url,
    request: new Request(url, {
      headers: {
        Accept: "application/activity+json",
      },
    }),
  });
  response = await handleCollection(
    context.request,
    {
      context,
      name: "collection",
      handle: "someone",
      collectionCallbacks: {
        dispatcher,
        counter,
        firstCursor,
        lastCursor,
      },
      onNotFound,
      onNotAcceptable,
      onUnauthorized,
    },
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    type: "OrderedCollectionPage",
    partOf: "https://example.com/",
    prev: "https://example.com/?cursor=1",
    orderedItems: [{
      id: "https://example.com/activities/3",
      type: "Create",
    }],
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);
  assertEquals(onUnauthorizedCalled, null);
});

test("respondWithObject()", async () => {
  const response = await respondWithObject(
    new Note({
      id: new URL("https://example.com/notes/1"),
      content: "Hello, world!",
    }),
    { contextLoader: mockDocumentLoader },
  );
  assert(response.ok);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    id: "https://example.com/notes/1",
    type: "Note",
    content: "Hello, world!",
  });
});

test("respondWithObjectIfAcceptable", async () => {
  let request = new Request("https://example.com/", {
    headers: { Accept: "application/activity+json" },
  });
  let response = await respondWithObjectIfAcceptable(
    new Note({
      id: new URL("https://example.com/notes/1"),
      content: "Hello, world!",
    }),
    request,
    { contextLoader: mockDocumentLoader },
  );
  assert(response != null);
  assert(response.ok);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/activity+json",
  );
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/data-integrity/v1",
      {
        Emoji: "toot:Emoji",
        Hashtag: "as:Hashtag",
        sensitive: "as:sensitive",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    id: "https://example.com/notes/1",
    type: "Note",
    content: "Hello, world!",
  });

  request = new Request("https://example.com/", {
    headers: { Accept: "text/html" },
  });
  response = await respondWithObjectIfAcceptable(
    new Note({
      id: new URL("https://example.com/notes/1"),
      content: "Hello, world!",
    }),
    request,
    { contextLoader: mockDocumentLoader },
  );
  assertEquals(response, null);
});
