import { isDeno } from "@david/which-runtime";
import { toArray } from "@hongminhee/aitertools";
import { parseLanguageTag } from "@phensley/language-tag";
import {
  assertEquals,
  assertFalse,
  assertInstanceOf,
  assertNotEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { assertSnapshot } from "@std/testing/snapshot";
import { toPascalCase } from "@std/text";
import {
  loadSchemaFiles,
  type PropertySchema,
  type TypeSchema,
} from "../codegen/schema.ts";
import { areAllScalarTypes } from "../codegen/type.ts";
import { LanguageString } from "../runtime/langstr.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { ed25519PublicKey, rsaPublicKey1 } from "../testing/keys.ts";
import * as vocab from "./vocab.ts";
import {
  Activity,
  Announce,
  Create,
  CryptographicKey,
  Follow,
  Note,
  Object,
  Person,
  Place,
} from "./vocab.ts";

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
  }, { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader });
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
  }, { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader });
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
    await obj.toJsonLd({ expand: true, contextLoader: mockDocumentLoader }),
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
  assertEquals(await obj.toJsonLd({ contextLoader: mockDocumentLoader }), {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      { sensitive: "as:sensitive" },
    ],
    type: "Object",
    name: "Test",
    contentMap: {
      en: "Hello",
      zh: "你好",
    },
  });
});

Deno.test("Activity.fromJsonLd()", async () => {
  const follow = await Activity.fromJsonLd(
    {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: "https://activitypub.academy/80c50305-7405-4e38-809f-697647a1f679",
      type: "Follow",
      actor: "https://activitypub.academy/users/egulia_anbeiss",
      object: "https://example.com/users/hongminhee",
    },
    { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
  );
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
    object: new URL("https://example.com/announce"),
  });
  const announce = await activity.getObject({
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  });
  assertInstanceOf(announce, Announce);
  assertEquals(announce.id, new URL("https://example.com/announce"));

  const object = await announce.getObject();
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
    activity.getObjects({
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    }),
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
    attribution: new URL("https://example.com/foo"),
    name: "Test",
    contents: [
      new LanguageString("Hello", "en"),
      new LanguageString("你好", "zh"),
    ],
  });
  assertEquals(
    Deno.inspect(obj, { colors: false, sorted: true, compact: false }),
    isDeno
      ? "Object {\n" +
        '  attribution: URL "https://example.com/foo",\n' +
        "  contents: [\n" +
        '    <en> "Hello",\n' +
        '    <zh> "你好"\n' +
        "  ],\n" +
        '  id: URL "https://example.com/",\n' +
        '  name: "Test"\n' +
        "}"
      : "Object {\n" +
        "  attribution: URL 'https://example.com/foo',\n" +
        "  contents: [\n" +
        "    <en> 'Hello',\n" +
        "    <zh> '你好'\n" +
        "  ],\n" +
        "  id: URL 'https://example.com/',\n" +
        "  name: 'Test'\n" +
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
      // cSpell: disable
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n" +
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxsRuvCkgJtflBTl4OVsm\n" +
        "nt/J1mQfZasfJtN33dcZ3d1lJroxmgmMu69zjGEAwkNbMQaWNLqC4eogkJaeJ4RR\n" +
        "5MHYXkL9nNilVoTkjX5BVit3puzs7XJ7WQnKQgQMI+ezn24GHsZ/v1JIo77lerX5\n" +
        "k4HNwTNVt+yaZVQWaOMR3+6FwziQR6kd0VuG9/a9dgAnz2cEoORRC1i4W7IZaB1s\n" +
        "Znh1WbHbevlGd72HSXll5rocPIHn8gq6xpBgpHwRphlRsgn4KHaJ6brXDIJjrnQh\n" +
        "Ie/YUBOGj/ImSEXhRwlFerKsoAVnZ0Hwbfa46qk44TAt8CyoPMWmpK6pt0ng4pQ2\n" +
        "uwIDAQAB\n" +
        "-----END PUBLIC KEY-----\n",
      // cSpell: enable
    },
  }, { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader });
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
    n: "xsRuvCkgJtflBTl4OVsmnt_J1mQfZasfJtN33dcZ3d1lJroxmgmMu69zjGEAwkNbMQaWN" +
      "LqC4eogkJaeJ4RR5MHYXkL9nNilVoTkjX5BVit3puzs7XJ7WQnKQgQMI-ezn24GHsZ_v1J" +
      "Io77lerX5k4HNwTNVt-yaZVQWaOMR3-6FwziQR6kd0VuG9_a9dgAnz2cEoORRC1i4W7IZa" +
      "B1sZnh1WbHbevlGd72HSXll5rocPIHn8gq6xpBgpHwRphlRsgn4KHaJ6brXDIJjrnQhIe_" +
      "YUBOGj_ImSEXhRwlFerKsoAVnZ0Hwbfa46qk44TAt8CyoPMWmpK6pt0ng4pQ2uw",
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
  const jsonLd = await key.toJsonLd({ contextLoader: mockDocumentLoader });
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
      "-----END PUBLIC KEY-----\n",
    type: "CryptographicKey",
  });
  const loadedKey = await CryptographicKey.fromJsonLd(jsonLd, {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
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
  }, { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader });
  assertInstanceOf(place, Place);
  assertEquals(place.name, "Fresno Area");
  assertEquals(place.latitude, 36.75);
  assertEquals(place.longitude, 119.7667);
  assertEquals(place.radius, 15);
  assertEquals(place.units, "miles");

  const jsonLd = await place.toJsonLd({ contextLoader: mockDocumentLoader });
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

