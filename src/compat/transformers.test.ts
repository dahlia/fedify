import { assertEquals } from "@std/assert/assert-equals";
import { assertNotEquals } from "@std/assert/assert-not-equals";
import { test } from "../testing/mod.ts";
import { Follow, Person } from "../vocab/vocab.ts";
import { actorDehydrator, autoIdAssigner } from "./transformers.ts";

test("autoIdAssigner", async () => {
  const activity = new Follow({
    actor: new URL("http://example.com/actors/1"),
    object: new Person({
      id: new URL("http://example.com/actors/2"),
      name: "Bob",
      preferredUsername: "bob",
    }),
  });
  const result = autoIdAssigner(activity);
  assertNotEquals(result.id, null);
  assertEquals(
    await result.toJsonLd(),
    await new Follow({
      id: result.id,
      actor: new URL("http://example.com/actors/1"),
      object: new Person({
        id: new URL("http://example.com/actors/2"),
        name: "Bob",
        preferredUsername: "bob",
      }),
    }).toJsonLd(),
  );
});

test("actorDehydrator()", async () => {
  const activity = new Follow({
    id: new URL("http://example.com/activities/1"),
    actor: new Person({
      id: new URL("http://example.com/actors/1"),
      name: "Alice",
      preferredUsername: "alice",
    }),
    object: new Person({
      id: new URL("http://example.com/actors/2"),
      name: "Bob",
      preferredUsername: "bob",
    }),
  });
  const result = actorDehydrator(activity);
  assertEquals(
    await result.toJsonLd(),
    await new Follow({
      id: new URL("http://example.com/activities/1"),
      actor: new URL("http://example.com/actors/1"),
      object: new Person({
        id: new URL("http://example.com/actors/2"),
        name: "Bob",
        preferredUsername: "bob",
      }),
    }).toJsonLd(),
  );
});
