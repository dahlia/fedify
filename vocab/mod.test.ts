import {
  assertEquals,
  assertInstanceOf,
  assertNotEquals,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert@^0.218.2";
import { toArray } from "https://deno.land/x/aitertools@0.5.0/mod.ts";
import { LanguageString } from "../runtime/langstr.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import {
  Activity,
  Create,
  CryptographicKey,
  Follow,
  Note,
  Object,
  Person,
  Place,
} from "./mod.ts";

Deno.test("new Object()", () => {
  const obj = new Object({
    name: "Test",
    contents: [
      new LanguageString("Hello", "en"),
      new LanguageString("你好", "zh"),
    ],
  });
  assertEquals(obj.name, "Test");
  assertEquals(obj.contents[0], new LanguageString("Hello", "en"));
  assertEquals(obj.contents[1], new LanguageString("你好", "zh"));

  assertThrows(
    () => new Object({ name: "singular", names: ["plural"] }),
    TypeError,
    "Cannot initialize both name and names at the same time.",
  );
});

Deno.test("Object.fromJsonLd()", async () => {
  const obj = await Object.fromJsonLd({
    "@context": "https://www.w3.org/ns/activitystreams",
    "type": "Object",
    "name": "Test",
    "contentMap": {
      "en": "Hello",
      "zh": "你好",
    },
  }, { documentLoader: mockDocumentLoader });
  assertInstanceOf(obj, Object);
  assertEquals(obj.name, "Test");
  assertEquals(obj.contents, [
    new LanguageString("Hello", "en"),
    new LanguageString("你好", "zh"),
  ]);

  const create = await Object.fromJsonLd({
    "@context": "https://www.w3.org/ns/activitystreams",
    "type": "Create",
    "name": "Test",
    "contentMap": {
      "en": "Hello",
      "zh": "你好",
    },
    "object": {
      "type": "Note",
      "content": "Content",
    },
  }, { documentLoader: mockDocumentLoader });
  assertInstanceOf(create, Create);
  assertEquals(create.name, "Test");
  assertEquals(create.contents, [
    new LanguageString("Hello", "en"),
    new LanguageString("你好", "zh"),
  ]);
  const note = await create.getObject();
  assertInstanceOf(note, Note);
  assertEquals(note.content, "Content");

  const empty = await Object.fromJsonLd({});
  assertInstanceOf(empty, Object);

  await assertRejects(
    () => Object.fromJsonLd(null),
    TypeError,
    "Invalid JSON-LD: null.",
  );
  await assertRejects(
    () => Object.fromJsonLd(undefined),
    TypeError,
    "Invalid JSON-LD: undefined.",
  );
});

Deno.test("Object.toJsonLd()", async () => {
  const obj = new Object({
    name: "Test",
    contents: [
      new LanguageString("Hello", "en"),
      new LanguageString("你好", "zh"),
    ],
  });
  assertEquals(
    await obj.toJsonLd({ expand: true, documentLoader: mockDocumentLoader }),
    [
      {
        "@type": [
          "https://www.w3.org/ns/activitystreams#Object",
        ],
        "https://www.w3.org/ns/activitystreams#name": [
          { "@value": "Test" },
        ],
        "https://www.w3.org/ns/activitystreams#content": [
          { "@value": "Hello", "@language": "en" },
          { "@value": "你好", "@language": "zh" },
        ],
      },
    ],
  );
  assertEquals(await obj.toJsonLd({ documentLoader: mockDocumentLoader }), {
    "@context": "https://www.w3.org/ns/activitystreams",
    "type": "Object",
    "name": "Test",
    "contentMap": {
      "en": "Hello",
      "zh": "你好",
    },
  });
});

Deno.test("Activity.fromJsonLd()", async () => {
  const follow = await Activity.fromJsonLd({
    "@context": "https://www.w3.org/ns/activitystreams",
    id: "https://activitypub.academy/80c50305-7405-4e38-809f-697647a1f679",
    type: "Follow",
    actor: "https://activitypub.academy/users/egulia_anbeiss",
    object: "https://example.com/users/hongminhee",
  }, { documentLoader: mockDocumentLoader });
  assertInstanceOf(follow, Follow);
  assertEquals(
    follow.id,
    new URL("https://activitypub.academy/80c50305-7405-4e38-809f-697647a1f679"),
  );
  assertEquals(
    follow.actorId,
    new URL("https://activitypub.academy/users/egulia_anbeiss"),
  );
  assertEquals(
    follow.objectId,
    new URL("https://example.com/users/hongminhee"),
  );
});

