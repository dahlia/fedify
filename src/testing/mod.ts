import {
  configure,
  getConsoleSink,
  type LogRecord,
  reset,
  type Sink,
} from "@logtape/logtape";

export function test(options: Deno.TestDefinition): void;
export function test(
  name: string,
  fn: (t: Deno.TestContext) => void | Promise<void>,
): void;
export function test(
  name: string,
  options: Omit<Deno.TestDefinition, "fn" | "name">,
  fn: (t: Deno.TestContext) => void | Promise<void>,
): void;
export function test(
  name: string | Deno.TestDefinition,
  options?:
    | ((
      t: Deno.TestContext,
    ) => void | Promise<void>)
    | Omit<Deno.TestDefinition, "fn" | "name">,
  fn?: (t: Deno.TestContext) => void | Promise<void>,
): void {
  const def: Deno.TestDefinition = typeof name === "string"
    ? typeof options === "function"
      ? { name, fn: options }
      : { name, ...options, fn: fn! }
    : (name satisfies Deno.TestDefinition);
  const func: (t: Deno.TestContext) => void | Promise<void> = def.fn;
  Deno.test({
    ...def,
    async fn(t: Deno.TestContext) {
      const records: LogRecord[] = [];
      await configure({
        sinks: {
          buffer(record: LogRecord): void {
            if (
              record.category.length > 1 && record.category[0] === "logtape" &&
              record.category[1] === "meta"
            ) return;
            records.push(record);
          },
        },
        filters: {},
        loggers: [
          { category: [], sinks: ["buffer"], level: "debug" },
        ],
      });
      try {
        await func(t);
      } catch (e) {
        const consoleSink: Sink = getConsoleSink();
        for (const record of records) consoleSink(record);
        throw e;
      } finally {
        await reset();
      }
    },
  });
}
