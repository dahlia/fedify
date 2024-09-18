import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { dirname, join } from "@std/path";
import * as mf from "mock_fetch";
import {
  fetchDocumentLoader,
  FetchError,
  getAuthenticatedDocumentLoader,
} from "../runtime/docloader.ts";
import { signRequest, verifyRequest } from "../sig/http.ts";
import { detachSignature, signJsonLd, verifyJsonLd } from "../sig/ld.ts";
import { doesActorOwnKey } from "../sig/owner.ts";
import { signObject, verifyObject } from "../sig/proof.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import {
  ed25519Multikey,
  ed25519PrivateKey,
  ed25519PublicKey,
  rsaPrivateKey2,
  rsaPrivateKey3,
  rsaPublicKey2,
  rsaPublicKey3,
} from "../testing/keys.ts";
import { test } from "../testing/mod.ts";
import { lookupObject } from "../vocab/lookup.ts";
import {
  Activity,
  Create,
  Multikey,
  Note,
  Object,
  Person,
} from "../vocab/vocab.ts";
import type { Context } from "./context.ts";
import { MemoryKvStore } from "./kv.ts";
import {
  createFederation,
  FederationImpl,
  InboxContextImpl,
} from "./middleware.ts";
import { RouterError } from "./router.ts";

test("createFederation()", () => {
  const kv = new MemoryKvStore();
  assertThrows(() =>
    createFederation<number>({
      kv,
      documentLoader: mockDocumentLoader,
      allowPrivateAddress: true,
    }), TypeError);
  assertThrows(() =>
    createFederation<number>({
      kv,
      contextLoader: mockDocumentLoader,
      allowPrivateAddress: true,
    }), TypeError);
  assertThrows(() =>
    createFederation<number>({
      kv,
      authenticatedDocumentLoaderFactory: () => mockDocumentLoader,
      allowPrivateAddress: true,
    }), TypeError);
});