Deno.test("Activity.getObject()", async () => {
  const activity = new Activity({
    object: new URL("https://example.com/object"),
  });
  const object = await activity.getObject({
    documentLoader: mockDocumentLoader,
  });
  assertInstanceOf(object, Object);
  assertEquals(object.id, new URL("https://example.com/object"));
  assertEquals(object.name, "Fetched object");
});

Deno.test("Activity.getObjects()", async () => {
  const activity = new Activity({
    objects: [
      new URL("https://example.com/object"),
      new Object({
        name: "Second object",
      }),
    ],
  });
  const objects = await toArray(
    activity.getObjects({ documentLoader: mockDocumentLoader }),
  );
  assertEquals(objects.length, 2);
  assertInstanceOf(objects[0], Object);
  assertEquals(objects[0].id, new URL("https://example.com/object"));
  assertEquals(objects[0].name, "Fetched object");
  assertInstanceOf(objects[1], Object);
  assertEquals(objects[1].name, "Second object");
});

Deno.test("Activity.clone()", async () => {
  const activity = new Activity({
    actor: new Person({
      name: "John Doe",
    }),
    object: new Object({
      name: "Test",
    }),
    name: "Test",
    summary: "Test",
  });
  const clone = activity.clone({
    object: new Object({
      name: "Modified",
    }),
    summary: "Modified",
  });
  assertEquals((await activity.getActor())?.name, "John Doe");
  assertEquals((await clone.getActor())?.name, "John Doe");
  assertEquals((await activity.getObject())?.name, "Test");
  assertEquals((await clone.getObject())?.name, "Modified");
  assertEquals(activity.name, "Test");
  assertEquals(clone.name, "Test");
  assertEquals(activity.summary, "Test");
  assertEquals(clone.summary, "Modified");

  assertThrows(
    () => activity.clone({ summary: "singular", summaries: ["plural"] }),
    TypeError,
    "Cannot update both summary and summaries at the same time.",
  );
});

Deno.test("Deno.inspect(Object)", () => {
  const obj = new Object({
    id: new URL("https://example.com/"),
    attributedTo: new URL("https://example.com/foo"),
    name: "Test",
    contents: [
      new LanguageString("Hello", "en"),
      new LanguageString("你好", "zh"),
    ],
  });
  assertEquals(
    Deno.inspect(obj, { colors: false, sorted: true, compact: false }),
    "Object {\n" +
      '  attributedTo: URL "https://example.com/foo",\n' +
      "  contents: [\n" +
      '    <en> "Hello",\n' +
      '    <zh> "你好"\n' +
      "  ],\n" +
      '  id: URL "https://example.com/",\n' +
      '  name: "Test"\n' +
      "}",
  );
});

Deno.test("Person.fromJsonLd()", async () => {
  const person = await Person.fromJsonLd({
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
    ],
    "publicKey": {
      "id": "https://todon.eu/users/hongminhee#main-key",
      "owner": "https://todon.eu/users/hongminhee",
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n" +
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxsRuvCkgJtflBTl4OVsm\n" +
        "nt/J1mQfZasfJtN33dcZ3d1lJroxmgmMu69zjGEAwkNbMQaWNLqC4eogkJaeJ4RR\n" +
        "5MHYXkL9nNilVoTkjX5BVit3puzs7XJ7WQnKQgQMI+ezn24GHsZ/v1JIo77lerX5\n" +
        "k4HNwTNVt+yaZVQWaOMR3+6FwziQR6kd0VuG9/a9dgAnz2cEoORRC1i4W7IZaB1s\n" +
        "Znh1WbHbevlGd72HSXll5rocPIHn8gq6xpBgpHwRphlRsgn4KHaJ6brXDIJjrnQh\n" +
        "Ie/YUBOGj/ImSEXhRwlFerKsoAVnZ0Hwbfa46qk44TAt8CyoPMWmpK6pt0ng4pQ2\n" +
        "uwIDAQAB\n" +
        "-----END PUBLIC KEY-----\n",
    },
  }, { documentLoader: mockDocumentLoader });
  assertEquals(
    person.publicKeyId,
    new URL("https://todon.eu/users/hongminhee#main-key"),
  );
  const publicKey = await person.getPublicKey({
    documentLoader: mockDocumentLoader,
  });
  assertInstanceOf(publicKey, CryptographicKey);
  assertEquals(
    publicKey?.ownerId,
    new URL("https://todon.eu/users/hongminhee"),
  );
});

