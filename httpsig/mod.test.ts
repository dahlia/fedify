import { assert, assertEquals, assertFalse } from "@std/assert";
import { doesActorOwnKey, getKeyOwner, sign, verify } from "../mod.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { privateKey2, publicKey1, publicKey2 } from "../testing/keys.ts";
import { lookupObject } from "../vocab/lookup.ts";
import { Create } from "../vocab/vocab.ts";

Deno.test("sign()", async () => {
  const request = new Request("https://example.com/", {
    method: "POST",
    body: "Hello, world!",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Accept: "text/plain",
    },
  });
  const signed = await sign(
    request,
    privateKey2,
    new URL("https://example.com/key2"),
  );
  assertEquals(
    await verify(signed, mockDocumentLoader, mockDocumentLoader),
    publicKey2,
  );
});

Deno.test("verify()", async () => {
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
  const key = await verify(
    request,
    mockDocumentLoader,
    mockDocumentLoader,
    Temporal.Instant.from("2024-03-05T07:49:44Z"),
  );
  assertEquals(
    key,
    publicKey1,
  );

  assertEquals(
    await verify(
      new Request("https://example.com/"),
      mockDocumentLoader,
      mockDocumentLoader,
    ),
    null,
  );
  assertEquals(
    await verify(
      new Request("https://example.com/", {
        headers: { Date: "Tue, 05 Mar 2024 07:49:44 GMT" },
      }),
      mockDocumentLoader,
      mockDocumentLoader,
    ),
    null,
  );
  assertEquals(
    await verify(
      new Request("https://example.com/", {
        method: "POST",
        headers: {
          Date: "Tue, 05 Mar 2024 07:49:44 GMT",
          Signature: "asdf",
        },
      }),
      mockDocumentLoader,
      mockDocumentLoader,
    ),
    null,
  );
  assertEquals(
    await verify(
      new Request("https://example.com/", {
        method: "POST",
        headers: {
          Date: "Tue, 05 Mar 2024 07:49:44 GMT",
          Signature: "asdf",
          Digest: "invalid",
        },
        body: "",
      }),
      mockDocumentLoader,
      mockDocumentLoader,
    ),
    null,
  );
  assertEquals(
    await verify(
      new Request("https://example.com/", {
        method: "POST",
        headers: {
          Date: "Tue, 05 Mar 2024 07:49:44 GMT",
          Signature: "asdf",
          Digest: "sha-256=MV9b23bQeMQ7isAGTkoBZGErH853yGk0W/yUx1iU7dM=",
        },
        body: "",
      }),
      mockDocumentLoader,
      mockDocumentLoader,
    ),
    null,
  );
  assertEquals(
    await verify(
      request,
      mockDocumentLoader,
      mockDocumentLoader,
      Temporal.Instant.from("2024-03-05T07:49:13.9999Z"),
    ),
    null,
  );
  assertEquals(
    await verify(
      request,
      mockDocumentLoader,
      mockDocumentLoader,
      Temporal.Instant.from("2024-03-05T07:50:14.0001Z"),
    ),
    null,
  );
});

Deno.test("doesActorOwnKey()", async () => {
  const options = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  };
  const activity = new Create({ actor: new URL("https://example.com/person") });
  assert(await doesActorOwnKey(activity, publicKey1, options));
  assert(await doesActorOwnKey(activity, publicKey2, options));

  const activity2 = new Create({
    actor: new URL("https://example.com/hong-gildong"),
  });
  assertFalse(await doesActorOwnKey(activity2, publicKey1, options));
  assertFalse(await doesActorOwnKey(activity2, publicKey2, options));
});

Deno.test("getKeyOwner()", async () => {
  const options = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  };
  const owner = await getKeyOwner(
    new URL("https://example.com/users/handle#main-key"),
    options,
  );
  assertEquals(
    owner,
    await lookupObject("https://example.com/users/handle", options),
  );

  const owner2 = await getKeyOwner(
    new URL("https://example.com/key"),
    options,
  );
  assertEquals(
    owner2,
    await lookupObject("https://example.com/person", options),
  );

  const owner3 = await getKeyOwner(publicKey1, options);
  assertEquals(owner3, owner2);

  const noOwner = await getKeyOwner(
    new URL("https://example.com/key2"),
    options,
  );
  assertEquals(noOwner, null);

  const noOwner2 = await getKeyOwner(
    new URL("https://example.com/object"),
    options,
  );
  assertEquals(noOwner2, null);
});
