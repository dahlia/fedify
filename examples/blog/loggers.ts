import {
  configure,
  getConsoleSink,
  getFileSink,
  type LogLevel,
} from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(),
    file: Deno.env.get("DENO_DEPLOYMENT_ID") == null
      ? getFileSink("log.jsonl", {
        formatter(log) {
          return JSON.stringify(log) + "\n";
        },
      })
      : (_) => {},
  },
  filters: {},
  loggers: [
    {
      category: "fedify",
      level: (Deno.env.get("FEDIFY_LOG") as LogLevel | undefined) ?? "debug",
      sinks: ["console", "file"],
    },
    {
      category: "blog",
      level: (Deno.env.get("BLOG_LOG") as LogLevel | undefined) ?? "debug",
      sinks: ["console", "file"],
    },
    {
      category: ["logtape", "meta"],
      level: "warning",
      sinks: ["console", "file"],
    },
  ],
});
