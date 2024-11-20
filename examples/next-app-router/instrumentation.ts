import { configure, getConsoleSink } from "@logtape/logtape";

export async function register() {
  // Logging settings for diagnostics:
  await configure({
    sinks: { console: getConsoleSink() },
    filters: {},
    loggers: [
      {
        category: "fedify",
        lowestLevel: "debug",
        sinks: ["console"],
        filters: [],
      },
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: ["console"],
        filters: [],
      },
    ],
  });
}
