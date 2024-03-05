import { assertThrows } from "jsr:@std/assert@^0.218.2";
import { validateCryptoKey } from "./key.ts";

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