test("Federation.createContext()", async (t) => {
  const kv = new MemoryKvStore();
  const documentLoader = (url: string) => {
    throw new FetchError(new URL(url), "Not found");
  };

  mf.install();

  mf.mock("GET@/object", async (req) => {
    const v = await verifyRequest(
      req,
      {
        contextLoader: mockDocumentLoader,
        documentLoader: mockDocumentLoader,
        currentTime: Temporal.Now.instant(),
      },
    );
    return new Response(JSON.stringify(v != null), {
      headers: { "Content-Type": "application/json" },
    });
  });

  await t.step("Context", async () => {
    const federation = createFederation<number>({
      kv,
      documentLoader,
      contextLoader: mockDocumentLoader,
    });
    let ctx = federation.createContext(
      new URL("https://example.com:1234/"),
      123,
    );
    assertEquals(ctx.data, 123);
    assertEquals(ctx.origin, "https://example.com:1234");
    assertEquals(ctx.host, "example.com:1234");
    assertEquals(ctx.hostname, "example.com");
    assertStrictEquals(ctx.documentLoader, documentLoader);
    assertStrictEquals(ctx.contextLoader, mockDocumentLoader);
    assertThrows(() => ctx.getNodeInfoUri(), RouterError);
    assertThrows(() => ctx.getActorUri("handle"), RouterError);
    assertThrows(
      () => ctx.getObjectUri(Note, { handle: "handle", id: "id" }),
      RouterError,
    );
    assertThrows(() => ctx.getInboxUri(), RouterError);
    assertThrows(() => ctx.getInboxUri("handle"), RouterError);
    assertThrows(() => ctx.getOutboxUri("handle"), RouterError);
    assertThrows(() => ctx.getFollowingUri("handle"), RouterError);
    assertThrows(() => ctx.getFollowersUri("handle"), RouterError);
    assertThrows(() => ctx.getLikedUri("handle"), RouterError);
    assertThrows(() => ctx.getFeaturedUri("handle"), RouterError);
    assertThrows(() => ctx.getFeaturedTagsUri("handle"), RouterError);
    assertEquals(ctx.parseUri(new URL("https://example.com/")), null);
    assertEquals(await ctx.getActorKeyPairs("handle"), []);
    assertRejects(
      () => ctx.getDocumentLoader({ handle: "handle" }),
      Error,
      "No actor key pairs dispatcher registered",
    );
    assertRejects(
      () => ctx.sendActivity({ handle: "handle" }, [], new Create({})),
      Error,
      "No actor key pairs dispatcher registered",
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
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getNodeInfoUri(),
      new URL("https://example.com/nodeinfo/2.1"),
    );

    federation
      .setActorDispatcher("/users/{handle}", () => new Person({}))
      .setKeyPairsDispatcher(() => [
        {
          privateKey: rsaPrivateKey2,
          publicKey: rsaPublicKey2.publicKey!,
        },
        {
          privateKey: ed25519PrivateKey,
          publicKey: ed25519PublicKey.publicKey!,
        },
      ]);
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getActorUri("handle"),
      new URL("https://example.com/users/handle"),
    );
    assertEquals(ctx.parseUri(new URL("https://example.com/")), null);
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/handle")),
      { type: "actor", handle: "handle" },
    );
    assertEquals(
      await ctx.getActorKeyPairs("handle"),
      [
        {
          keyId: new URL("https://example.com/users/handle#main-key"),
          privateKey: rsaPrivateKey2,
          publicKey: rsaPublicKey2.publicKey!,
          cryptographicKey: rsaPublicKey2.clone({
            id: new URL("https://example.com/users/handle#main-key"),
            owner: new URL("https://example.com/users/handle"),
          }),
          multikey: new Multikey({
            id: new URL("https://example.com/users/handle#main-key"),
            controller: new URL("https://example.com/users/handle"),
            publicKey: rsaPublicKey2.publicKey!,
          }),
        },
        {
          keyId: new URL("https://example.com/users/handle#key-2"),
          privateKey: ed25519PrivateKey,
          publicKey: ed25519PublicKey.publicKey!,
          cryptographicKey: ed25519PublicKey.clone({
            id: new URL("https://example.com/users/handle#key-2"),
            owner: new URL("https://example.com/users/handle"),
          }),
          multikey: new Multikey({
            id: new URL("https://example.com/users/handle#key-2"),
            controller: new URL("https://example.com/users/handle"),
            publicKey: ed25519PublicKey.publicKey!,
          }),
        },
      ],
    );
    const loader = await ctx.getDocumentLoader({ handle: "handle" });
    assertEquals(await loader("https://example.com/object"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: true,
    });
    const loader2 = ctx.getDocumentLoader({
      keyId: new URL("https://example.com/key2"),
      privateKey: rsaPrivateKey2,
    });
    assertEquals(await loader2("https://example.com/object"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: true,
    });
    assertEquals(await ctx.lookupObject("https://example.com/object"), null);
    assertRejects(
      () => ctx.sendActivity({ handle: "handle" }, [], new Create({})),
      TypeError,
      "The activity to send must have at least one actor property.",
    );
    await ctx.sendActivity(
      { handle: "handle" },
      [],
      new Create({
        actor: new URL("https://example.com/users/handle"),
      }),
    );

    const federation2 = createFederation<number>({
      kv,
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    });
    const ctx2 = federation2.createContext(
      new URL("https://example.com/"),
      123,
    );
    assertEquals(
      await ctx2.lookupObject("https://example.com/object"),
      new Object({
        id: new URL("https://example.com/object"),
        name: "Fetched object",
      }),
    );

    federation.setObjectDispatcher(
      Note,
      "/users/{handle}/notes/{id}",
      (_ctx, values) => {
        return new Note({
          summary: `Note ${values.id} by ${values.handle}`,
        });
      },
    );
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getObjectUri(Note, { handle: "john", id: "123" }),
      new URL("https://example.com/users/john/notes/123"),
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/john/notes/123")),
      {
        type: "object",
        class: Note,
        typeId: new URL("https://www.w3.org/ns/activitystreams#Note"),
        values: { handle: "john", id: "123" },
      },
    );

    federation.setInboxListeners("/users/{handle}/inbox", "/inbox");
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(ctx.getInboxUri(), new URL("https://example.com/inbox"));
    assertEquals(
      ctx.getInboxUri("handle"),
      new URL("https://example.com/users/handle/inbox"),
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/inbox")),
      { type: "inbox" },
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/handle/inbox")),
      { type: "inbox", handle: "handle" },
    );

    federation.setOutboxDispatcher(
      "/users/{handle}/outbox",
      () => ({ items: [] }),
    );
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getOutboxUri("handle"),
      new URL("https://example.com/users/handle/outbox"),
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/handle/outbox")),
      { type: "outbox", handle: "handle" },
    );

    federation.setFollowingDispatcher(
      "/users/{handle}/following",
      () => ({ items: [] }),
    );
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getFollowingUri("handle"),
      new URL("https://example.com/users/handle/following"),
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/handle/following")),
      { type: "following", handle: "handle" },
    );

    federation.setFollowersDispatcher(
      "/users/{handle}/followers",
      () => ({ items: [] }),
    );
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getFollowersUri("handle"),
      new URL("https://example.com/users/handle/followers"),
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/handle/followers")),
      { type: "followers", handle: "handle" },
    );

    federation.setLikedDispatcher(
      "/users/{handle}/liked",
      () => ({ items: [] }),
    );
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getLikedUri("handle"),
      new URL("https://example.com/users/handle/liked"),
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/handle/liked")),
      { type: "liked", handle: "handle" },
    );

    federation.setFeaturedDispatcher(
      "/users/{handle}/featured",
      () => ({ items: [] }),
    );
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getFeaturedUri("handle"),
      new URL("https://example.com/users/handle/featured"),
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/handle/featured")),
      { type: "featured", handle: "handle" },
    );

    federation.setFeaturedTagsDispatcher(
      "/users/{handle}/tags",
      () => ({ items: [] }),
    );
    ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(
      ctx.getFeaturedTagsUri("handle"),
      new URL("https://example.com/users/handle/tags"),
    );
    assertEquals(
      ctx.parseUri(new URL("https://example.com/users/handle/tags")),
      { type: "featuredTags", handle: "handle" },
    );
  });

  await t.step("RequestContext", async () => {
    const federation = createFederation<number>({
      kv,
      documentLoader: mockDocumentLoader,
    });
    const req = new Request("https://example.com/");
    const ctx = federation.createContext(req, 123);
    assertEquals(ctx.request, req);
    assertEquals(ctx.url, new URL("https://example.com/"));
    assertEquals(ctx.origin, "https://example.com");
    assertEquals(ctx.host, "example.com");
    assertEquals(ctx.hostname, "example.com");
    assertEquals(ctx.data, 123);
    assertRejects(
      () => ctx.getActor("someone"),
      Error,
    );
    assertRejects(
      () => ctx.getObject(Note, { handle: "someone", id: "123" }),
      Error,
    );
    assertEquals(await ctx.getSignedKey(), null);
    assertEquals(await ctx.getSignedKeyOwner(), null);
    // Multiple calls should return the same result:
    assertEquals(await ctx.getSignedKey(), null);
    assertEquals(await ctx.getSignedKeyOwner(), null);
    assertRejects(
      () => ctx.getActor("someone"),
      Error,
      "No actor dispatcher registered",
    );

    const signedReq = await signRequest(
      new Request("https://example.com/"),
      rsaPrivateKey2,
      rsaPublicKey2.id!,
    );
    const signedCtx = federation.createContext(signedReq, 456);
    assertEquals(signedCtx.request, signedReq);
    assertEquals(signedCtx.url, new URL("https://example.com/"));
    assertEquals(signedCtx.data, 456);
    assertEquals(await signedCtx.getSignedKey(), rsaPublicKey2);
    assertEquals(await signedCtx.getSignedKeyOwner(), null);
    // Multiple calls should return the same result:
    assertEquals(await signedCtx.getSignedKey(), rsaPublicKey2);
    assertEquals(await signedCtx.getSignedKeyOwner(), null);

    const signedReq2 = await signRequest(
      new Request("https://example.com/"),
      rsaPrivateKey3,
      rsaPublicKey3.id!,
    );
    const signedCtx2 = federation.createContext(signedReq2, 456);
    assertEquals(signedCtx2.request, signedReq2);
    assertEquals(signedCtx2.url, new URL("https://example.com/"));
    assertEquals(signedCtx2.data, 456);
    assertEquals(await signedCtx2.getSignedKey(), rsaPublicKey3);
    const expectedOwner = await lookupObject(
      "https://example.com/person2",
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
    );
    assertEquals(await signedCtx2.getSignedKeyOwner(), expectedOwner);
    // Multiple calls should return the same result:
    assertEquals(await signedCtx2.getSignedKey(), rsaPublicKey3);
    assertEquals(await signedCtx2.getSignedKeyOwner(), expectedOwner);

    federation.setActorDispatcher(
      "/users/{handle}",
      (_ctx, handle) => new Person({ preferredUsername: handle }),
    );
    const ctx2 = federation.createContext(req, 789);
    assertEquals(ctx2.request, req);
    assertEquals(ctx2.url, new URL("https://example.com/"));
    assertEquals(ctx2.data, 789);
    assertEquals(
      await ctx2.getActor("john"),
      new Person({ preferredUsername: "john" }),
    );

    federation.setObjectDispatcher(
      Note,
      "/users/{handle}/notes/{id}",
      (_ctx, values) => {
        return new Note({
          summary: `Note ${values.id} by ${values.handle}`,
        });
      },
    );
    const ctx3 = federation.createContext(req, 123);
    assertEquals(ctx3.request, req);
    assertEquals(ctx3.url, new URL("https://example.com/"));
    assertEquals(ctx3.data, 123);
    assertEquals(
      await ctx2.getObject(Note, { handle: "john", id: "123" }),
      new Note({ summary: "Note 123 by john" }),
    );
  });

  mf.uninstall();
});

