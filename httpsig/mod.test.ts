import { assert, assertEquals, assertFalse } from "jsr:@std/assert@^0.218.2";
import { Temporal } from "npm:@js-temporal/polyfill@^0.4.4";
import { doesActorOwnKey, sign, verify } from "../mod.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { privateKey2, publicKey1, publicKey2 } from "../testing/keys.ts";
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
    await verify(signed, mockDocumentLoader),
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
    ),
    null,
  );
  assertEquals(
    await verify(
      new Request("https://example.com/", {
        headers: { Date: "Tue, 05 Mar 2024 07:49:44 GMT" },
      }),
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
    ),
    null,
  );
  assertEquals(
    await verify(
      request,
      mockDocumentLoader,
      Temporal.Instant.from("2024-03-05T07:49:13.9999Z"),
    ),
    null,
  );
  assertEquals(
    await verify(
      request,
      mockDocumentLoader,
      Temporal.Instant.from("2024-03-05T07:50:14.0001Z"),
    ),
    null,
  );
});

Deno.test("doesActorOwnKey()", async () => {
  const activity = new Create({ actor: new URL("https://example.com/person") });
  assert(await doesActorOwnKey(activity, publicKey1, mockDocumentLoader));
  assert(await doesActorOwnKey(activity, publicKey2, mockDocumentLoader));

  const activity2 = new Create({
    actor: new URL("https://example.com/hong-gildong"),
  });
  assertFalse(await doesActorOwnKey(activity2, publicKey1, mockDocumentLoader));
  assertFalse(await doesActorOwnKey(activity2, publicKey2, mockDocumentLoader));
});
