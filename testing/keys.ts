import { CryptographicKey } from "../vocab/vocab.ts";

export const publicKey1 = new CryptographicKey({
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

export const privateKey2 = await crypto.subtle.importKey(
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

export const publicKey2 = new CryptographicKey({
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
