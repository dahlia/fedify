import { assertEquals } from "@std/assert";
import { mockDocumentLoader } from "../testing/docloader.ts";
import {
  rsaPrivateKey2,
  rsaPublicKey1,
  rsaPublicKey2,
} from "../testing/keys.ts";
import { test } from "../testing/mod.ts";
import type { CryptographicKey, Multikey } from "../vocab/vocab.ts";
import {
  signRequest,
  verifyRequest,
  type VerifyRequestOptions,
} from "./http.ts";
import type { KeyCache } from "./key.ts";

test("signRequest()", async () => {
  const request = new Request("https://example.com/", {
    method: "POST",
    body: "Hello, world!",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Accept: "text/plain",
    },
  });
  const signed = await signRequest(
    request,
    rsaPrivateKey2,
    new URL("https://example.com/key2"),
  );
  assertEquals(
    await verifyRequest(signed, {
      contextLoader: mockDocumentLoader,
      documentLoader: mockDocumentLoader,
    }),
    rsaPublicKey2,
  );
});

test("verifyRequest()", async () => {
  const request = new Request("https://example.com/", {
    method: "POST",
    body: "Hello, world!",
    headers: {
      Accept: "text/plain",
      "Content-Type": "text/plain; charset=utf-8",
      Date: "Tue, 05 Mar 2024 07:49:44 GMT",
      Digest: "sha-256=MV9b23bQeMQ7isAGTkoBZGErH853yGk0W/yUx1iU7dM=",
      Signature: 'keyId="https://example.com/key",' +
        'headers="(request-target) accept content-type date digest host",' +
        // cSpell: disable
        'signature="ZDeMzjBKPfJvkv4QaxAdOQxKCJ96pOzOCFhhGgGnlsw4N80oN4GEZ/n8n' +
        "NKjpoW95Bcs8N0dZVSQHj3g08AReKIOXpun0tgmaWGKRcRT4kEhAW+uP1wVZPbuOIvVC" +
        "EhMYv6+SbnttgX0GvN365BTZpxh7+gRrRC4mns5qV69cv45I5iJB0aw24GJW9u7lUAm6" +
        "yDEh4N0aXfNqNRq3LHiuPqlDzSenfXbHr0UnAMaGuI4v9/uflu/jNi3hRX4Y/T+ngM1z" +
        "vLvi/BjKK4I1rh520qnkrWpxz9ikLCjIMO7Dwh1nOsPzrZE2t43XHD3evdvm1RM5Ppes" +
        '+M6DrfkfQuUBw=="', // cSpell: enable
    },
  });
  const cache: Record<string, CryptographicKey | Multikey> = {};
  const options: VerifyRequestOptions = {
    contextLoader: mockDocumentLoader,
    documentLoader: mockDocumentLoader,
    currentTime: Temporal.Instant.from("2024-03-05T07:49:44Z"),
    keyCache: {
      get(keyId) {
        return Promise.resolve(cache[keyId.href] ?? null);
      },
      set(keyId, key) {
        cache[keyId.href] = key;
        return Promise.resolve();
      },
    } satisfies KeyCache,
  };
  let key = await verifyRequest(request, options);
  assertEquals(key, rsaPublicKey1);
  assertEquals(cache, { "https://example.com/key": rsaPublicKey1 });
  cache["https://example.com/key"] = rsaPublicKey2;
  key = await verifyRequest(request, options);
  assertEquals(key, rsaPublicKey1);
  assertEquals(cache, { "https://example.com/key": rsaPublicKey1 });

  assertEquals(
    await verifyRequest(
      new Request("https://example.com/"),
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
      },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      new Request("https://example.com/", {
        headers: { Date: "Tue, 05 Mar 2024 07:49:44 GMT" },
      }),
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      new Request("https://example.com/", {
        method: "POST",
        headers: {
          Date: "Tue, 05 Mar 2024 07:49:44 GMT",
          Signature: "asdf",
        },
      }),
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      new Request("https://example.com/", {
        method: "POST",
        headers: {
          Date: "Tue, 05 Mar 2024 07:49:44 GMT",
          Signature: "asdf",
          Digest: "invalid",
        },
        body: "",
      }),
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      new Request("https://example.com/", {
        method: "POST",
        headers: {
          Date: "Tue, 05 Mar 2024 07:49:44 GMT",
          Signature: "asdf",
          Digest: "sha-256=MV9b23bQeMQ7isAGTkoBZGErH853yGk0W/yUx1iU7dM=",
        },
        body: "",
      }),
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      request,
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
        currentTime: Temporal.Instant.from("2024-03-05T07:48:43.9999Z"),
      },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      request,
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
        currentTime: Temporal.Instant.from("2024-03-05T07:49:13.9999Z"),
        timeWindow: { seconds: 30 },
      },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      request,
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
        currentTime: Temporal.Instant.from("2024-03-05T07:50:44.0001Z"),
      },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      request,
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
        currentTime: Temporal.Instant.from("2024-03-05T07:50:14.0001Z"),
        timeWindow: { seconds: 30 },
      },
    ),
    null,
  );
  assertEquals(
    await verifyRequest(
      request,
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
        currentTime: Temporal.Instant.from("2024-01-01T00:00:00.0000Z"),
        timeWindow: false,
      },
    ),
    rsaPublicKey1,
  );
  assertEquals(
    await verifyRequest(
      request,
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
        currentTime: Temporal.Instant.from("2025-01-01T00:00:00.0000Z"),
        timeWindow: false,
      },
    ),
    rsaPublicKey1,
  );
});
