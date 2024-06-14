import { assert, assertEquals, assertFalse, assertRejects } from "@std/assert";
import { validateCryptoKey } from "../sig/key.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import {
  rsaPrivateKey2,
  rsaPublicKey1,
  rsaPublicKey2,
} from "../testing/keys.ts";
import { test } from "../testing/mod.ts";
import { lookupObject } from "../vocab/lookup.ts";
import { Create } from "../vocab/vocab.ts";
import {
  doesActorOwnKey,
  exportJwk,
  generateCryptoKeyPair,
  getKeyOwner,
  importJwk,
  sign,
  verify,
} from "./mod.ts";

test("sign()", async () => {
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
    rsaPrivateKey2,
    new URL("https://example.com/key2"),
  );
  assertEquals(
    await verify(signed, {
      contextLoader: mockDocumentLoader,
      documentLoader: mockDocumentLoader,
    }),
    rsaPublicKey2,
  );
});

test("verify()", async () => {
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
    {
      contextLoader: mockDocumentLoader,
      documentLoader: mockDocumentLoader,
      currentTime: Temporal.Instant.from("2024-03-05T07:49:44Z"),
    },
  );
  assertEquals(
    key,
    rsaPublicKey1,
  );

  assertEquals(
    await verify(
      new Request("https://example.com/"),
      {
        documentLoader: mockDocumentLoader,
        contextLoader: mockDocumentLoader,
      },
    ),
    null,
  );
  assertEquals(
    await verify(
      new Request("https://example.com/", {
        headers: { Date: "Tue, 05 Mar 2024 07:49:44 GMT" },
      }),
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
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
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
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
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
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
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
    ),
    null,
  );
  assertEquals(
    await verify(
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
    await verify(
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
    await verify(
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
    await verify(
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
});

test("doesActorOwnKey()", async () => {
  const options = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  };
  const activity = new Create({ actor: new URL("https://example.com/person") });
  assert(await doesActorOwnKey(activity, rsaPublicKey1, options));
  assert(await doesActorOwnKey(activity, rsaPublicKey2, options));

  const activity2 = new Create({
    actor: new URL("https://example.com/hong-gildong"),
  });
  assertFalse(await doesActorOwnKey(activity2, rsaPublicKey1, options));
  assertFalse(await doesActorOwnKey(activity2, rsaPublicKey2, options));
});

test("getKeyOwner()", async () => {
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

  const owner3 = await getKeyOwner(rsaPublicKey1, options);
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

test("generateCryptoKeyPair()", async () => {
  const { privateKey, publicKey } = await generateCryptoKeyPair();
  validateCryptoKey(privateKey, "private");
  validateCryptoKey(publicKey, "public");
});

const publicJwk: JsonWebKey = {
  alg: "RS256",
  kty: "RSA",
  // cSpell: disable
  e: "AQAB",
  n: "oRmBtnxbdFutoRd1GLGwwGTrsqlRRWUe11hHQaoRLGf5LwQ0tIc6I9q-dynliw-2kxYsL" +
    "n9SH2je6HcTYOolgW7F_cOWXZQN04b-OiYcU1ConAhLjmn4k1uKawJ614y0ScPNd8PQ-Cl" +
    "jsnlPxbq9ofaCMe2BV3B6y09aCuGFJ0nxn1_ubjmIBIWWFTAznoz1J9BhJDGyt3IO3ABy3" +
    "f9zDVlR32L_n5VIkXnxkjUKdzMAOzYb62kuKOp1iznRTPrV71SNtivJMwSh_LVgBrmZjtI" +
    "n_oim-KyX_fdLU3tQ7VClyqmJzyAjccOH6Qj6nFTPh-vX07gqN8IlLT2uye4waw",
  // cSpell: enable
  key_ops: ["verify"],
  ext: true,
};

const privateJwk: JsonWebKey = {
  alg: "RS256",
  kty: "RSA",
  // cSpell: disable
  d: "f-Pa2L7Sb4YUSa1wlSEC-0li35uQ3DFRkY0QTG2xYnpMFGoXWTV9D1epGrqU8pePzias" +
    "_mCvFiZPx2Y4aRiYm68P2Mu7hCBz9XfWPN1iYTXIFM51BOLVpk3mjdsTICkgOusJI0m9j" +
    "DR3ZAjwLj14K6qhYvd0VbECmoItLjQoW64Sc9iDgD3CvGoTqv71oTfW70cy-Ve1xQ9CTh" +
    "AmMOTKe6rYCUTA8tMZcPszifZ4iOasOjgvRxyel86LqGNtyslY8k86gQlMtFpR3VeZV_8" +
    "otAWZn0mDc4vVU8HUO-DzYiIFdAcVxfPJh6tx7snCTsdzze_98OEAK4EWYBn7vsGFeQ",
  dp: "lrXReSkZQXSmSxQ1TimV5kMt96gSu4_r-OGIabVmoG5irhjMyN08Jjc3qK9oZS3uNM-Lx" +
    "AOg4OdzefjsF9IMfZJl6wuLd85g_l4BHSaEk5zC8l3QugX1IU9XZ7wDxXUrutMoNtZXDt" +
    "dbveAMtHNZlIu-qmEBDWzkqJiz2WpW-AE",
  dq: "TCLoYcX0ywuNA9DSU6v94KmBh1e_IELEFVbJb5vvLKlAK-ycMK0rfzC1co9Hhkski1Lsk" +
    "TnxnoqwZ5oF-7X10eZvy3Te_FHSl0IsTar8ST2-MRtGh2UjTdvP_nnygj4GcXvKfngjPE" +
    "fthDzVfVMeR38oDhDxMFD5AaY_v9aMH_U",
  e: "AQAB",
  n: "oRmBtnxbdFutoRd1GLGwwGTrsqlRRWUe11hHQaoRLGf5LwQ0tIc6I9q-dynliw-2kxYs" +
    "Ln9SH2je6HcTYOolgW7F_cOWXZQN04b-OiYcU1ConAhLjmn4k1uKawJ614y0ScPNd8PQ-" +
    "CljsnlPxbq9ofaCMe2BV3B6y09aCuGFJ0nxn1_ubjmIBIWWFTAznoz1J9BhJDGyt3IO3A" +
    "By3f9zDVlR32L_n5VIkXnxkjUKdzMAOzYb62kuKOp1iznRTPrV71SNtivJMwSh_LVgBrm" +
    "ZjtIn_oim-KyX_fdLU3tQ7VClyqmJzyAjccOH6Qj6nFTPh-vX07gqN8IlLT2uye4waw",
  p: "xuDd7tE_47NWwvDTpB403X13EPA3768MlNpl_v_BGiuP-1uvWUnsOVZB0F3HXSVg1sBV" +
    "Ntec46v7OU0P693gvYUhouTmSQpayY_VFqMklprWgs7cfneqbeDzv3C4Fw5waY-vjoIND" +
    "sE1jYELUnl5cVjXXyxuGFG-IaLJKmHmHX0",
  q: "z17X2t9zO6WcMp6W04gXdKmniJlxekOrOmWnrX9AwaM8NYCLN3y23r59nqNP9aUAWG1eo" +
    "GFmav2rYQitWhz_VsEu2pQUsfsYKZYHchu5p_jCYwuM3rIg7aCbhtGv_tBoWAf1NvKMhtp" +
    "2es0ZaHZCzKDGSOkIYDOB-ZDmNigWigc",
  qi: "KC6gWhVM_x7iQgl-gEoSh_iM1Jf314ZLJKAAz1DsTHMi5yuCkCMmmY7h6jlkAJVngK3KI" +
    "f5LPoAeUoGJ26E1kocbRU_nZBftMDVXHCYICz8qMQXR5euN_5SeJnu_VWXH-CY83MKhPY" +
    "AorWSZ1-G9gh-C16LlRMzJwoE6h5QNeNo",
  // cSpell: enable
  key_ops: ["sign"],
  ext: true,
};

test("exportJwk()", async () => {
  assertEquals(await exportJwk(rsaPrivateKey2), privateJwk);
  assertEquals(await exportJwk(rsaPublicKey2.publicKey!), publicJwk);
});

test("importJwk()", async () => {
  assertEquals(await importJwk(privateJwk, "private"), rsaPrivateKey2);
  assertEquals(await importJwk(publicJwk, "public"), rsaPublicKey2.publicKey!);
  assertRejects(() => importJwk(publicJwk, "private"));
  assertRejects(() => importJwk(privateJwk, "public"));
});
