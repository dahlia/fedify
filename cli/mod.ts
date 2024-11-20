import { Command, CompletionsCommand, HelpCommand } from "@cliffy/command";
import { configure, getConsoleSink } from "@logtape/logtape";
import { DEFAULT_CACHE_DIR, setCacheDir } from "./cache.ts";
import metadata from "./deno.json" with { type: "json" };
import { command as inbox } from "./inbox.tsx";
import { command as init } from "./init.ts";
import { recordingSink } from "./log.ts";
import { command as lookup } from "./lookup.ts";
import { command as node } from "./node.ts";
import { command as tunnel } from "./tunnel.ts";

const command = new Command()
  .name("fedify")
  .version(metadata.version)
  .globalOption("-d, --debug", "Enable debug mode.", {
    async action() {
      await configure({
        sinks: { console: getConsoleSink(), recording: recordingSink },
        filters: {},
        loggers: [
          {
            category: "fedify",
            lowestLevel: "debug",
            sinks: ["console", "recording"],
          },
          {
            category: "localtunnel",
            lowestLevel: "debug",
            sinks: ["console"],
          },
          {
            category: ["logtape", "meta"],
            lowestLevel: "warning",
            sinks: ["console"],
          },
        ],
        reset: true,
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
  .command("init", init)
  .command("lookup", lookup)
  .command("inbox", inbox)
  .command("node", node)
  .command("tunnel", tunnel)
  .command("completions", new CompletionsCommand())
  .command("help", new HelpCommand().global());

if (import.meta.main) {
  await command.parse(Deno.args);
}