test("Federation.setInboxListeners()", async (t) => {
  const kv = new MemoryKvStore();

  mf.install();

  mf.mock("GET@/key2", async () => {
    return new Response(
      JSON.stringify(
        await rsaPublicKey2.toJsonLd({ contextLoader: mockDocumentLoader }),
      ),
      { headers: { "Content-Type": "application/activity+json" } },
    );
  });

  mf.mock("GET@/person", async () => {
    return new Response(
      await Deno.readFile(
        join(
          dirname(import.meta.dirname!),
          "testing",
          "fixtures",
          "example.com",
          "person",
        ),
      ),
      { headers: { "Content-Type": "application/activity+json" } },
    );
  });

  mf.mock("GET@/person2", async () => {
    return new Response(
      await Deno.readFile(
        join(
          dirname(import.meta.dirname!),
          "testing",
          "fixtures",
          "example.com",
          "person2",
        ),
      ),
      { headers: { "Content-Type": "application/activity+json" } },
    );
  });

  await t.step("path match", () => {
    const federation = createFederation<void>({
      kv,
      documentLoader: mockDocumentLoader,
    });
    federation.setInboxDispatcher(
      "/users/{handle}/inbox",
      () => ({ items: [] }),
    );
    assertThrows(
      () => federation.setInboxListeners("/users/{handle}/inbox2"),
      RouterError,
    );
  });

  await t.step("wrong variables in path", () => {
    const federation = createFederation<void>({
      kv,
      documentLoader: mockDocumentLoader,
    });
    assertThrows(
      () =>
        federation.setInboxListeners(
          "/users/inbox" as `${string}{handle}${string}`,
        ),
      RouterError,
    );
    assertThrows(
      () => federation.setInboxListeners("/users/{handle}/inbox/{handle2}"),
      RouterError,
    );
    assertThrows(
      () =>
        federation.setInboxListeners(
          "/users/{handle2}/inbox" as `${string}{handle}${string}`,
        ),
      RouterError,
    );
  });

  await t.step("on()", async () => {
    const authenticatedRequests: [string, string][] = [];
    const federation = createFederation<void>({
      kv,
      documentLoader: mockDocumentLoader,
      authenticatedDocumentLoaderFactory(identity) {
        const docLoader = getAuthenticatedDocumentLoader(identity);
        return (url: string) => {
          const urlObj = new URL(url);
          authenticatedRequests.push([url, identity.keyId.href]);
          if (urlObj.host === "example.com") return docLoader(url);
          return mockDocumentLoader(url);
        };
      },
    });
    const inbox: [Context<void>, Create][] = [];
    federation.setInboxListeners("/users/{handle}/inbox", "/inbox")
      .on(Create, (ctx, create) => {
        inbox.push([ctx, create]);
      });

    let response = await federation.fetch(
      new Request("https://example.com/inbox", { method: "POST" }),
      { contextData: undefined },
    );
    assertEquals(inbox, []);
    assertEquals(response.status, 404);

    federation
      .setActorDispatcher(
        "/users/{handle}",
        (_, handle) => handle === "john" ? new Person({}) : null,
      )
      .setKeyPairsDispatcher(() => [{
        privateKey: rsaPrivateKey2,
        publicKey: rsaPublicKey2.publicKey!,
      }]);
    const options = {
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    };
    const activity = () =>
      new Create({
        id: new URL("https://example.com/activities/" + crypto.randomUUID()),
        actor: new URL("https://example.com/person2"),
      });
    response = await federation.fetch(
      new Request(
        "https://example.com/inbox",
        {
          method: "POST",
          body: JSON.stringify(await activity().toJsonLd(options)),
        },
      ),
      { contextData: undefined },
    );
    assertEquals(inbox, []);
    assertEquals(response.status, 401);

    response = await federation.fetch(
      new Request("https://example.com/users/no-one/inbox", { method: "POST" }),
      { contextData: undefined },
    );
    assertEquals(inbox, []);
    assertEquals(response.status, 404);

    response = await federation.fetch(
      new Request(
        "https://example.com/users/john/inbox",
        {
          method: "POST",
          body: JSON.stringify(await activity().toJsonLd(options)),
        },
      ),
      { contextData: undefined },
    );
    assertEquals(inbox, []);
    assertEquals(response.status, 401);

    // Personal inbox + HTTP Signatures (RSA)
    let request = new Request("https://example.com/users/john/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/activity+json" },
      body: JSON.stringify(await activity().toJsonLd(options)),
    });
    request = await signRequest(
      request,
      rsaPrivateKey3,
      new URL("https://example.com/person2#key3"),
    );
    response = await federation.fetch(request, { contextData: undefined });
    assertEquals(inbox.length, 1);
    assertEquals(inbox[0][1].actorId, new URL("https://example.com/person2"));
    assertEquals(response.status, 202);

    while (authenticatedRequests.length > 0) authenticatedRequests.shift();
    assertEquals(authenticatedRequests, []);
    await inbox[0][0].documentLoader("https://example.com/person");
    assertEquals(authenticatedRequests, [
      ["https://example.com/person", "https://example.com/users/john#main-key"],
    ]);

    // Shared inbox + HTTP Signatures (RSA)
    inbox.shift();
    request = new Request("https://example.com/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/activity+json" },
      body: JSON.stringify(await activity().toJsonLd(options)),
    });
    request = await signRequest(
      request,
      rsaPrivateKey3,
      new URL("https://example.com/person2#key3"),
    );
    response = await federation.fetch(request, { contextData: undefined });
    assertEquals(inbox.length, 1);
    assertEquals(inbox[0][1].actorId, new URL("https://example.com/person2"));
    assertEquals(response.status, 202);

    while (authenticatedRequests.length > 0) authenticatedRequests.shift();
    assertEquals(authenticatedRequests, []);
    await inbox[0][0].documentLoader("https://example.com/person");
    assertEquals(authenticatedRequests, []);

    // Object Integrity Proofs (Ed25519)
    inbox.shift();
    request = new Request("https://example.com/users/john/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/activity+json" },
      body: JSON.stringify(
        await (await signObject(
          activity(),
          ed25519PrivateKey,
          ed25519Multikey.id!,
          options,
        )).toJsonLd(options),
      ),
    });
    response = await federation.fetch(request, { contextData: undefined });
    assertEquals(inbox.length, 1);
    assertEquals(inbox[0][1].actorId, new URL("https://example.com/person2"));
    assertEquals(response.status, 202);

    while (authenticatedRequests.length > 0) authenticatedRequests.shift();
    assertEquals(authenticatedRequests, []);
    await inbox[0][0].documentLoader("https://example.com/person");
    assertEquals(authenticatedRequests, [
      ["https://example.com/person", "https://example.com/users/john#main-key"],
    ]);
  });

  await t.step("onError()", async () => {
    const federation = createFederation<void>({
      kv,
      documentLoader: mockDocumentLoader,
      authenticatedDocumentLoaderFactory(identity) {
        const docLoader = getAuthenticatedDocumentLoader(identity);
        return (url: string) => {
          const urlObj = new URL(url);
          if (urlObj.host === "example.com") return docLoader(url);
          return mockDocumentLoader(url);
        };
      },
    });
    federation
      .setActorDispatcher(
        "/users/{handle}",
        (_, handle) => handle === "john" ? new Person({}) : null,
      )
      .setKeyPairsDispatcher(() => [{
        privateKey: rsaPrivateKey2,
        publicKey: rsaPublicKey2.publicKey!,
      }]);
    const error = new Error("test");
    const errors: unknown[] = [];
    federation.setInboxListeners("/users/{handle}/inbox", "/inbox")
      .on(Create, () => {
        throw error;
      })
      .onError((_, e) => {
        errors.push(e);
      });

    const activity = new Create({
      actor: new URL("https://example.com/person"),
    });
    let request = new Request("https://example.com/users/john/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/activity+json" },
      body: JSON.stringify(
        await activity.toJsonLd({ contextLoader: mockDocumentLoader }),
      ),
    });
    request = await signRequest(
      request,
      rsaPrivateKey2,
      new URL("https://example.com/key2"),
    );
    const response = await federation.fetch(request, {
      contextData: undefined,
    });
    assertEquals(errors.length, 1);
    assertEquals(errors[0], error);
    assertEquals(response.status, 500);
  });

  mf.uninstall();
});

