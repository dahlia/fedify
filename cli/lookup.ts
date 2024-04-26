import { Command } from "@cliffy/command";
import { lookupObject } from "@fedify/fedify";
import { highlight } from "cli-highlight";

export const command = new Command()
  .arguments("<url:string>")
  .description(
    "Lookup an Activity Streams object by URL or the actor handle.  " +
      "The argument can be either a URL or an actor handle " +
      "(e.g., @username@domain).",
  )
  .option("-c, --compact", "Compact the fetched JSON-LD document.", {
    conflicts: ["expand"],
  })
  .option("-e, --expand", "Expand the fetched JSON-LD document.", {
    conflicts: ["compact"],
  })
  .action(async (options, url: string) => {
    const object = await lookupObject(url);
    if (options.compact) {
      printJson(await object?.toJsonLd());
    } else if (options.expand) {
      printJson(await object?.toJsonLd({ expand: true }));
    } else {
      console.log(object);
    }
  });

function printJson(json: unknown): void {
  const formatted = JSON.stringify(json, null, 2);
  console.log(highlight(formatted, { language: "json" }));
}
