import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import * as mf from "mock_fetch";
import process from "node:process";
import metadata from "../deno.json" with { type: "json" };
import { MemoryKvStore } from "../federation/kv.ts";
import { verifyRequest } from "../sig/http.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { rsaPrivateKey2 } from "../testing/keys.ts";
import { test } from "../testing/mod.ts";
import preloadedContexts from "./contexts.ts";
import {
  fetchDocumentLoader,
  FetchError,
  getAuthenticatedDocumentLoader,
  getUserAgent,
  kvCache,
} from "./docloader.ts";
import { UrlError } from "./url.ts";

test("new FetchError()", () => {
  const e = new FetchError("https://example.com/", "An error message.");
  assertEquals(e.name, "FetchError");
  assertEquals(e.url, new URL("https://example.com/"));
  assertEquals(e.message, "https://example.com/: An error message.");

  const e2 = new FetchError(new URL("https://example.org/"));
  assertEquals(e2.url, new URL("https://example.org/"));
  assertEquals(e2.message, "https://example.org/");
});

test("fetchDocumentLoader()", async (t) => {
  mf.install();

  mf.mock("GET@/object", (_req) =>
    new Response(
      JSON.stringify({
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "https://example.com/object",
        name: "Fetched object",
        type: "Object",
      }),
      { status: 200 },
    ));

  await t.step("ok", async () => {
    assertEquals(await fetchDocumentLoader("https://example.com/object"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "https://example.com/object",
        name: "Fetched object",
        type: "Object",
      },
    });
  });

  mf.mock("GET@/link-ctx", (_req) =>
    new Response(
      JSON.stringify({
        id: "https://example.com/link-ctx",
        name: "Fetched object",
        type: "Object",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/activity+json",
          Link: "<https://www.w3.org/ns/activitystreams>; " +
            'rel="http://www.w3.org/ns/json-ld#context"; ' +
            'type="application/ld+json"',
        },
      },
    ));

  mf.mock("GET@/link-obj", (_req) =>
    new Response(
      "",
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          Link: '<https://example.com/object>; rel="alternate"; ' +
            'type="application/activity+json"',
        },
      },
    ));

  mf.mock("GET@/link-obj-relative", (_req) =>
    new Response(
      "",
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          Link: '</object>; rel="alternate"; ' +
            'type="application/activity+json"',
        },
      },
    ));

  await t.step("Link header", async () => {
    assertEquals(await fetchDocumentLoader("https://example.com/link-ctx"), {
      contextUrl: "https://www.w3.org/ns/activitystreams",
      documentUrl: "https://example.com/link-ctx",
      document: {
        id: "https://example.com/link-ctx",
        name: "Fetched object",
        type: "Object",
      },
    });

    assertEquals(await fetchDocumentLoader("https://example.com/link-obj"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "https://example.com/object",
        name: "Fetched object",
        type: "Object",
      },
    });
  });

  await t.step("Link header relative url", async () => {
    assertEquals(await fetchDocumentLoader("https://example.com/link-ctx"), {
      contextUrl: "https://www.w3.org/ns/activitystreams",
      documentUrl: "https://example.com/link-ctx",
      document: {
        id: "https://example.com/link-ctx",
        name: "Fetched object",
        type: "Object",
      },
    });

    assertEquals(
      await fetchDocumentLoader("https://example.com/link-obj-relative"),
      {
        contextUrl: null,
        documentUrl: "https://example.com/object",
        document: {
          "@context": "https://www.w3.org/ns/activitystreams",
          id: "https://example.com/object",
          name: "Fetched object",
          type: "Object",
        },
      },
    );
  });

  mf.mock("GET@/html-link", (_req) =>
    new Response(
      `<html>
        <head>
          <meta charset=utf-8>
          <link
            rel=alternate
            type='application/activity+json'
            href="https://example.com/object">
        </head>
      </html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    ));

  await t.step("HTML <link>", async () => {
    assertEquals(await fetchDocumentLoader("https://example.com/html-link"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "https://example.com/object",
        name: "Fetched object",
        type: "Object",
      },
    });
  });

  mf.mock("GET@/html-a", (_req) =>
    new Response(
      `<html>
        <head>
          <meta charset=utf-8>
        </head>
        <body>
          <a
            rel=alternate
            type=application/activity+json
            href=https://example.com/object>test</a>
        </body>
      </html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    ));

  await t.step("HTML <a>", async () => {
    assertEquals(await fetchDocumentLoader("https://example.com/html-a"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "https://example.com/object",
        name: "Fetched object",
        type: "Object",
      },
    });
  });

  mf.mock("GET@/404", (_req) => new Response("", { status: 404 }));

  await t.step("not ok", async () => {
    await assertRejects(
      () => fetchDocumentLoader("https://example.com/404"),
      FetchError,
      "HTTP 404: https://example.com/404",
    );
  });

  await t.step("preloaded contexts", async () => {
    for (const [url, document] of Object.entries(preloadedContexts)) {
      assertEquals(await fetchDocumentLoader(url), {
        contextUrl: null,
        documentUrl: url,
        document,
      });
    }
  });

  await t.step("deny non-HTTP/HTTPS", async () => {
    await assertRejects(
      () => fetchDocumentLoader("ftp://localhost"),
      UrlError,
    );
  });

  mf.mock(
    "GET@/localhost-redirect",
    (_req) => Response.redirect("https://localhost/object", 302),
  );

  mf.mock("GET@/localhost-link", (_req) =>
    new Response(
      `<html>
        <head>
          <meta charset=utf-8>
          <link
            rel=alternate
            type='application/activity+json'
            href="https://localhost/object">
        </head>
      </html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    ));

  await t.step("allowPrivateAddress: false", async () => {
    await assertRejects(
      () => fetchDocumentLoader("https://localhost/object"),
      UrlError,
    );
    await assertRejects(
      () => fetchDocumentLoader("https://example.com/localhost-redirect"),
      UrlError,
    );
    await assertRejects(
      () => fetchDocumentLoader("https://example.com/localhost-link"),
      UrlError,
    );
  });

  await t.step("allowPrivateAddress: true", async () => {
    const expected = {
      contextUrl: null,
      documentUrl: "https://localhost/object",
      document: {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "https://example.com/object",
        name: "Fetched object",
        type: "Object",
      },
    };
    assertEquals(
      await fetchDocumentLoader("https://localhost/object", true),
      expected,
    );
    assertEquals(
      await fetchDocumentLoader("https://example.com/localhost-redirect", true),
      expected,
    );
    assertEquals(
      await fetchDocumentLoader("https://example.com/localhost-link", true),
      expected,
    );
  });

  mf.uninstall();
});

test("getAuthenticatedDocumentLoader()", async (t) => {
  mf.install();

  mf.mock("GET@/object", async (req) => {
    const v = await verifyRequest(
      req,
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
        currentTime: Temporal.Now.instant(),
      },
    );
    return new Response(JSON.stringify(v != null), {
      headers: { "Content-Type": "application/json" },
    });
  });

  await t.step("test", async () => {
    const loader = await getAuthenticatedDocumentLoader({
      keyId: new URL("https://example.com/key2"),
      privateKey: rsaPrivateKey2,
    });
    assertEquals(await loader("https://example.com/object"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: true,
    });
  });

  mf.uninstall();

  await t.step("deny non-HTTP/HTTPS", async () => {
    const loader = await getAuthenticatedDocumentLoader({
      keyId: new URL("https://example.com/key2"),
      privateKey: rsaPrivateKey2,
    });
    assertRejects(() => loader("ftp://localhost"), UrlError);
  });

  await t.step("deny private network", async () => {
    const loader = await getAuthenticatedDocumentLoader({
      keyId: new URL("https://example.com/key2"),
      privateKey: rsaPrivateKey2,
    });
    assertRejects(() => loader("http://localhost"), UrlError);
  });
});

test("kvCache()", async (t) => {
  const kv = new MemoryKvStore();

  await t.step("cached", async () => {
    const loader = kvCache({
      kv,
      loader: mockDocumentLoader,
      rules: [
        ["https://example.org/", Temporal.Duration.from({ days: 1 })],
        [new URL("https://example.net/"), Temporal.Duration.from({ days: 1 })],
        [
          new URLPattern("https://example.com/*"),
          Temporal.Duration.from({ days: 30 }),
        ],
      ],
      prefix: ["_test", "cached"],
    });
    const result = await loader("https://example.com/object");
    assertEquals(result, {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "https://example.com/object",
        name: "Fetched object",
        type: "Object",
      },
    });
    const cache = await kv.get([
      "_test",
      "cached",
      "https://example.com/object",
    ]);
    assertEquals(cache, result);

    await kv.set(
      ["_test", "cached", "https://example.org/"],
      {
        contextUrl: null,
        documentUrl: "https://example.org/",
        document: {
          "id": "https://example.org/",
        },
      },
    );
    const result2 = await loader("https://example.org/");
    assertEquals(result2, {
      contextUrl: null,
      documentUrl: "https://example.org/",
      document: {
        "id": "https://example.org/",
      },
    });

    await kv.set(
      ["_test", "cached", "https://example.net/"],
      {
        contextUrl: null,
        documentUrl: "https://example.net/",
        document: {
          "id": "https://example.net/",
        },
      },
    );
    const result3 = await loader("https://example.net/");
    assertEquals(result3, {
      contextUrl: null,
      documentUrl: "https://example.net/",
      document: {
        "id": "https://example.net/",
      },
    });
  });

  await t.step("not cached", async () => {
    const loader = kvCache({
      kv,
      loader: mockDocumentLoader,
      rules: [],
      prefix: ["_test", "not cached"],
    });
    const result = await loader("https://example.com/object");
    assertEquals(result, {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: "https://example.com/object",
        name: "Fetched object",
        type: "Object",
      },
    });
    const cache = await kv.get([
      "test2",
      "not cached",
      "https://example.com/object",
    ]);
    assertEquals(cache, undefined);
  });

  await t.step("maximum cache duration", () => {
    assertThrows(
      () =>
        kvCache({
          kv,
          loader: mockDocumentLoader,
          rules: [
            [
              "https://example.com/",
              Temporal.Duration.from({ days: 30, seconds: 1 }),
            ],
          ],
        }),
      TypeError,
      "The maximum cache duration is 30 days",
    );
    assertThrows(
      () =>
        kvCache({
          kv,
          loader: mockDocumentLoader,
          rules: [
            [
              new URLPattern("https://example.com/*"),
              Temporal.Duration.from({ days: 30, seconds: 1 }),
            ],
          ],
        }),
      TypeError,
      "The maximum cache duration is 30 days",
    );
  });
});

test("getUserAgent()", () => {
  if ("Deno" in globalThis) {
    assertEquals(
      getUserAgent(),
      `Fedify/${metadata.version} (Deno/${Deno.version.deno})`,
    );
    assertEquals(
      getUserAgent("MyApp/1.0.0"),
      `MyApp/1.0.0 (Fedify/${metadata.version}; Deno/${Deno.version.deno})`,
    );
    assertEquals(
      getUserAgent(null, "https://example.com/"),
      `Fedify/${metadata.version} (Deno/${Deno.version.deno}; +https://example.com/)`,
    );
    assertEquals(
      getUserAgent("MyApp/1.0.0", new URL("https://example.com/")),
      `MyApp/1.0.0 (Fedify/${metadata.version}; Deno/${Deno.version.deno}; +https://example.com/)`,
    );
  } else if ("Bun" in globalThis) {
    assertEquals(
      getUserAgent(),
      // @ts-ignore: `Bun` is a global variable in Bun
      `Fedify/${metadata.version} (Bun/${Bun.version})`,
    );
    assertEquals(
      getUserAgent("MyApp/1.0.0"),
      // @ts-ignore: `Bun` is a global variable in Bun
      `MyApp/1.0.0 (Fedify/${metadata.version}; Bun/${Bun.version})`,
    );
    assertEquals(
      getUserAgent(null, "https://example.com/"),
      // @ts-ignore: `Bun` is a global variable in Bun
      `Fedify/${metadata.version} (Bun/${Bun.version}; +https://example.com/)`,
    );
    assertEquals(
      getUserAgent("MyApp/1.0.0", new URL("https://example.com/")),
      // @ts-ignore: `Bun` is a global variable in Bun
      `MyApp/1.0.0 (Fedify/${metadata.version}; Bun/${Bun.version}; +https://example.com/)`,
    );
  } else {
    assertEquals(
      getUserAgent(),
      `Fedify/${metadata.version} (Node.js/${process.version})`,
    );
    assertEquals(
      getUserAgent("MyApp/1.0.0"),
      `MyApp/1.0.0 (Fedify/${metadata.version}; Node.js/${process.version})`,
    );
    assertEquals(
      getUserAgent(null, "https://example.com/"),
      `Fedify/${metadata.version} (Node.js/${process.version}; +https://example.com/)`,
    );
    assertEquals(
      getUserAgent("MyApp/1.0.0", new URL("https://example.com/")),
      `MyApp/1.0.0 (Fedify/${metadata.version}; Node.js/${process.version}; +https://example.com/)`,
    );
  }
});
