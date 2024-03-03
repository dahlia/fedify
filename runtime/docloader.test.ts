import { Temporal } from "npm:@js-temporal/polyfill@^0.4.4";
import { assertEquals, assertThrows } from "jsr:@std/assert@^0.218.2";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { FetchError, kvCache } from "./docloader.ts";

Deno.test("new FetchError()", () => {
  const e = new FetchError("https://example.com/", "An error message.");
  assertEquals(e.name, "FetchError");
  assertEquals(e.url, new URL("https://example.com/"));
  assertEquals(e.message, "https://example.com/: An error message.");

  const e2 = new FetchError(new URL("https://example.org/"));
  assertEquals(e2.url, new URL("https://example.org/"));
  assertEquals(e2.message, "https://example.org/");
});

Deno.test("kvCache()", async (t) => {
  const kv = await Deno.openKv(":memory:");

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
      prefix: ["_test"],
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
    const cache = await kv.get(["_test", "https://example.com/object"]);
    assertEquals(cache.value, result);

    await kv.set(
      ["_test", "https://example.com/mock"],
      {
        contextUrl: null,
        documentUrl: "https://example.com/mock",
        document: {
          "id": "https://example.com/mock",
        },
      },
    );
    const result2 = await loader("https://example.com/mock");
    assertEquals(result2, {
      contextUrl: null,
      documentUrl: "https://example.com/mock",
      document: {
        "id": "https://example.com/mock",
      },
    });
  });

  await t.step("maximum cache duration", () => {
    assertThrows(
      () =>
        kvCache({
          kv,
          loader: mockDocumentLoader,
          rules: [
            [
              "https://example.com",
              Temporal.Duration.from({ days: 30, seconds: 1 }),
            ],
          ],
        }),
      TypeError,
      "The maximum cache duration is 30 days",
    );
  });

  kv.close();
});
