import { assert, assertEquals, assertFalse } from "jsr:@std/assert@^0.218.2";
import { Temporal } from "npm:@js-temporal/polyfill@^0.4.4";
import { CryptographicKey, doesActorOwnKey, sign, verify } from "../mod.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { Create } from "../vocab/vocab.ts";

const publicKey1 = new CryptographicKey({
  id: new URL("https://example.com/key"),
  owner: new URL("https://example.com/person"),
  publicKey: await crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      alg: "RS256",
      // cSpell: disable
      n: "yIB9rotX8G6r6_6toT-x24BUiQ_HaPH1Em9dOt4c94s-OPFoEdH7DY7Iym9A8Ll" +
        "H4JaGF8KD38bLHWe1S4x0jV3gHJKhK7veJfGZCKUENcQecBZ-YWUs5HWvUIX1vVB" +
        "__0luHrg6BQKGOrSOE-WIAxyr0qsWCFfZzQrvSnUD2yvg1arJX2xhms14uxoRd5K" +
        "g9efKSCmmQaNEapicARUmFWrIEpGFa_nUUnqimssAGw1eZFqf3wA4TjhsuARBhGa" +
        "Jtv_3KEa016eMZxy3kDlOjZnXZTaTgWkXdodwUvy8563fes3Al6BlcS2iJ9qbtha" +
        "8rSm0FHqoUKH73JsLPKQIwQ",
      e: "AQAB",
      // cSpell: enable
      key_ops: ["verify"],
      ext: true,
    },
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["verify"],
  ),
});

const privateKey2 = await crypto.subtle.importKey(
  "jwk",
  {
    "kty": "RSA",
    "alg": "RS256",
    // cSpell: disable
    n: "oRmBtnxbdFutoRd1GLGwwGTrsqlRRWUe11hHQaoRLGf5LwQ0tIc6I9q-dynliw-2kxY" +
      "sLn9SH2je6HcTYOolgW7F_cOWXZQN04b-OiYcU1ConAhLjmn4k1uKawJ614y0ScPNd8P" +
      "Q-CljsnlPxbq9ofaCMe2BV3B6y09aCuGFJ0nxn1_ubjmIBIWWFTAznoz1J9BhJDGyt3I" +
      "O3ABy3f9zDVlR32L_n5VIkXnxkjUKdzMAOzYb62kuKOp1iznRTPrV71SNtivJMwSh_LV" +
      "gBrmZjtIn_oim-KyX_fdLU3tQ7VClyqmJzyAjccOH6Qj6nFTPh-vX07gqN8IlLT2uye4" +
      "waw",
    e: "AQAB",
    d: "f-Pa2L7Sb4YUSa1wlSEC-0li35uQ3DFRkY0QTG2xYnpMFGoXWTV9D1epGrqU8pePzia" +
      "s_mCvFiZPx2Y4aRiYm68P2Mu7hCBz9XfWPN1iYTXIFM51BOLVpk3mjdsTICkgOusJI0m" +
      "9jDR3ZAjwLj14K6qhYvd0VbECmoItLjQoW64Sc9iDgD3CvGoTqv71oTfW70cy-Ve1xQ9" +
      "CThAmMOTKe6rYCUTA8tMZcPszifZ4iOasOjgvRxyel86LqGNtyslY8k86gQlMtFpR3Ve" +
      "ZV_8otAWZn0mDc4vVU8HUO-DzYiIFdAcVxfPJh6tx7snCTsdzze_98OEAK4EWYBn7vsG" +
      "FeQ",
    p: "xuDd7tE_47NWwvDTpB403X13EPA3768MlNpl_v_BGiuP-1uvWUnsOVZB0F3HXSVg1sB" +
      "VNtec46v7OU0P693gvYUhouTmSQpayY_VFqMklprWgs7cfneqbeDzv3C4Fw5waY-vjoI" +
      "NDsE1jYELUnl5cVjXXyxuGFG-IaLJKmHmHX0",
    q: "z17X2t9zO6WcMp6W04gXdKmniJlxekOrOmWnrX9AwaM8NYCLN3y23r59nqNP9aUAWG1" +
      "eoGFmav2rYQitWhz_VsEu2pQUsfsYKZYHchu5p_jCYwuM3rIg7aCbhtGv_tBoWAf1NvK" +
      "Mhtp2es0ZaHZCzKDGSOkIYDOB-ZDmNigWigc",
    dp: "lrXReSkZQXSmSxQ1TimV5kMt96gSu4_r-OGIabVmoG5irhjMyN08Jjc3qK9oZS3uNM-L" +
      "xAOg4OdzefjsF9IMfZJl6wuLd85g_l4BHSaEk5zC8l3QugX1IU9XZ7wDxXUrutMoNtZX" +
      "DtdbveAMtHNZlIu-qmEBDWzkqJiz2WpW-AE",
    dq: "TCLoYcX0ywuNA9DSU6v94KmBh1e_IELEFVbJb5vvLKlAK-ycMK0rfzC1co9Hhkski1Ls" +
      "kTnxnoqwZ5oF-7X10eZvy3Te_FHSl0IsTar8ST2-MRtGh2UjTdvP_nnygj4GcXvKfngj" +
      "PEfthDzVfVMeR38oDhDxMFD5AaY_v9aMH_U",
    qi: "KC6gWhVM_x7iQgl-gEoSh_iM1Jf314ZLJKAAz1DsTHMi5yuCkCMmmY7h6jlkAJVngK3K" +
      "If5LPoAeUoGJ26E1kocbRU_nZBftMDVXHCYICz8qMQXR5euN_5SeJnu_VWXH-CY83MKh" +
      "PYAorWSZ1-G9gh-C16LlRMzJwoE6h5QNeNo",
    // cSpell: enable
    "key_ops": ["sign"],
    "ext": true,
  },
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  true,
  ["sign"],
);

const publicKey2 = new CryptographicKey({
  id: new URL("https://example.com/key2"),
  publicKey: await crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      alg: "RS256",
      // cSpell: disable
      n: "oRmBtnxbdFutoRd1GLGwwGTrsqlRRWUe11hHQaoRLGf5LwQ0tIc6I9q-dynliw-" +
        "2kxYsLn9SH2je6HcTYOolgW7F_cOWXZQN04b-OiYcU1ConAhLjmn4k1uKawJ614y" +
        "0ScPNd8PQ-CljsnlPxbq9ofaCMe2BV3B6y09aCuGFJ0nxn1_ubjmIBIWWFTAznoz" +
        "1J9BhJDGyt3IO3ABy3f9zDVlR32L_n5VIkXnxkjUKdzMAOzYb62kuKOp1iznRTPr" +
        "V71SNtivJMwSh_LVgBrmZjtIn_oim-KyX_fdLU3tQ7VClyqmJzyAjccOH6Qj6nFT" +
        "Ph-vX07gqN8IlLT2uye4waw",
      e: "AQAB",
      // cSpell: enable
      key_ops: ["verify"],
      ext: true,
    },
    { "name": "RSASSA-PKCS1-v1_5", "hash": "SHA-256" },
    true,
    ["verify"],
  ),
});

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
