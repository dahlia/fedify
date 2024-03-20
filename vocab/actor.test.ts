import {
  assert,
  assertEquals,
  assertFalse,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import * as fc from "fast-check";
import * as mf from "mock_fetch";
import {
  Actor,
  getActorClassByTypeName,
  getActorHandle,
  getActorTypeName,
  isActor,
} from "./actor.ts";
import { Application, Group, Organization, Person, Service } from "./vocab.ts";

function actorClass(): fc.Arbitrary<
  | typeof Application
  | typeof Group
  | typeof Organization
  | typeof Person
  | typeof Service
> {
  return fc.constantFrom(Application, Group, Organization, Person, Service);
}

function actorClassAndInstance(): fc.Arbitrary<
  | [typeof Application, Application]
  | [typeof Group, Group]
  | [typeof Organization, Organization]
  | [typeof Person, Person]
  | [typeof Service, Service]
> {
  return actorClass().map((cls) =>
    [cls, new cls({})] as (
      | [typeof Application, Application]
      | [typeof Group, Group]
      | [typeof Organization, Organization]
      | [typeof Person, Person]
      | [typeof Service, Service]
    )
  );
}

function actor(): fc.Arbitrary<Actor> {
  return actorClassAndInstance().map(([, instance]) => instance);
}

Deno.test("isActor()", () => {
  fc.assert(fc.property(actor(), (actor) => assert(isActor(actor))));
  fc.assert(
    fc.property(
      fc.anything({
        withBigInt: true,
        withBoxedValues: true,
        withDate: true,
        withMap: true,
        withNullPrototype: true,
        withObjectString: true,
        withSet: true,
        withTypedArray: true,
        withSparseArray: true,
      }),
      (nonActor) => assertFalse(isActor(nonActor)),
    ),
  );
});

Deno.test("getActorTypeName()", () => {
  fc.assert(
    fc.property(
      actorClassAndInstance(),
      ([cls, instance]) => assertEquals(getActorTypeName(instance), cls.name),
    ),
  );
});

Deno.test("getActorClassByTypeName()", () => {
  fc.assert(
    fc.property(
      actorClassAndInstance(),
      ([cls, instance]) =>
        assertStrictEquals(
          getActorClassByTypeName(getActorTypeName(instance)),
          cls,
        ),
    ),
  );
});

Deno.test("getActorHandle()", async (t) => {
  mf.install();

  mf.mock(
    "GET@/.well-known/webfinger",
    (_) =>
      new Response(
        JSON.stringify({ subject: "acct:john@example.com" }),
        { headers: { "Content-Type": "application/jrd+json" } },
      ),
  );

  const actorId = new URL("https://foo.example.com/@john");
  const actor = new Person({
    id: actorId,
    preferredUsername: "john",
  });

  await t.step("WebFinger subject", async () => {
    assertEquals(await getActorHandle(actor), "@john@example.com");
    assertEquals(await getActorHandle(actorId), "@john@example.com");
  });

  mf.mock(
    "GET@/.well-known/webfinger",
    (_) =>
      new Response(
        JSON.stringify({
          subject: "https://foo.example.com/@john",
          aliases: ["acct:john@bar.example.com"],
        }),
        { headers: { "Content-Type": "application/jrd+json" } },
      ),
  );

  await t.step("WebFinger aliases", async () => {
    assertEquals(await getActorHandle(actor), "@john@bar.example.com");
    assertEquals(await getActorHandle(actorId), "@john@bar.example.com");
  });

  mf.mock(
    "GET@/.well-known/webfinger",
    (_) => new Response(null, { status: 404 }),
  );

  await t.step("no WebFinger", async () => {
    assertEquals(await getActorHandle(actor), "@john@foo.example.com");
    assertRejects(() => getActorHandle(actorId), TypeError);
  });

  mf.uninstall();
});