function getAllProperties(
  type: TypeSchema,
  types: Record<string, TypeSchema>,
): PropertySchema[] {
  const props: PropertySchema[] = type.properties;
  if (type.extends != null) {
    props.push(...getAllProperties(types[type.extends], types));
  }
  return props;
}

// deno-lint-ignore no-explicit-any
const sampleValues: Record<string, any> = {
  "http://www.w3.org/2001/XMLSchema#boolean": true,
  "http://www.w3.org/2001/XMLSchema#integer": -123,
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger": 123,
  "http://www.w3.org/2001/XMLSchema#float": 12.34,
  "http://www.w3.org/2001/XMLSchema#string": "hello",
  "http://www.w3.org/2001/XMLSchema#anyURI": new URL("https://example.com/"),
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString": new LanguageString(
    "hello",
    "en",
  ),
  "http://www.w3.org/2001/XMLSchema#dateTime": Temporal.Instant.from(
    "2024-03-03T08:30:06.796196096Z",
  ),
  "http://www.w3.org/2001/XMLSchema#duration": Temporal.Duration.from({
    hours: 1,
  }),
  "fedify:langTag": parseLanguageTag("en"),
  "fedify:publicKey": rsaPublicKey1.publicKey,
  "fedify:multibaseKey": ed25519PublicKey.publicKey,
  "fedify:units": "m",
};

const types = await loadSchemaFiles(import.meta.dirname!);
for (const typeUri in types) {
  const type = types[typeUri];
  // @ts-ignore: classes are all different
  const cls = vocab[type.name];
  sampleValues[typeUri] = new cls({
    "@id": "https://example.com/",
    "@type": typeUri,
  });
}