test("Federation.setInboxDispatcher()", async (t) => {
  const kv = new MemoryKvStore();

  await t.step("path match", () => {
    const federation = createFederation<void>({
      kv,
      documentLoader: mockDocumentLoader,
    });
    federation.setInboxListeners("/users/{handle}/inbox");
    assertThrows(
      () =>
        federation.setInboxDispatcher(
          "/users/{handle}/inbox2",
          () => ({ items: [] }),
        ),
      RouterError,
    );
  });

  await t.step("path match", () => {
    const federation = createFederation<void>({
      kv,
      documentLoader: mockDocumentLoader,
    });
    federation.setInboxListeners("/users/{handle}/inbox");
    federation.setInboxDispatcher(
      "/users/{handle}/inbox",
      () => ({ items: [] }),
    );
  });

  await t.step("wrong variables in path", () => {
    const federation = createFederation<void>({
      kv,
      documentLoader: mockDocumentLoader,
    });
    assertThrows(
      () =>
        federation.setInboxDispatcher(
          "/users/inbox" as `${string}{handle}${string}`,
          () => ({ items: [] }),
        ),
      RouterError,
    );
    assertThrows(
      () =>
        federation.setInboxDispatcher(
          "/users/{handle}/inbox/{handle2}",
          () => ({ items: [] }),
        ),
      RouterError,
    );
    assertThrows(
      () =>
        federation.setInboxDispatcher(
          "/users/{handle2}/inbox" as `${string}{handle}${string}`,
          () => ({ items: [] }),
        ),
      RouterError,
    );
  });
});

