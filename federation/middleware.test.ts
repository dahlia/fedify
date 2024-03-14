import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { FetchError } from "../runtime/docloader.ts";
import { privateKey2, publicKey2 } from "../testing/keys.ts";
import { Create, Person } from "../vocab/vocab.ts";
import { Federation } from "./middleware.ts";
import { RouterError } from "./router.ts";

Deno.test("Federation.createContext()", async (t) => {
  const kv = await Deno.openKv(":memory:");
  const documentLoader = (url: string) => {
    throw new FetchError(new URL(url), "Not found");
  };

  await t.step("Context", async () => {
    const federation = new Federation<number>({ kv, documentLoader });
    const ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(ctx.data, 123);
    assertStrictEquals(ctx.documentLoader, documentLoader);
    assertThrows(() => ctx.getNodeInfoUri(), RouterError);
    assertThrows(() => ctx.getActorUri("handle"), RouterError);
    assertThrows(() => ctx.getInboxUri(), RouterError);
    assertThrows(() => ctx.getInboxUri("handle"), RouterError);
    assertThrows(() => ctx.getOutboxUri("handle"), RouterError);
    assertThrows(() => ctx.getFollowingUri("handle"), RouterError);
    assertThrows(() => ctx.getFollowersUri("handle"), RouterError);
    assertEquals(
      ctx.getHandleFromActorUri(new URL("https://example.com/")),
      null,
    );
    assertEquals(await ctx.getActorKey("handle"), null);
    assertRejects(
      () => ctx.sendActivity({ handle: "handle" }, [], new Create({})),
      Error,
      "No actor key pair dispatcher registered",
    );

    federation.setNodeInfoDispatcher("/nodeinfo/2.1", () => ({
      software: {
        name: "Example",
        version: { major: 1, minor: 2, patch: 3 },
      },
      protocols: ["activitypub"],
      usage: {
        users: {},
        localPosts: 123,
        localComments: 456,
      },
    }));
    assertEquals(
      ctx.getNodeInfoUri(),
      new URL("https://example.com/nodeinfo/2.1"),
    );

    federation
      .setActorDispatcher("/users/{handle}", () => new Person({}))
      .setKeyPairDispatcher(() => ({
        privateKey: privateKey2,
        publicKey: publicKey2.publicKey!,
      }));
    assertEquals(
      ctx.getActorUri("handle"),
      new URL("https://example.com/users/handle"),
    );
    assertEquals(
      ctx.getHandleFromActorUri(new URL("https://example.com/")),
      null,
    );
    assertEquals(
      ctx.getHandleFromActorUri(new URL("https://example.com/users/handle")),
      "handle",
    );
    assertEquals(
      await ctx.getActorKey("handle"),
      publicKey2.clone({
        id: new URL("https://example.com/users/handle#main-key"),
        owner: new URL("https://example.com/users/handle"),
      }),
    );
    await ctx.sendActivity({ handle: "handle" }, [], new Create({}));

    federation.setInboxListeners("/users/{handle}/inbox", "/inbox");
    assertEquals(ctx.getInboxUri(), new URL("https://example.com/inbox"));
    assertEquals(
      ctx.getInboxUri("handle"),
      new URL("https://example.com/users/handle/inbox"),
    );

    federation.setOutboxDispatcher(
      "/users/{handle}/outbox",
      () => ({ items: [] }),
    );
    assertEquals(
      ctx.getOutboxUri("handle"),
      new URL("https://example.com/users/handle/outbox"),
    );

    federation.setFollowingDispatcher(
      "/users/{handle}/following",
      () => ({ items: [] }),
    );
    assertEquals(
      ctx.getFollowingUri("handle"),
      new URL("https://example.com/users/handle/following"),
    );

    federation.setFollowersDispatcher(
      "/users/{handle}/followers",
      () => ({ items: [] }),
    );
    assertEquals(
      ctx.getFollowersUri("handle"),
      new URL("https://example.com/users/handle/followers"),
    );
  });

  await t.step("RequestContext", () => {
    const federation = new Federation<number>({ kv, documentLoader });
    const req = new Request("https://example.com/");
    const ctx = federation.createContext(req, 123);
    assertEquals(ctx.request, req);
    assertEquals(ctx.url, new URL("https://example.com/"));
    assertEquals(ctx.data, 123);
  });

  kv.close();
});
