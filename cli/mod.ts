import { Command, HelpCommand } from "@cliffy/command";
import { configure, getConsoleSink } from "@logtape/logtape";
import metadata from "../deno.json" with { type: "json" };
import { DEFAULT_CACHE_DIR, setCacheDir } from "./cache.ts";
import { command as lookup } from "./lookup.ts";

const command = new Command()
  .name("fedify")
  .version(metadata.version)
  .globalOption("-d, --debug", "Enable debug mode.", {
    async action() {
      await configure({
        sinks: { console: getConsoleSink() },
        filters: {},
        loggers: [
          {
            category: "fedify",
            level: "debug",
            sinks: ["console"],
          },
          {
            category: ["logtape", "meta"],
            level: "warning",
            sinks: ["console"],
          },
        ],
      });
    },
  })
  .globalOption("-c, --cache-dir=<dir:file>", "Set the cache directory.", {
    default: DEFAULT_CACHE_DIR,
    async action(options) {
      await setCacheDir(options.cacheDir);
    },
  })
  .default("help")
  .command("lookup", lookup)
  .command("help", new HelpCommand().global());

if (import.meta.main) {
  await command.parse(Deno.args);
}
