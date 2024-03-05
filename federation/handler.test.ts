import { assert, assertEquals, assertFalse } from "jsr:@std/assert@^0.218.2";
import { createRequestContext } from "../testing/context.ts";
import { Person } from "../vocab/vocab.ts";
import { ActorDispatcher } from "./callback.ts";
import { acceptsJsonLd, handleActor } from "./handler.ts";

Deno.test("acceptsJsonLd()", () => {
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

Deno.test("handleActor()", async () => {
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
  let response = await handleActor(
    context.request,
    {
      context,
      handle: "someone",
      onNotFound,
      onNotAcceptable,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);

  onNotFoundCalled = null;
  response = await handleActor(
    context.request,
    {
      context,
      handle: "someone",
      actorDispatcher,
      onNotFound,
      onNotAcceptable,
    },
  );
  assertEquals(response.status, 406);
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, context.request);

  onNotAcceptableCalled = null;
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
    },
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      {
        discoverable: "toot:discoverable",
        indexable: "toot:indexable",
        memorial: "toot:memorial",
        suspended: "toot:suspended",
        toot: "http://joinmastodon.org/ns#",
      },
    ],
    id: "https://example.com/users/someone",
    type: "Person",
    name: "Someone",
  });
  assertEquals(onNotFoundCalled, null);
  assertEquals(onNotAcceptableCalled, null);

  response = await handleActor(
    context.request,
    {
      context,
      handle: "no-one",
      actorDispatcher,
      onNotFound,
      onNotAcceptable,
    },
  );
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, context.request);
  assertEquals(onNotAcceptableCalled, null);
});
