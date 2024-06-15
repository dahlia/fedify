import { colors } from "@cliffy/ansi";
import { Command } from "@cliffy/command";
import { Cell, Table } from "@cliffy/table";
import {
  Accept,
  Activity,
  type Actor,
  Application,
  type Context,
  Endpoints,
  Federation,
  Follow,
  generateCryptoKeyPair,
  getActorHandle,
  Image,
  InProcessMessageQueue,
  isActor,
  lookupObject,
  MemoryKvStore,
  type Recipient,
} from "@fedify/fedify";
import { getLogger } from "@logtape/logtape";
import { parse } from "@std/semver";
import { Hono } from "hono";
import ora from "ora";
import metadata from "./deno.json" with { type: "json" };
import { getDocumentLoader } from "./docloader.ts";
import type { ActivityEntry } from "./inbox/entry.ts";
import { ActivityEntryPage, ActivityListPage } from "./inbox/view.tsx";
import { recordingSink } from "./log.ts";
import { tableStyle } from "./table.ts";
import { spawnTemporaryServer } from "./tempserver.ts";

const logger = getLogger(["fedify", "cli", "inbox"]);

export const command = new Command()
  .description(
    "Spins up an ephemeral server that serves the ActivityPub inbox with " +
      "an one-time actor, through a short-lived public DNS with HTTPS.  " +
      "You can monitor the incoming activities in real-time.",
  )
  .option(
    "-f, --follow=<uri:string>",
    "Follow the given actor.  The argument can be either an actor URI or " +
      "a handle.  Can be specified multiple times.",
    { collect: true },
  )
  .option(
    "-a, --accept-follow=<uri:string>",
    "Accept follow requests from the given actor.  The argument can be " +
      "either an actor URI or a handle, or a wildcard (*).  Can be " +
      "specified multiple times.  If a wildcard is specified, all follow " +
      "requests will be accepted.",
    { collect: true },
  )
  .option(
    "-T, --no-tunnel",
    "Do not tunnel the ephemeral ActivityPub server to the public Internet.",
  )
  .action(async (options) => {
    const spinner = ora({
      text: "Spinning up an ephemeral ActivityPub server...",
      discardStdin: false,
    }).start();
    const server = await spawnTemporaryServer(fetch, {
      noTunnel: !options.tunnel,
    });
    spinner.succeed(
      `The ephemeral ActivityPub server is up and running: ${
        colors.green(
          server.url.href,
        )
      }`,
    );
    Deno.addSignalListener("SIGINT", () => {
      spinner.stop();
      spinner.start("Stopping server...");
      server.close().then(() => {
        spinner.succeed("Server stopped.");
        Deno.exit(0);
      });
    });
    spinner.start();
    const fedCtx = federation.createContext(server.url, -1);
    if (options.follow != null && options.follow.length > 0) {
      spinner.text = "Following actors...";
      const documentLoader = await fedCtx.getDocumentLoader({ handle: "i" });
      acceptFollows.push(...(options.acceptFollow ?? []));
      for (const uri of options.follow) {
        spinner.text = `Following ${colors.green(uri)}...`;
        const actor = await lookupObject(uri, { documentLoader });
        if (!isActor(actor)) {
          spinner.fail(`Not an actor: ${colors.red(uri)}`);
          spinner.start();
          continue;
        }
        await fedCtx.sendActivity(
          { handle: "i" },
          actor,
          new Follow({
            id: new URL(`#follows/${actor.id?.href}`, fedCtx.getActorUri("i")),
            actor: fedCtx.getActorUri("i"),
            object: actor.id,
          }),
        );
        spinner.succeed(`Sent follow request to ${colors.green(uri)}.`);
        spinner.start();
      }
    }
    spinner.stop();
    printServerInfo(fedCtx);
  });

const federation = new Federation<number>({
  kv: new MemoryKvStore(),
  queue: new InProcessMessageQueue(),
  documentLoader: await getDocumentLoader(),
});

const time = Temporal.Now.instant();
let actorKeyPairs: CryptoKeyPair[] | undefined = undefined;

federation
  .setActorDispatcher("/{handle}", async (ctx, handle) => {
    if (handle !== "i") return null;
    return new Application({
      id: ctx.getActorUri(handle),
      preferredUsername: handle,
      name: "Fedify Ephemeral Inbox",
      summary: "An ephemeral ActivityPub inbox for testing purposes.",
      inbox: ctx.getInboxUri(handle),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),
      }),
      followers: ctx.getFollowersUri(handle),
      following: ctx.getFollowingUri(handle),
      outbox: ctx.getOutboxUri(handle),
      manuallyApprovesFollowers: true,
      published: time,
      icon: new Image({
        url: new URL("https://fedify.dev/logo.png"),
        mediaType: "image/png",
      }),
      publicKey: (await ctx.getActorKeyPairs(handle))[0].cryptographicKey,
      assertionMethods: (await ctx.getActorKeyPairs(handle))
        .map((pair) => pair.multikey),
      url: ctx.getActorUri(handle),
    });
  })
  .setKeyPairsDispatcher(async (_ctxData, handle) => {
    if (handle !== "i") return [];
    if (actorKeyPairs == null) {
      actorKeyPairs = [
        await generateCryptoKeyPair("RSASSA-PKCS1-v1_5"),
        await generateCryptoKeyPair("Ed25519"),
      ];
    }
    return actorKeyPairs;
  });

const activities: ActivityEntry[] = [];

const acceptFollows: string[] = [];

async function acceptsFollowFrom(actor: Actor): Promise<boolean> {
  const actorUri = actor.id;
  let actorHandle: string | undefined = undefined;
  if (actorUri == null) return false;
  for (let uri of acceptFollows) {
    if (uri === "*") return true;
    if (uri.startsWith("http:") || uri.startsWith("https:")) {
      uri = new URL(uri).href; // normalize
      if (uri === actorUri.href) return true;
    }
    if (actorHandle == null) actorHandle = await getActorHandle(actor);
    if (actorHandle === uri) return true;
  }
  return false;
}

