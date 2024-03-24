import { assertEquals } from "@std/assert";
import { ActorDispatcher } from "../federation/callback.ts";
import { createRequestContext } from "../testing/context.ts";
import { CryptographicKey, Link, Person } from "../vocab/vocab.ts";
import { handleWebFinger } from "./handler.ts";

Deno.test("handleWebFinger()", async () => {
  const url = new URL("https://example.com/.well-known/webfinger");
  const context = createRequestContext<void>({
    url,
    data: undefined,
    getActorUri(handle) {
      return new URL(`https://example.com/users/${handle}`);
    },
    getActorKey(_handle) {
      return Promise.resolve(
        new CryptographicKey({
          id: new URL("https://example.com/keys/someone"),
        }),
      );
    },
    getHandleFromActorUri(uri) {
      if (uri.protocol === "acct:") return null;
      const paths = uri.pathname.split("/");
      return paths[paths.length - 1];
    },
  });
  const actorDispatcher: ActorDispatcher<void> = (ctx, handle, _key) => {
    if (handle !== "someone") return null;
    return new Person({
      id: ctx.getActorUri(handle),
      name: "Someone",
      urls: [
        new URL("https://example.com/@someone"),
        new Link({
          href: new URL("https://example.org/@someone"),
          rel: "alternate",
          mediaType: "text/html",
        }),
      ],
    });
  };
  let onNotFoundCalled: Request | null = null;
  const onNotFound = (request: Request) => {
    onNotFoundCalled = request;
    return new Response("Not found", { status: 404 });
  };

  let request = context.request;
  let response = await handleWebFinger(request, {
    context,
    onNotFound,
  });
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, request);

  onNotFoundCalled = null;
  response = await handleWebFinger(request, {
    context,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 400);
  assertEquals(await response.text(), "Missing resource parameter.");
  assertEquals(onNotFoundCalled, null);

  url.searchParams.set("resource", " invalid ");
  request = new Request(url);
  response = await handleWebFinger(request, {
    context,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 400);
  assertEquals(await response.text(), "Invalid resource URL.");
  assertEquals(onNotFoundCalled, null);

  url.searchParams.set("resource", "acct:someone@example.com");
  request = new Request(url);
  response = await handleWebFinger(request, {
    context,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/jrd+json");
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  const expected = {
    subject: "acct:someone@example.com",
    aliases: [
      "https://example.com/users/someone",
    ],
    links: [
      {
        href: "https://example.com/users/someone",
        rel: "self",
        type: "application/activity+json",
      },
      {
        href: "https://example.com/@someone",
        rel: "http://webfinger.net/rel/profile-page",
      },
      {
        href: "https://example.org/@someone",
        rel: "alternate",
        type: "text/html",
      },
    ],
  };
  assertEquals(await response.json(), expected);

  url.searchParams.set("resource", "https://example.com/users/someone");
  request = new Request(url);
  response = await handleWebFinger(request, {
    context,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), expected);

  url.searchParams.set("resource", "acct:no-one@example.com");
  request = new Request(url);
  response = await handleWebFinger(request, {
    context,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, request);

  onNotFoundCalled = null;
  url.searchParams.set("resource", "https://example.com/users/no-one");
  request = new Request(url);
  response = await handleWebFinger(request, {
    context,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, request);

  onNotFoundCalled = null;
  url.searchParams.set("resource", "https://google.com/");
  request = new Request(url);
  response = await handleWebFinger(request, {
    context,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, request);
});
