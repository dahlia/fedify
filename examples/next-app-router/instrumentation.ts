import { configure, getConsoleSink } from "@logtape/logtape";

export async function register() {
  // Logging settings for diagnostics:
  await configure({
    sinks: { console: getConsoleSink() },
    filters: {},
    loggers: [
      { category: "fedify", level: "debug", sinks: ["console"], filters: [] },
      {
        category: ["logtape", "meta"],
        level: "warning",
        sinks: ["console"],
        filters: [],
      },
    ],
  });
}
