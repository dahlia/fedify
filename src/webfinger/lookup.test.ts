import { assertEquals } from "@std/assert";
import { deadline } from "@std/async/deadline";
import * as mf from "mock_fetch";
import { test } from "../testing/mod.ts";
import type { ResourceDescriptor } from "./jrd.ts";
import { lookupWebFinger } from "./lookup.ts";

test("lookupWebFinger()", async (t) => {
  await t.step("invalid resource", async () => {
    assertEquals(await lookupWebFinger("acct:johndoe"), null);
    assertEquals(await lookupWebFinger(new URL("acct:johndoe")), null);
    assertEquals(await lookupWebFinger("acct:johndoe@"), null);
    assertEquals(await lookupWebFinger(new URL("acct:johndoe@")), null);
  });

  await t.step("connection refused", async () => {
    assertEquals(
      await lookupWebFinger("acct:johndoe@fedify-test.internal"),
      null,
    );
    assertEquals(
      await lookupWebFinger("https://fedify-test.internal/foo"),
      null,
    );
  });

  mf.install();
  mf.mock("GET@/.well-known/webfinger", (req) => {
    assertEquals(new URL(req.url).host, "example.com");
    return new Response("", { status: 404 });
  });

  await t.step("not found", async () => {
    assertEquals(await lookupWebFinger("acct:johndoe@example.com"), null);
    assertEquals(await lookupWebFinger("https://example.com/foo"), null);
  });

  const expected: ResourceDescriptor = {
    subject: "acct:johndoe@example.com",
    links: [],
  };
  mf.mock("GET@/.well-known/webfinger", (req) => {
    assertEquals(
      req.url,
      "https://example.com/.well-known/webfinger?resource=acct%3Ajohndoe%40example.com",
    );
    return new Response(JSON.stringify(expected));
  });

  await t.step("acct", async () => {
    assertEquals(await lookupWebFinger("acct:johndoe@example.com"), expected);
  });

  const expected2: ResourceDescriptor = {
    subject: "https://example.com/foo",
    links: [],
  };
  mf.mock("GET@/.well-known/webfinger", (req) => {
    assertEquals(
      req.url,
      "https://example.com/.well-known/webfinger?resource=https%3A%2F%2Fexample.com%2Ffoo",
    );
    return new Response(JSON.stringify(expected2));
  });

  await t.step("https", async () => {
    assertEquals(await lookupWebFinger("https://example.com/foo"), expected2);
  });

  mf.mock("GET@/.well-known/webfinger", (_req) => {
    return new Response("not json");
  });

  await t.step("invalid response", async () => {
    assertEquals(await lookupWebFinger("acct:johndoe@example.com"), null);
  });

  mf.mock("GET@/.well-known/webfinger", (_req) => {
    return new Response(
      JSON.stringify({
        subject: "acct:test@localhost",
        links: [
          {
            rel: "self",
            type: "application/activity+json",
            href: "https://localhost/actor",
          },
        ],
      }),
    );
  });

  await t.step("private address", async () => {
    assertEquals(await lookupWebFinger("acct:test@localhost"), null);
    assertEquals(
      await lookupWebFinger("acct:test@localhost", {
        allowPrivateAddress: true,
      }),
      {
        subject: "acct:test@localhost",
        links: [
          {
            rel: "self",
            type: "application/activity+json",
            href: "https://localhost/actor",
          },
        ],
      },
    );
  });

  mf.mock(
    "GET@/.well-known/webfinger",
    (_) =>
      new Response("", {
        status: 302,
        headers: { Location: "/.well-known/webfinger2" },
      }),
  );
  mf.mock(
    "GET@/.well-known/webfinger2",
    (_) => new Response(JSON.stringify(expected)),
  );

  await t.step("redirection", async () => {
    assertEquals(await lookupWebFinger("acct:johndoe@example.com"), expected);
  });

  mf.mock(
    "GET@/.well-known/webfinger",
    (_) =>
      new Response("", {
        status: 302,
        headers: { Location: "/.well-known/webfinger" },
      }),
  );

  await t.step("infinite redirection", async () => {
    const result = await deadline(
      lookupWebFinger("acct:johndoe@example.com"),
      2000,
    );
    assertEquals(result, null);
  });

  mf.mock(
    "GET@/.well-known/webfinger",
    (_) =>
      new Response("", {
        status: 302,
        headers: { Location: "ftp://example.com/" },
      }),
  );

  await t.step("redirection to different protocol", async () => {
    assertEquals(await lookupWebFinger("acct:johndoe@example.com"), null);
  });

  mf.mock(
    "GET@/.well-known/webfinger",
    (_) =>
      new Response("", {
        status: 302,
        headers: { Location: "https://localhost/" },
      }),
  );

  await t.step("redirection to private address", async () => {
    assertEquals(await lookupWebFinger("acct:johndoe@example.com"), null);
  });

  mf.uninstall();
});

// cSpell: ignore johndoe
