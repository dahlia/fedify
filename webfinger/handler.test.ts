import { assertEquals } from "jsr:@std/assert@^0.218.2";
import { ActorDispatcher } from "../federation/callback.ts";
import { RequestContext } from "../federation/context.ts";
import { Router, RouterError } from "../federation/router.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { CryptographicKey, Link, Person } from "../vocab/vocab.ts";
import { handleWebFinger } from "./handler.ts";

Deno.test("handleWebFinger()", async () => {
  const url = new URL("https://example.com/.well-known/webfinger");
  let request = new Request(url);
  const context: RequestContext<void> = {
    url,
    request,
    data: undefined,
    documentLoader: mockDocumentLoader,
    getActorUri(handle) {
      return new URL(`https://example.com/users/${handle}`);
    },
    getOutboxUri(_handle) {
      throw new RouterError("Not implemented");
    },
    getInboxUri(_handle?) {
      throw new RouterError("Not implemented");
    },
    getFollowingUri(_handle) {
      throw new RouterError("Not implemented");
    },
    getFollowersUri(_handle) {
      throw new RouterError("Not implemented");
    },
    getActorKey(_handle) {
      return Promise.resolve(
        new CryptographicKey({
          id: new URL("https://example.com/keys/someone"),
        }),
      );
    },
    sendActivity(_params) {
      throw new Error("Not implemented");
    },
  };
  const router = new Router();
  router.add("/users/{handle}", "actor");
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

  let response = await handleWebFinger(request, {
    context,
    router,
    onNotFound,
  });
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, request);

  onNotFoundCalled = null;
  response = await handleWebFinger(request, {
    context,
    router,
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
    router,
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
    router,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 200);
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
        type: "application/activity+json",
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
    router,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), expected);

  url.searchParams.set("resource", "acct:no-one@example.com");
  request = new Request(url);
  response = await handleWebFinger(request, {
    context,
    router,
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
    router,
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
    router,
    actorDispatcher,
    onNotFound,
  });
  assertEquals(response.status, 404);
  assertEquals(onNotFoundCalled, request);
});