Deno.test("Key.publicKey", async () => {
  const jwk = {
    kty: "RSA",
    alg: "RS256",
    // cSpell: disable
    n: "xsRuvCkgJtflBTl4OVsmnt_J1mQfZasfJtN33dcZ3d1lJroxmgmMu69zjGEAwkNbMQaWNLqC4eogkJaeJ4RR5MHYXkL9nNilVoTkjX5BVit3puzs7XJ7WQnKQgQMI-ezn24GHsZ_v1JIo77lerX5k4HNwTNVt-yaZVQWaOMR3-6FwziQR6kd0VuG9_a9dgAnz2cEoORRC1i4W7IZaB1sZnh1WbHbevlGd72HSXll5rocPIHn8gq6xpBgpHwRphlRsgn4KHaJ6brXDIJjrnQhIe_YUBOGj_ImSEXhRwlFerKsoAVnZ0Hwbfa46qk44TAt8CyoPMWmpK6pt0ng4pQ2uw",
    e: "AQAB",
    // cSpell: enable
    key_ops: ["verify"],
    ext: true,
  };
  const key = new CryptographicKey({
    publicKey: await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"],
    ),
  });
  const jsonLd = await key.toJsonLd({ documentLoader: mockDocumentLoader });
  assertEquals(jsonLd, {
    "@context": "https://w3id.org/security/v1",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\n" +
      // cSpell: disable
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxsRuvCkgJtflBTl4OVsm\n" +
      "nt/J1mQfZasfJtN33dcZ3d1lJroxmgmMu69zjGEAwkNbMQaWNLqC4eogkJaeJ4RR\n" +
      "5MHYXkL9nNilVoTkjX5BVit3puzs7XJ7WQnKQgQMI+ezn24GHsZ/v1JIo77lerX5\n" +
      "k4HNwTNVt+yaZVQWaOMR3+6FwziQR6kd0VuG9/a9dgAnz2cEoORRC1i4W7IZaB1s\n" +
      "Znh1WbHbevlGd72HSXll5rocPIHn8gq6xpBgpHwRphlRsgn4KHaJ6brXDIJjrnQh\n" +
      "Ie/YUBOGj/ImSEXhRwlFerKsoAVnZ0Hwbfa46qk44TAt8CyoPMWmpK6pt0ng4pQ2\n" +
      "uwIDAQAB\n" +
      // cSpell: enable
      "-----END PUBLIC KEY-----",
    type: "CryptographicKey",
  });
  const loadedKey = await CryptographicKey.fromJsonLd(jsonLd, {
    documentLoader: mockDocumentLoader,
  });
  assertNotEquals(loadedKey.publicKey, null);
  assertEquals(await crypto.subtle.exportKey("jwk", loadedKey.publicKey!), jwk);
});

Deno.test("Place.fromJsonLd()", async () => {
  const place = await Place.fromJsonLd({
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "Place",
    name: "Fresno Area",
    latitude: 36.75,
    longitude: 119.7667,
    radius: 15,
    units: "miles",
  }, { documentLoader: mockDocumentLoader });
  assertInstanceOf(place, Place);
  assertEquals(place.name, "Fresno Area");
  assertEquals(place.latitude, 36.75);
  assertEquals(place.longitude, 119.7667);
  assertEquals(place.radius, 15);
  assertEquals(place.units, "miles");

  const jsonLd = await place.toJsonLd({ documentLoader: mockDocumentLoader });
  assertEquals(jsonLd, {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "Place",
    name: "Fresno Area",
    latitude: 36.75,
    longitude: 119.7667,
    radius: 15,
    units: "miles",
  });
});
