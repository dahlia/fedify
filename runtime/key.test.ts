import { assertEquals } from "@std/assert";
import { exportJwk, importJwk } from "../sig/key.ts";
import { exportSpki, importSpki } from "./key.ts";

// cSpell: disable
const pem = "-----BEGIN PUBLIC KEY-----\n" +
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxsRuvCkgJtflBTl4OVsm\n" +
  "nt/J1mQfZasfJtN33dcZ3d1lJroxmgmMu69zjGEAwkNbMQaWNLqC4eogkJaeJ4RR\n" +
  "5MHYXkL9nNilVoTkjX5BVit3puzs7XJ7WQnKQgQMI+ezn24GHsZ/v1JIo77lerX5\n" +
  "k4HNwTNVt+yaZVQWaOMR3+6FwziQR6kd0VuG9/a9dgAnz2cEoORRC1i4W7IZaB1s\n" +
  "Znh1WbHbevlGd72HSXll5rocPIHn8gq6xpBgpHwRphlRsgn4KHaJ6brXDIJjrnQh\n" +
  "Ie/YUBOGj/ImSEXhRwlFerKsoAVnZ0Hwbfa46qk44TAt8CyoPMWmpK6pt0ng4pQ2\n" +
  "uwIDAQAB\n" +
  "-----END PUBLIC KEY-----\n";
// cSpell: enable

const jwk = {
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

Deno.test("importSpki()", async () => {
  const key = await importSpki(pem);
  assertEquals(await exportJwk(key), jwk);
});

Deno.test("exportSpki()", async () => {
  const key = await importJwk(jwk, "public");
  const spki = await exportSpki(key);
  assertEquals(spki, pem);
});
