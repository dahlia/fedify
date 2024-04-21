import { configure, getConsoleSink, type LogLevel } from "@logtape/logtape";

await configure({
  sinks: { console: getConsoleSink() },
  filters: {},
  loggers: [
    {
      category: "fedify",
      level: (Deno.env.get("FEDIFY_LOG") as LogLevel | undefined) ?? "debug",
      sinks: ["console"],
    },
    {
      category: "blog",
      level: (Deno.env.get("BLOG_LOG") as LogLevel | undefined) ?? "debug",
      sinks: ["console"],
    },
    {
      category: ["logtape", "meta"],
      level: "warning",
      sinks: ["console"],
    },
  ],
});