test("FederationImpl.sendActivity()", async (t) => {
  mf.install();

  let verified: ("http" | "ld" | "proof")[] | null = null;
  let request: Request | null = null;
  mf.mock("POST@/inbox", async (req) => {
    verified = [];
    request = req.clone();
    const options = {
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    };
    let json = await req.json();
    if (await verifyJsonLd(json, options)) verified.push("ld");
    json = detachSignature(json);
    let activity = await verifyObject(Activity, json, options);
    if (activity == null) {
      activity = await Activity.fromJsonLd(json, options);
    } else {
      verified.push("proof");
    }
    const key = await verifyRequest(request, options);
    if (key != null && await doesActorOwnKey(activity, key, options)) {
      verified.push("http");
    }
    if (verified.length > 0) return new Response(null, { status: 202 });
    return new Response(null, { status: 401 });
  });

  const kv = new MemoryKvStore();
  const federation = new FederationImpl<void>({
    kv,
    contextLoader: mockDocumentLoader,
  });

  await t.step("success", async () => {
    const activity = new Create({
      actor: new URL("https://example.com/person"),
    });
    const recipient = {
      id: new URL("https://example.com/recipient"),
      inboxId: new URL("https://example.com/inbox"),
    };
    await federation.sendActivity(
      [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
      recipient,
      activity,
      { contextData: undefined },
    );
    assertEquals(verified, ["http"]);
    assertInstanceOf(request, Request);
    assertEquals(request?.method, "POST");
    assertEquals(request?.url, "https://example.com/inbox");
    assertEquals(
      request?.headers.get("Content-Type"),
      "application/activity+json",
    );

    verified = null;
    await federation.sendActivity(
      [{ privateKey: rsaPrivateKey3, keyId: rsaPublicKey3.id! }],
      recipient,
      activity.clone({
        actor: new URL("https://example.com/person2"),
      }),
      { contextData: undefined },
    );
    assertEquals(verified, ["ld", "http"]);
    assertInstanceOf(request, Request);
    assertEquals(request?.method, "POST");
    assertEquals(request?.url, "https://example.com/inbox");
    assertEquals(
      request?.headers.get("Content-Type"),
      "application/activity+json",
    );

    verified = null;
    await federation.sendActivity(
      [
        { privateKey: ed25519PrivateKey, keyId: ed25519Multikey.id! },
      ],
      recipient,
      activity.clone({
        actor: new URL("https://example.com/person2"),
      }),
      { contextData: undefined },
    );
    assertEquals(verified, ["proof"]);
    assertInstanceOf(request, Request);
    assertEquals(request?.method, "POST");
    assertEquals(request?.url, "https://example.com/inbox");
    assertEquals(
      request?.headers.get("Content-Type"),
      "application/activity+json",
    );

    verified = null;
    await federation.sendActivity(
      [
        { privateKey: rsaPrivateKey3, keyId: rsaPublicKey3.id! },
        { privateKey: ed25519PrivateKey, keyId: ed25519Multikey.id! },
      ],
      recipient,
      activity.clone({
        actor: new URL("https://example.com/person2"),
      }),
      { contextData: undefined },
    );
    assertEquals(verified, ["ld", "proof", "http"]);
    assertInstanceOf(request, Request);
    assertEquals(request?.method, "POST");
    assertEquals(request?.url, "https://example.com/inbox");
    assertEquals(
      request?.headers.get("Content-Type"),
      "application/activity+json",
    );
  });

  mf.uninstall();
});

test("InboxContextImpl.forwardActivity()", async (t) => {
  mf.install();

  let verified: ("http" | "ld" | "proof")[] | null = null;
  let request: Request | null = null;
  mf.mock("POST@/inbox", async (req) => {
    verified = [];
    request = req.clone();
    const options = {
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    };
    let json = await req.json();
    if (await verifyJsonLd(json, options)) verified.push("ld");
    json = detachSignature(json);
    let activity = await verifyObject(Activity, json, options);
    if (activity == null) {
      activity = await Activity.fromJsonLd(json, options);
    } else {
      verified.push("proof");
    }
    const key = await verifyRequest(request, options);
    if (key != null && await doesActorOwnKey(activity, key, options)) {
      verified.push("http");
    }
    if (verified.length > 0) return new Response(null, { status: 202 });
    return new Response(null, { status: 401 });
  });

  const kv = new MemoryKvStore();
  const federation = new FederationImpl<void>({
    kv,
    contextLoader: mockDocumentLoader,
  });

  await t.step("skip", async () => {
    const activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      "type": "Create",
      "id": "https://example.com/activity",
      "actor": "https://example.com/person2",
    };
    const ctx = new InboxContextImpl(activity, {
      data: undefined,
      federation,
      url: new URL("https://example.com/"),
      documentLoader: fetchDocumentLoader,
    });
    await ctx.forwardActivity(
      [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
      {
        id: new URL("https://example.com/recipient"),
        inboxId: new URL("https://example.com/inbox"),
      },
      { skipIfUnsigned: true },
    );
    assertEquals(verified, null);
  });

  await t.step("unsigned", async () => {
    const activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      "type": "Create",
      "id": "https://example.com/activity",
      "actor": "https://example.com/person2",
    };
    const ctx = new InboxContextImpl(activity, {
      data: undefined,
      federation,
      url: new URL("https://example.com/"),
      documentLoader: fetchDocumentLoader,
    });
    await assertRejects(() =>
      ctx.forwardActivity(
        [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
        {
          id: new URL("https://example.com/recipient"),
          inboxId: new URL("https://example.com/inbox"),
        },
      )
    );
    assertEquals(verified, []);
  });

  await t.step("Object Integrity Proofs", async () => {
    const activity = await signObject(
      new Create({
        id: new URL("https://example.com/activity"),
        actor: new URL("https://example.com/person2"),
      }),
      ed25519PrivateKey,
      ed25519Multikey.id!,
      { contextLoader: mockDocumentLoader, documentLoader: mockDocumentLoader },
    );
    const ctx = new InboxContextImpl(
      await activity.toJsonLd({ contextLoader: mockDocumentLoader }),
      {
        data: undefined,
        federation,
        url: new URL("https://example.com/"),
        documentLoader: fetchDocumentLoader,
      },
    );
    await ctx.forwardActivity(
      [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
      {
        id: new URL("https://example.com/recipient"),
        inboxId: new URL("https://example.com/inbox"),
      },
      { skipIfUnsigned: true },
    );
    assertEquals(verified, ["proof"]);
  });

  await t.step("LD Signatures", async () => {
    const activity = await signJsonLd(
      {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "Create",
        "id": "https://example.com/activity",
        "actor": "https://example.com/person2",
      },
      rsaPrivateKey3,
      rsaPublicKey3.id!,
      { contextLoader: mockDocumentLoader },
    );
    const ctx = new InboxContextImpl(activity, {
      data: undefined,
      federation,
      url: new URL("https://example.com/"),
      documentLoader: fetchDocumentLoader,
    });
    await ctx.forwardActivity(
      [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
      {
        id: new URL("https://example.com/recipient"),
        inboxId: new URL("https://example.com/inbox"),
      },
      { skipIfUnsigned: true },
    );
    assertEquals(verified, ["ld"]);
  });

  mf.uninstall();
});
