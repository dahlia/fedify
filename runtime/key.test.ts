import { assertEquals } from "@std/assert";
import { exportJwk, importJwk } from "../sig/key.ts";
import {
  exportMultibaseKey,
  exportSpki,
  importMultibaseKey,
  importSpki,
} from "./key.ts";

// cSpell: disable
const rsaPem = "-----BEGIN PUBLIC KEY-----\n" +
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxsRuvCkgJtflBTl4OVsm\n" +
  "nt/J1mQfZasfJtN33dcZ3d1lJroxmgmMu69zjGEAwkNbMQaWNLqC4eogkJaeJ4RR\n" +
  "5MHYXkL9nNilVoTkjX5BVit3puzs7XJ7WQnKQgQMI+ezn24GHsZ/v1JIo77lerX5\n" +
  "k4HNwTNVt+yaZVQWaOMR3+6FwziQR6kd0VuG9/a9dgAnz2cEoORRC1i4W7IZaB1s\n" +
  "Znh1WbHbevlGd72HSXll5rocPIHn8gq6xpBgpHwRphlRsgn4KHaJ6brXDIJjrnQh\n" +
  "Ie/YUBOGj/ImSEXhRwlFerKsoAVnZ0Hwbfa46qk44TAt8CyoPMWmpK6pt0ng4pQ2\n" +
  "uwIDAQAB\n" +
  "-----END PUBLIC KEY-----\n";
// cSpell: enable

const rsaJwk = {
  alg: "RS256",
  // cSpell: disable
  e: "AQAB",
  // cSpell: enable
  ext: true,
  key_ops: ["verify"],
  kty: "RSA",
  // cSpell: disable
  n: "xsRuvCkgJtflBTl4OVsmnt_J1mQfZasfJtN33dcZ3d1lJroxmgmMu69zjGEAwkNbMQaWN" +
    "LqC4eogkJaeJ4RR5MHYXkL9nNilVoTkjX5BVit3puzs7XJ7WQnKQgQMI-ezn24GHsZ_v1J" +
    "Io77lerX5k4HNwTNVt-yaZVQWaOMR3-6FwziQR6kd0VuG9_a9dgAnz2cEoORRC1i4W7IZa" +
    "B1sZnh1WbHbevlGd72HSXll5rocPIHn8gq6xpBgpHwRphlRsgn4KHaJ6brXDIJjrnQhIe_" +
    "YUBOGj_ImSEXhRwlFerKsoAVnZ0Hwbfa46qk44TAt8CyoPMWmpK6pt0ng4pQ2uw",
  // cSpell: enable
};

const rsaMultibase =
  // cSpell: diable
  "z4MXj1wBzi9jUstyPqYMn6Gum79JtbKFiHTibtPRoPeufjdimA24Kg8Q5N7E2eMpgVUtD61kUv" +
  "my4FaT5D5G8XU3ktxeduwEw5FHTtiLCzaruadf6rit1AUPL34UtcPuHh6GxBzTxgFKMMuzcHiU" +
  "zG9wvbxn7toS4H2gbmUn1r91836ET2EVgmSdzju614Wu67ukyBGivcboncdfxPSR5JXwURBaL8" +
  "K2P6yhKn3NyprFV8s6QpN4zgQMAD3Q6fjAsEvGNwXaQTZmEN2yd1NQ7uBE3RJ2XywZnehmfLQT" +
  "EqD7Ad5XM3qfLLd9CtdzJGBkRfunHhkH1kz8dHL7hXwtk5EMXktY4QF5gZ1uisUV5mpPjEgqz7uDz";
// cSpell: enable

// cSpell: disable
const ed25519Pem = "-----BEGIN PUBLIC KEY-----\n" +
  "MCowBQYDK2VwAyEAvrabdlLgVI5jWl7GpF+fLFJVF4ccI8D7h+v5ulBCYwo=\n" +
  "-----END PUBLIC KEY-----\n";
// cSpell: enable

const ed25519Jwk = {
  kty: "OKP",
  crv: "Ed25519",
  // cSpell: disable
  x: "vrabdlLgVI5jWl7GpF-fLFJVF4ccI8D7h-v5ulBCYwo",
  // cSpell: enable
  key_ops: ["verify"],
  ext: true,
};

// cSpell: disable
const ed25519Multibase = "z6MksHj1MJnidCtDiyYW9ugNFftoX9fLK4bornTxmMZ6X7vq";
// cSpell: enable

Deno.test("importSpki()", async () => {
  const rsaKey = await importSpki(rsaPem);
  assertEquals(await exportJwk(rsaKey), rsaJwk);

  const ed25519Key = await importSpki(ed25519Pem);
  assertEquals(await exportJwk(ed25519Key), ed25519Jwk);
});

Deno.test("exportSpki()", async () => {
  const rsaKey = await importJwk(rsaJwk, "public");
  const rsaSpki = await exportSpki(rsaKey);
  assertEquals(rsaSpki, rsaPem);

  const ed25519Key = await importJwk(ed25519Jwk, "public");
  const ed25519Spki = await exportSpki(ed25519Key);
  assertEquals(ed25519Spki, ed25519Pem);
});

Deno.test("importMultibase()", async () => {
  const rsaKey = await importMultibaseKey(rsaMultibase);
  assertEquals(await exportJwk(rsaKey), rsaJwk);

  const ed25519Key = await importMultibaseKey(ed25519Multibase);
  assertEquals(await exportJwk(ed25519Key), ed25519Jwk);
});

Deno.test("exportMultibaseKey()", async () => {
  const rsaKey = await importJwk(rsaJwk, "public");
  const rsaMb = await exportMultibaseKey(rsaKey);
  assertEquals(rsaMb, rsaMultibase);

  const ed25519Key = await importJwk(ed25519Jwk, "public");
  const ed25519Mb = await exportMultibaseKey(ed25519Key);
  assertEquals(ed25519Mb, ed25519Multibase);
});
