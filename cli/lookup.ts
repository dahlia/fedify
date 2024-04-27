import { Command } from "@cliffy/command";
import {
  Application,
  CryptographicKey,
  type DocumentLoader,
  generateCryptoKeyPair,
  getAuthenticatedDocumentLoader,
  lookupObject,
  type ResourceDescriptor,
  respondWithObject,
} from "@fedify/fedify";
import { highlight } from "cli-highlight";
import ora from "ora";
import { spawnTemporaryServer, type TemporaryServer } from "./tempserver.ts";

export const command = new Command()
  .arguments("<url:string>")
  .description(
    "Lookup an Activity Streams object by URL or the actor handle.  " +
      "The argument can be either a URL or an actor handle " +
      "(e.g., @username@domain).",
  )
  .option("-a, --authorized-fetch", "Sign the request with an one-time key.")
  .option("-c, --compact", "Compact the fetched JSON-LD document.", {
    conflicts: ["expand"],
  })
  .option("-e, --expand", "Expand the fetched JSON-LD document.", {
    conflicts: ["compact"],
  })
  .action(async (options, url: string) => {
    const spinner = ora({
      text: "Looking up the object...",
      discardStdin: false,
    }).start();
    let server: TemporaryServer | undefined = undefined;
    let loader: DocumentLoader | undefined = undefined;
    if (options.authorizedFetch) {
      spinner.text = "Generating a one-time key pair...";
      const key = await generateCryptoKeyPair();
      spinner.text = "Spinning up a temporary ActivityPub server...";
      server = await spawnTemporaryServer((req) => {
        if (new URL(req.url).pathname == "/.well-known/webfinger") {
          const jrd: ResourceDescriptor = {
            subject: `acct:${server!.url.hostname}@${server!.url.hostname}`,
            aliases: [server!.url.href],
            links: [
              {
                rel: "self",
                href: server!.url.href,
                type: "application/activity+json",
              },
            ],
          };
          return new Response(JSON.stringify(jrd), {
            headers: { "Content-Type": "application/jrd+json" },
          });
        }
        return respondWithObject(
          new Application({
            id: server?.url,
            preferredUsername: server?.url?.hostname,
            publicKey: new CryptographicKey({
              id: new URL("#main-key", server?.url),
              owner: server?.url,
              publicKey: key.publicKey,
            }),
            manuallyApprovesFollowers: true,
            inbox: new URL("/inbox", server?.url),
            outbox: new URL("/outbox", server?.url),
          }),
        );
      });
      loader = getAuthenticatedDocumentLoader({
        keyId: new URL("#main-key", server.url),
        privateKey: key.privateKey,
      });
    }
    try {
      spinner.text = "Looking up the object...";
      const object = await lookupObject(url, { documentLoader: loader });
      spinner.succeed();
      if (object == null) {
        console.error("Failed to fetch the object.");
        if (loader == null) {
          console.error(
            "It may be a private object.  Try with -a/--authorized-fetch.",
          );
        }
        Deno.exit(1);
      }
      if (options.compact) {
        printJson(await object.toJsonLd());
      } else if (options.expand) {
        printJson(await object.toJsonLd({ expand: true }));
      } else {
        console.log(object);
      }
    } catch (_) {
      spinner.fail();
    } finally {
      await server?.close();
    }
  });

function printJson(json: unknown): void {
  const formatted = JSON.stringify(json, null, 2);
  console.log(highlight(formatted, { language: "json" }));
}