for (const typeUri in types) {
  const type = types[typeUri];
  // @ts-ignore: classes are all different
  const cls = vocab[type.name];
  const allProperties = getAllProperties(type, types);
  const initValues = globalThis.Object.fromEntries(
    allProperties.map((property) =>
      !property.functional
        ? [property.pluralName, property.range.map((t) => sampleValues[t])]
        : [property.singularName, sampleValues[property.range[0]]]
    ),
  );

  Deno.test(`new ${type.name}() [auto]`, async () => {
    const instance = new cls(initValues);
    for (const property of allProperties) {
      if (areAllScalarTypes(property.range, types)) {
        if (property.functional || property.singularAccessor) {
          assertEquals(
            instance[property.singularName],
            sampleValues[property.range[0]],
          );
        }
        if (!property.functional) {
          assertEquals(
            instance[property.pluralName],
            property.range.map((t) => sampleValues[t]),
          );
        }
      } else {
        if (property.functional || property.singularAccessor) {
          assertEquals(
            await instance[`get${toPascalCase(property.singularName)}`].call(
              instance,
              { documentLoader: mockDocumentLoader },
            ),
            sampleValues[property.range[0]],
          );
          assertEquals(
            instance[`${property.singularName}Id`],
            sampleValues[property.range[0]].id,
          );
        }
        if (!property.functional) {
          assertEquals(
            await toArray(
              instance[`get${toPascalCase(property.pluralName)}`].call(
                instance,
                { documentLoader: mockDocumentLoader },
              ),
            ),
            property.range.map((t) => sampleValues[t]),
          );
          assertEquals(
            instance[`${property.singularName}Ids`],
            property.range.map((t) => sampleValues[t].id).filter((i) =>
              i != null
            ),
          );
        }
      }

      const empty = new cls({});
      for (const property of allProperties) {
        if (areAllScalarTypes(property.range, types)) {
          if (property.functional || property.singularAccessor) {
            assertEquals(empty[property.singularName], null);
          }
          if (!property.functional) {
            assertEquals(empty[property.pluralName], []);
          }
        } else {
          if (property.functional || property.singularAccessor) {
            assertEquals(
              await empty[`get${toPascalCase(property.singularName)}`].call(
                empty,
                { documentLoader: mockDocumentLoader },
              ),
              null,
            );
            assertEquals(empty[`${property.singularName}Id`], null);
          }
          if (!property.functional) {
            assertEquals(
              await toArray(
                empty[`get${toPascalCase(property.pluralName)}`].call(
                  empty,
                  { documentLoader: mockDocumentLoader },
                ),
              ),
              [],
            );
            assertEquals(empty[`${property.singularName}Ids`], []);
          }
        }
      }
    }

    for (const property of allProperties) {
      if (!property.functional && property.singularAccessor) {
        assertThrows(
          () =>
            new cls({
              [property.singularName]: sampleValues[property.range[0]],
              [property.pluralName]: property.range.map((t) => sampleValues[t]),
            }),
          TypeError,
        );
      }
    }

    const instance2 = new cls({
      id: new URL("https://example.com/"),
      ...globalThis.Object.fromEntries(
        allProperties.filter((p) => !areAllScalarTypes(p.range, types)).map(
          (p) =>
            p.functional
              ? [p.singularName, new URL("https://example.com/test")]
              : [p.pluralName, [new URL("https://example.com/test")]],
        ),
      ),
    });
    for (const property of allProperties) {
      if (areAllScalarTypes(property.range, types)) continue;
      if (property.functional || property.singularAccessor) {
        assertEquals(
          instance2[`${property.singularName}Id`],
          new URL("https://example.com/test"),
        );
      }
      if (!property.functional) {
        assertEquals(
          instance2[`${property.singularName}Ids`],
          [new URL("https://example.com/test")],
        );
      }
    }
  });

  Deno.test(`${type.name}.clone() [auto]`, () => {
    const instance = new cls({});
    for (const property of allProperties) {
      if (!property.functional && property.singularAccessor) {
        assertThrows(
          () =>
            instance.clone({
              [property.singularName]: sampleValues[property.range[0]],
              [property.pluralName]: property.range.map((t) => sampleValues[t]),
            }),
          TypeError,
        );
      }
    }
  });

  for (const property of allProperties) {
    if (areAllScalarTypes(property.range, types)) continue;

    const docLoader = (url: string) => {
      if (url !== `https://example.com/test`) throw new Error("Not Found");
      return {
        documentUrl: url,
        contextUrl: null,
        document: sampleValues[property.range[0]].toJsonLd({
          contextLoader: mockDocumentLoader,
        }),
      };
    };

    if (property.functional || property.singularAccessor) {
      Deno.test(`${type.name}.get${toPascalCase(property.singularName)}() [auto]`, async () => {
        const instance = new cls({
          [property.singularName]: new URL("https://example.com/test"),
        });
        const value =
          await instance[`get${toPascalCase(property.singularName)}`]
            .call(instance, { documentLoader: docLoader });
        assertEquals(value, sampleValues[property.range[0]]);

        if (property.untyped) return;
        const wrongRef = new cls({
          [property.singularName]: new URL("https://example.com/wrong-type"),
        });
        await assertRejects(
          () =>
            wrongRef[`get${toPascalCase(property.singularName)}`].call(
              wrongRef,
              {
                documentLoader: mockDocumentLoader,
              },
            ),
          TypeError,
        );
      });
    }
    if (!property.functional) {
      Deno.test(`${type.name}.get${toPascalCase(property.pluralName)}() [auto]`, async () => {
        const instance = new cls({
          [property.pluralName]: [new URL("https://example.com/test")],
        });
        const value = instance[`get${toPascalCase(property.pluralName)}`].call(
          instance,
          { documentLoader: docLoader },
        );
        assertEquals(await toArray(value), [sampleValues[property.range[0]]]);

        if (property.untyped) return;
        const wrongRef = new cls({
          [property.pluralName]: [new URL("https://example.com/wrong-type")],
        });
        await assertRejects(
          () =>
            toArray(wrongRef[`get${toPascalCase(property.pluralName)}`].call(
              wrongRef,
              {
                documentLoader: mockDocumentLoader,
              },
            )),
          TypeError,
        );
      });
    }
  }

  Deno.test(`${type.name}.fromJsonLd() [auto]`, async () => {
    const instance = await cls.fromJsonLd(
      {
        "@id": "https://example.com/",
        "@type": typeUri,
      },
      { documentLoader: mockDocumentLoader, contextLoader: mockDocumentLoader },
    );
    assertInstanceOf(instance, cls);
    assertEquals(instance.id, new URL("https://example.com/"));
    assertEquals(
      await instance.toJsonLd({ contextLoader: mockDocumentLoader }),
      {
        "@context": type.defaultContext,
        "id": "https://example.com/",
        "type": type.name === "Endpoints" ? "as:Endpoints" : type.name,
      },
    );

    if (type.extends != null) {
      await assertRejects(() =>
        cls.fromJsonLd({
          "@id": "https://example.com/",
          "@type": "https://example.com/",
        }), TypeError);
    }

    await assertRejects(() => cls.fromJsonLd(null), TypeError);
    await assertRejects(() => cls.fromJsonLd(undefined), TypeError);
  });

  Deno.test(`${type.name}.toJsonLd() [auto]`, async () => {
    const instance = new cls({
      id: new URL("https://example.com/"),
      ...initValues,
    });
    const jsonLd = await instance.toJsonLd({
      contextLoader: mockDocumentLoader,
    });
    assertEquals(jsonLd["@context"], type.defaultContext);
    assertEquals(jsonLd.id, "https://example.com/");
    const restored = await cls.fromJsonLd(jsonLd, {
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    });
    assertEquals(restored, instance);

    const expanded = await instance.toJsonLd({
      contextLoader: mockDocumentLoader,
      expand: true,
    });
    const restored2 = await cls.fromJsonLd(expanded, {
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    });
    assertEquals(restored2, instance);

    const instance2 = new cls({
      id: new URL("https://example.com/"),
      ...initValues,
      ...globalThis.Object.fromEntries(
        allProperties.filter((p) => !areAllScalarTypes(p.range, types)).map(
          (p) =>
            p.functional
              ? [p.singularName, new URL("https://example.com/test")]
              : [p.pluralName, [new URL("https://example.com/test")]],
        ),
      ),
    });
    const jsonLd2 = await instance2.toJsonLd({
      contextLoader: mockDocumentLoader,
    });
    const restored3 = await cls.fromJsonLd(jsonLd2, {
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    });
    assertEquals(restored3, instance2);
  });

  if (isDeno) {
    Deno.test(`Deno.inspect(${type.name}) [auto]`, async (t) => {
      const empty = new cls({});
      assertEquals(Deno.inspect(empty), `${type.name} {}`);

      const instance = new cls({
        id: new URL("https://example.com/"),
        ...initValues,
      });
      await assertSnapshot(t, Deno.inspect(instance));

      const instance2 = instance.clone(
        globalThis.Object.fromEntries(
          type.properties.filter((p) => !areAllScalarTypes(p.range, types)).map(
            (p) =>
              p.functional
                ? [p.singularName, new URL("https://example.com/")]
                : [p.pluralName, [new URL("https://example.com/")]],
          ),
        ),
      );
      await assertSnapshot(t, Deno.inspect(instance2));

      const instance3 = instance.clone(
        globalThis.Object.fromEntries(
          type.properties.filter((p) => !p.functional).map(
            (p) => {
              assertFalse(p.functional);
              return [
                p.pluralName,
                [sampleValues[p.range[0]], sampleValues[p.range[0]]],
              ];
            },
          ),
        ),
      );
      await assertSnapshot(t, Deno.inspect(instance3));
    });
  }

  Deno.test(`${type.name}.typeId`, () => {
    assertEquals(cls.typeId, new URL(type.uri));
  });
}
