import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert@^0.218.2";
import {
  exportJwk,
  generateCryptoKeyPair,
  importJwk,
  validateCryptoKey,
} from "./key.ts";
import { privateKey2, publicKey2 } from "../testing/keys.ts";

Deno.test("validateCryptoKey()", async () => {
  const pkcs1v15 = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  validateCryptoKey(pkcs1v15.privateKey, "private");
  validateCryptoKey(pkcs1v15.privateKey);
  validateCryptoKey(pkcs1v15.publicKey, "public");
  validateCryptoKey(pkcs1v15.publicKey);

  assertThrows(
    () => validateCryptoKey(pkcs1v15.privateKey, "public"),
    TypeError,
    "The key is not a public key.",
  );
  assertThrows(
    () => validateCryptoKey(pkcs1v15.publicKey, "private"),
    TypeError,
    "The key is not a private key.",
  );

  const ecdsa = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );
  assertThrows(
    () => validateCryptoKey(ecdsa.publicKey),
    TypeError,
    "only RSASSA-PKCS1-v1_5",
  );

  const pkcs1v15Sha512 = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-512",
    },
    true,
    ["sign", "verify"],
  );
  assertThrows(
    () => validateCryptoKey(pkcs1v15Sha512.privateKey),
    TypeError,
    "hash algorithm must be SHA-256",
  );
});

Deno.test("generateCryptoKeyPair()", async () => {
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

Deno.test("exportJwk()", async () => {
  assertEquals(await exportJwk(privateKey2), privateJwk);
  assertEquals(await exportJwk(publicKey2.publicKey!), publicJwk);
});

Deno.test("importJwk()", async () => {
  assertEquals(await importJwk(privateJwk, "private"), privateKey2);
  assertEquals(await importJwk(publicJwk, "public"), publicKey2.publicKey!);
  assertRejects(() => importJwk(publicJwk, "private"));
  assertRejects(() => importJwk(privateJwk, "public"));
});
