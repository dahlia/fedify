import { assertEquals } from "@std/assert";
import { MemoryKvStore } from "./kv.ts";

Deno.test("MemoryKvStore", async (t) => {
  const store = new MemoryKvStore();

  await t.step("set() & get()", async () => {
    await store.set(["foo", "bar"], "foobar");
    assertEquals(await store.get(["foo", "bar"]), "foobar");
    assertEquals(await store.get(["foo"]), undefined);

    await store.set(["foo", "baz"], "baz", {
      ttl: Temporal.Duration.from({ seconds: 0 }),
    });
    assertEquals(await store.get(["foo", "baz"]), undefined);
  });

  await t.step("delete()", async () => {
    await store.delete(["foo", "bar"]);
    assertEquals(await store.get(["foo", "bar"]), undefined);
  });
});
