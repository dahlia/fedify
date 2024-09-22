import { assertEquals, assertGreater, assertGreaterOrEqual } from "@std/assert";
import { delay } from "@std/async/delay";
import { test } from "../testing/mod.ts";
import {
  InProcessMessageQueue,
  type MessageQueue,
  ParallelMessageQueue,
} from "./mq.ts";

test("InProcessMessageQueue", async (t) => {
  const mq = new InProcessMessageQueue();

  const messages: string[] = [];
  const controller = new AbortController();
  const listening = mq.listen((message: string) => {
    messages.push(message);
  }, controller);

  await t.step("enqueue()", async () => {
    await mq.enqueue("Hello, world!");
  });

  await waitFor(() => messages.length > 0, 15_000);

  await t.step("listen()", () => {
    assertEquals(messages, ["Hello, world!"]);
  });

  let started = 0;
  await t.step("enqueue() with delay", async () => {
    started = Date.now();
    await mq.enqueue(
      "Delayed message",
      { delay: Temporal.Duration.from({ seconds: 3 }) },
    );
    assertEquals(messages, ["Hello, world!"]);
  });

  await waitFor(() => messages.length > 1, 15_000);

  await t.step("listen() with delay", () => {
    assertEquals(messages, ["Hello, world!", "Delayed message"]);
    assertGreater(Date.now() - started, 3_000);
  });

  controller.abort();
  await listening;
});

const queues: Record<string, () => Promise<MessageQueue>> = {
  InProcessMessageQueue: () => Promise.resolve(new InProcessMessageQueue()),
};
if (
  // @ts-ignore: Works on Deno
  // dnt-shim-ignore
  "Deno" in globalThis && "openKv" in globalThis.Deno &&
  // @ts-ignore: Works on Deno
  // dnt-shim-ignore
  typeof globalThis.Deno.openKv === "function"
) {
  const { DenoKvMessageQueue } = await import(".." + "/x/denokv.ts");
  queues.DenoKvMessageQueue = async () =>
    new DenoKvMessageQueue(
      // @ts-ignore: Works on Deno
      // dnt-shim-ignore
      await globalThis.Deno.openKv(":memory:"),
    );
}

for (const mqName in queues) {
  test(`ParallelMessageQueue [${mqName}]`, async (t) => {
    const mq = await queues[mqName]();
    const workers = new ParallelMessageQueue(mq, 5);

    const messages: string[] = [];
    const controller = new AbortController();
    const listening = workers.listen(async (message: string) => {
      for (let i = 0, cnt = 5 + Math.random() * 5; i < cnt; i++) {
        await delay(250);
      }
      messages.push(message);
    }, controller);

    await t.step("enqueue() [single]", async () => {
      await mq.enqueue("Hello, world!");
    });

    await waitFor(() => messages.length > 0, 15_000);

    await t.step("listen() [single]", () => {
      assertEquals(messages, ["Hello, world!"]);
    });

    messages.pop();

    await t.step("enqueue() [multiple]", async () => {
      for (let i = 0; i < 20; i++) {
        await mq.enqueue(`Hello, ${i}!`);
      }
    });

    await t.step("listen() [multiple]", async () => {
      await delay(10 * 250 + 500);
      assertGreaterOrEqual(messages.length, 5);
      await waitFor(() => messages.length >= 20, 15_000);
      assertEquals(messages.length, 20);
    });

    await waitFor(() => messages.length >= 20, 15_000);

    controller.abort();
    await listening;

    if (Symbol.dispose in mq) {
      const dispose = mq[Symbol.dispose];
      if (typeof dispose === "function") dispose.call(mq);
    }
  });
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    await delay(500);
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timeout");
    }
  }
}
