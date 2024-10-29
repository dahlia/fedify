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
import ora from "ora";
import { getContextLoader, getDocumentLoader } from "./docloader.ts";
import { spawnTemporaryServer, type TemporaryServer } from "./tempserver.ts";
import { printJson } from "./utils.ts";

export const command = new Command()
  .arguments("<url:string>")
  .description(
    "Lookup an Activity Streams object by URL or the actor handle.  " +
      "The argument can be either a URL or an actor handle " +
      "(e.g., @username@domain).",
  )
  .option("-a, --authorized-fetch", "Sign the request with an one-time key.")
  .option("-r, --raw", "Print the fetched JSON-LD document as is.", {
    conflicts: ["compact", "expand"],
  })
  .option("-C, --compact", "Compact the fetched JSON-LD document.", {
    conflicts: ["raw", "expand"],
  })
  .option("-e, --expand", "Expand the fetched JSON-LD document.", {
    conflicts: ["raw", "compact"],
  })
  .action(async (options, url: string) => {
    const spinner = ora({
      text: "Looking up the object...",
      discardStdin: false,
    }).start();
    let server: TemporaryServer | undefined = undefined;
    const documentLoader = await getDocumentLoader();
    const contextLoader = await getContextLoader();
    let authLoader: DocumentLoader | undefined = undefined;
    if (options.authorizedFetch) {
      spinner.text = "Generating a one-time key pair...";
      const key = await generateCryptoKeyPair();
      spinner.text = "Spinning up a temporary ActivityPub server...";
      server = await spawnTemporaryServer((req) => {
        const serverUrl = server?.url ?? new URL("http://localhost/");
        if (new URL(req.url).pathname == "/.well-known/webfinger") {
          const jrd: ResourceDescriptor = {
            subject: `acct:${serverUrl.hostname}@${serverUrl.hostname}`,
            aliases: [serverUrl.href],
            links: [
              {
                rel: "self",
                href: serverUrl.href,
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
            id: serverUrl,
            preferredUsername: serverUrl?.hostname,
            publicKey: new CryptographicKey({
              id: new URL("#main-key", serverUrl),
              owner: serverUrl,
              publicKey: key.publicKey,
            }),
            manuallyApprovesFollowers: true,
            inbox: new URL("/inbox", serverUrl),
            outbox: new URL("/outbox", serverUrl),
          }),
          { contextLoader },
        );
      });
      authLoader = getAuthenticatedDocumentLoader({
        keyId: new URL("#main-key", server.url),
        privateKey: key.privateKey,
      });
    }
    try {
      spinner.text = "Looking up the object...";
      const object = await lookupObject(
        url,
        { documentLoader: authLoader ?? documentLoader, contextLoader },
      );
      spinner.succeed();
      if (object == null) {
        console.error("Failed to fetch the object.");
        if (authLoader == null) {
          console.error(
            "It may be a private object.  Try with -a/--authorized-fetch.",
          );
        }
        Deno.exit(1);
      }
      if (options.raw) {
        printJson(await object.toJsonLd({ contextLoader }));
      } else if (options.compact) {
        printJson(await object.toJsonLd({ format: "compact", contextLoader }));
      } else if (options.expand) {
        printJson(await object.toJsonLd({ format: "expand", contextLoader }));
      } else {
        console.log(object);
      }
    } catch (_) {
      spinner.fail();
    } finally {
      await server?.close();
    }
  });
