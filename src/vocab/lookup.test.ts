import { toArray } from "@hongminhee/aitertools";
import { assertEquals, assertInstanceOf } from "@std/assert";
import * as mf from "mock_fetch";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { test } from "../testing/mod.ts";
import { lookupObject, traverseCollection } from "./lookup.ts";
import { Collection, Note, Object, Person } from "./vocab.ts";

test("lookupObject()", async (t) => {
  mf.install();

  mf.mock("GET@/.well-known/webfinger", (req) => {
    assertEquals(new URL(req.url).host, "example.com");
    return new Response(
      JSON.stringify({
        subject: "acct:johndoe@example.com",
        links: [
          {
            rel: "alternate",
            href: "https://example.com/object",
            type: "application/activity+json",
          },
          {
            rel: "self",
            href: "https://example.com/html/person",
            type: "text/html",
          },
          {
            rel: "self",
            href: "https://example.com/person",
            type: "application/activity+json",
          },
        ],
      }),
    );
  });

  const options = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  };

  await t.step("actor", async () => {
    const person = await lookupObject("@johndoe@example.com", options);
    assertInstanceOf(person, Person);
    assertEquals(person.id, new URL("https://example.com/person"));
    assertEquals(person.name, "John Doe");
    const person2 = await lookupObject("johndoe@example.com", options);
    assertEquals(person2, person);
    const person3 = await lookupObject("acct:johndoe@example.com", options);
    assertEquals(person3, person);
  });

  await t.step("object", async () => {
    const object = await lookupObject("https://example.com/object", options);
    assertInstanceOf(object, Object);
    assertEquals(
      object,
      new Object({
        id: new URL("https://example.com/object"),
        name: "Fetched object",
      }),
    );
    const person = await lookupObject(
      "https://example.com/hong-gildong",
      options,
    );
    assertInstanceOf(person, Person);
    assertEquals(
      person,
      new Person({
        id: new URL("https://example.com/hong-gildong"),
        name: "Hong Gildong",
      }),
    );
  });

  mf.mock("GET@/.well-known/webfinger", (req) => {
    assertEquals(new URL(req.url).host, "example.com");
    return new Response(
      JSON.stringify({
        subject: "acct:janedoe@example.com",
        links: [
          {
            rel: "self",
            href: "https://example.com/404",
            type: "application/activity+json",
          },
        ],
      }),
    );
  });

  await t.step("not found", async () => {
    assertEquals(await lookupObject("janedoe@example.com", options), null);
    assertEquals(await lookupObject("https://example.com/404", options), null);
  });

  mf.uninstall();
});

test("traverseCollection()", async () => {
  const options = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  };
  const collection = await lookupObject(
    "https://example.com/collection",
    options,
  );
  assertInstanceOf(collection, Collection);
  assertEquals(
    await toArray(traverseCollection(collection, options)),
    [
      new Note({ content: "This is a simple note" }),
      new Note({ content: "This is another simple note" }),
      new Note({ content: "This is a third simple note" }),
    ],
  );
  const pagedCollection = await lookupObject(
    "https://example.com/paged-collection",
    options,
  );
  assertInstanceOf(pagedCollection, Collection);
  assertEquals(
    await toArray(traverseCollection(pagedCollection, options)),
    [
      new Note({ content: "This is a simple note" }),
      new Note({ content: "This is another simple note" }),
      new Note({ content: "This is a third simple note" }),
    ],
  );
});

// cSpell: ignore gildong
