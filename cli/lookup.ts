import { colors } from "@cliffy/ansi";
import { Command } from "@cliffy/command";
import {
  Application,
  CryptographicKey,
  type DocumentLoader,
  generateCryptoKeyPair,
  getAuthenticatedDocumentLoader,
  lookupObject,
  type Object,
  type ResourceDescriptor,
  respondWithObject,
} from "@fedify/fedify";
import ora from "ora";
import { getContextLoader, getDocumentLoader } from "./docloader.ts";
import { spawnTemporaryServer, type TemporaryServer } from "./tempserver.ts";
import { printJson } from "./utils.ts";

export const command = new Command()
  .arguments("<...urls:string>")
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
  .option("-u, --user-agent <string>", "The custom User-Agent header value.")
  .option(
    "-s, --separator <string>",
    "Specify the separator between adjacent output objects.",
    { default: "----" },
  )
  .action(async (options, ...urls: string[]) => {
    const spinner = ora({
      text: "Looking up the object...",
      discardStdin: false,
    }).start();
    let server: TemporaryServer | undefined = undefined;
    const documentLoader = await getDocumentLoader({
      userAgent: options.userAgent,
    });
    const contextLoader = await getContextLoader({
      userAgent: options.userAgent,
    });
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
    spinner.text = urls.length > 1
      ? "Looking up objects..."
      : "Looking up an object...";

    const promises: Promise<Object | null>[] = [];
    for (const url of urls) {
      promises.push(
        lookupObject(
          url,
          {
            documentLoader: authLoader ?? documentLoader,
            contextLoader,
            userAgent: options.userAgent,
          },
        ),
      );
    }

    const objects = await Promise.all(promises);
    let success = true;
    let i = 0;
    for (const object of objects) {
      const url = urls[i];
      if (i > 0) console.log(options.separator);
      i++;
      try {
        if (object == null) {
          spinner.fail(`Failed to fetch object: ${colors.red(url)}.`);
          if (authLoader == null) {
            console.error(
              "It may be a private object.  Try with -a/--authorized-fetch.",
            );
          }
          success = false;
        } else {
          spinner.succeed(`Fetched object: ${colors.green(url)}.`);
          if (options.raw) {
            printJson(await object.toJsonLd({ contextLoader }));
          } else if (options.compact) {
            printJson(
              await object.toJsonLd({ format: "compact", contextLoader }),
            );
          } else if (options.expand) {
            printJson(
              await object.toJsonLd({ format: "expand", contextLoader }),
            );
          } else {
            console.log(object);
          }
          if (i < urls.length - 1) {
            console.log(options.separator);
          }
        }
      } catch (_) {
        success = false;
      }
    }
    if (success) {
      spinner.succeed(
        urls.length > 1
          ? "Successfully fetched all objects."
          : "Successfully fetched the object.",
      );
    }
    await server?.close();
    if (!success) {
      Deno.exit(1);
    }
  });