const followers: Record<string, Actor> = {};

federation
  .setInboxListeners("/{handle}/inbox", "/inbox")
  .on(Activity, async (ctx, activity) => {
    activities[ctx.data].activity = activity;
    if (activity instanceof Follow) {
      if (acceptFollows.length < 1) return;
      const objectId = activity.objectId;
      if (objectId == null) return;
      const parsed = ctx.parseUri(objectId);
      if (parsed?.type !== "actor" || parsed.handle !== "i") return;
      const { handle } = parsed;
      const follower = await activity.getActor();
      if (!isActor(follower)) return;
      const accepts = await acceptsFollowFrom(follower);
      if (!accepts || activity.id == null) {
        logger.debug("Does not accept follow from {actor}.", {
          actor: follower.id?.href,
        });
        return;
      }
      logger.debug("Accepting follow from {actor}.", {
        actor: follower.id?.href,
      });
      followers[activity.id.href] = follower;
      await ctx.sendActivity(
        { handle },
        follower,
        new Accept({
          id: new URL(`#accepts/${follower.id?.href}`, ctx.getActorUri("i")),
          actor: ctx.getActorUri(handle),
          object: activity.id,
        }),
      );
    }
  });

federation
  .setFollowersDispatcher("/{handle}/followers", (_ctx, handle) => {
    if (handle !== "i") return null;
    const items: Recipient[] = [];
    for (const follower of Object.values(followers)) {
      if (follower.id == null) continue;
      items.push(follower);
    }
    return { items };
  })
  .setCounter((_ctx, handle) => {
    if (handle !== "i") return null;
    return Object.keys(followers).length;
  });

federation
  .setFollowingDispatcher("/{handle}/following", (_ctx, _handle) => null)
  .setCounter((_ctx, _handle) => 0);

federation
  .setOutboxDispatcher("/{handle}/outbox", (_ctx, _handle) => null)
  .setCounter((_ctx, _handle) => 0);

federation.setNodeInfoDispatcher("/nodeinfo/2.1", (_ctx) => {
  return {
    software: {
      name: "fedify-cli",
      version: parse(metadata.version),
      repository: new URL("https://github.com/dahlia/fedify"),
    },
    protocols: ["activitypub"],
    usage: {
      users: {
        total: 1,
        activeMonth: 1,
        activeHalfyear: 1,
      },
      localComments: 0,
      localPosts: 0,
    },
  };
});

function printServerInfo(fedCtx: Context<number>): void {
  new Table(
    [
      new Cell("Actor handle:").align("right"),
      colors.green(`i@${fedCtx.getActorUri("i").host}`),
    ],
    [
      new Cell("Actor URI:").align("right"),
      colors.green(fedCtx.getActorUri("i").href),
    ],
    [
      new Cell("Actor inbox:").align("right"),
      colors.green(fedCtx.getInboxUri("i").href),
    ],
    [
      new Cell("Shared inbox:").align("right"),
      colors.green(fedCtx.getInboxUri().href),
    ],
  )
    .chars(tableStyle)
    .border()
    .render();
}

function printActivityEntry(idx: number, entry: ActivityEntry): void {
  const request = entry.request.clone();
  const response = entry.response?.clone();
  const url = new URL(request.url);
  const activity = entry.activity;
  new Table(
    [new Cell("Request #:").align("right"), colors.bold(idx.toString())],
    [
      new Cell("Activity type:").align("right"),
      activity == null
        ? colors.red("failed to parse")
        : colors.green(activity.constructor.name),
    ],
    [
      new Cell("HTTP request:").align("right"),
      `${
        request.method === "POST"
          ? colors.green("POST")
          : colors.red(request.method)
      } ${url.pathname + url.search}`,
    ],
    ...(response == null ? [] : [
      [
        new Cell("HTTP response:").align("right"),
        `${
          response.ok
            ? colors.green(response.status.toString())
            : colors.red(response.status.toString())
        } ${response.statusText}`,
      ],
    ]),
    [new Cell("Details").align("right"), new URL(`/r/${idx}`, url).href],
  )
    .chars(tableStyle)
    .border()
    .render();
}

const app = new Hono();

app.get("/", (c) => c.redirect("/r"));

app.get("/r", (c) => c.html(<ActivityListPage entries={activities} />));

app.get("/r/:idx{[0-9]+}", (c) => {
  const idx = parseInt(c.req.param("idx"));
  const tab = c.req.query("tab") ?? "request";
  const activity = activities[idx];
  if (activity == null) return c.notFound();
  return c.html(<ActivityEntryPage idx={idx} entry={activity} tabPage={tab} />);
});

async function fetch(request: Request): Promise<Response> {
  const timestamp = Temporal.Now.instant();
  const idx = activities.length;
  const pathname = new URL(request.url).pathname;
  const inboxRequest = pathname === "/inbox" || pathname.startsWith("/i/inbox");
  if (inboxRequest) {
    recordingSink.startRecording();
    activities.push({ timestamp, request: request.clone(), logs: [] });
  }
  const response = await federation.fetch(request, {
    contextData: inboxRequest ? idx : -1,
    onNotAcceptable: app.fetch.bind(app),
    onNotFound: app.fetch.bind(app),
    onUnauthorized: app.fetch.bind(app),
  });
  if (inboxRequest) {
    recordingSink.stopRecording();
    activities[idx].response = response.clone();
    activities[idx].logs = recordingSink.getRecords();
    printActivityEntry(idx, activities[idx]);
  }
  return response;
}
