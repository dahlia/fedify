import { colors } from "@cliffy/ansi";
import { Command } from "@cliffy/command";
import {
  Application,
  Collection,
  CryptographicKey,
  type DocumentLoader,
  generateCryptoKeyPair,
  getAuthenticatedDocumentLoader,
  type Link,
  lookupObject,
  type Object,
  type ResourceDescriptor,
  respondWithObject,
  traverseCollection,
} from "@fedify/fedify";
import { getLogger } from "@logtape/logtape";
import ora from "ora";
import { getContextLoader, getDocumentLoader } from "./docloader.ts";
import { spawnTemporaryServer, type TemporaryServer } from "./tempserver.ts";
import { printJson } from "./utils.ts";

const logger = getLogger(["fedify", "cli", "lookup"]);

export const command = new Command()
  .arguments("<...urls:string>")
  .description(
    "Lookup an Activity Streams object by URL or the actor handle.  " +
      "The argument can be either a URL or an actor handle " +
      "(e.g., @username@domain), and it can be multiple.",
  )
  .option("-a, --authorized-fetch", "Sign the request with an one-time key.")
  .option(
    "-t, --traverse",
    "Traverse the given collection to fetch all items.  If it is turned on, " +
      "the argument cannot be multiple.",
  )
  .option(
    "-S, --suppress-errors",
    "Suppress partial errors while traversing the collection.",
    { depends: ["traverse"] },
  )
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
    "Specify the separator between adjacent output objects or " +
      "collection items.",
    { default: "----" },
  )
  .action(async (options, ...urls: string[]) => {
    if (urls.length < 1) {
      console.error("At least one URL or actor handle must be provided.");
      Deno.exit(1);
    } else if (options.traverse && urls.length > 1) {
      console.error(
        "The -t/--traverse option cannot be used with multiple arguments.",
      );
      Deno.exit(1);
    }
    const spinner = ora({
      text: `Looking up the ${
        options.traverse ? "collection" : urls.length > 1 ? "objects" : "object"
      }...`,
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
    spinner.text = `Looking up the ${
      options.traverse ? "collection" : urls.length > 1 ? "objects" : "object"
    }...`;

    async function printObject(object: Object | Link): Promise<void> {
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
    }

    if (options.traverse) {
      const url = urls[0];
      const collection = await lookupObject(url, {
        documentLoader: authLoader ?? documentLoader,
        contextLoader,
        userAgent: options.userAgent,
      });
      if (collection == null) {
        spinner.fail(`Failed to fetch object: ${colors.red(url)}.`);
        if (authLoader == null) {
          console.error(
            "It may be a private object.  Try with -a/--authorized-fetch.",
          );
        }
        await server?.close();
        Deno.exit(1);
      }
      if (!(collection instanceof Collection)) {
        spinner.fail(
          `Not a collection: ${colors.red(url)}.  ` +
            "The -t/--traverse option requires a collection.",
        );
        await server?.close();
        Deno.exit(1);
      }
      spinner.succeed(`Fetched collection: ${colors.green(url)}.`);
      try {
        let i = 0;
        for await (
          const item of traverseCollection(collection, {
            documentLoader: authLoader ?? documentLoader,
            contextLoader,
            suppressError: options.suppressErrors,
          })
        ) {
          if (i > 0) console.log(options.separator);
          printObject(item);
          i++;
        }
      } catch (error) {
        logger.error("Failed to complete the traversal: {error}", { error });
        spinner.fail("Failed to complete the traversal.");
        if (authLoader == null) {
          console.error(
            "It may be a private object.  Try with -a/--authorized-fetch.",
          );
        } else {
          console.error(
            "Use the -S/--suppress-errors option to suppress partial errors.",
          );
        }
        await server?.close();
        Deno.exit(1);
      }
      spinner.succeed("Successfully fetched all items in the collection.");
      await server?.close();
      Deno.exit(0);
    }

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
          printObject(object);
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
