// This script purposes to test the inbox web front-end.
// All data is dummy and does not reflect real-world data, but it is useful for
// testing the front-end.
import { Accept, Follow } from "@fedify/fedify";
import { Hono } from "hono";
import type { ActivityEntry } from "./entry.ts";
import { ActivityEntryPage, ActivityListPage } from "./view.tsx";

const app = new Hono();

app.get("/r/0", async (c) => {
  const idx = 123;
  const activity = new Accept({
    id: new URL(`https://fedify.dev/r/${idx}`),
    actor: new URL("https://fedify.dev/i"),
    object: new Follow({
      id: new URL("https://fedify.dev/f/123"),
      actor: new URL("https://fedify.dev/f"),
      object: new URL("https://fedify.dev/i"),
    }),
  });
  const entry: ActivityEntry = {
    timestamp: Temporal.Now.instant(),
    activity,
    request: c.req.raw.clone(),
    response: c.res,
    logs: [
      {
        timestamp: 1714380009257,
        category: ["fedify", "federation", "collection"],
        level: "debug",
        message: ["Fetching followers collection..."],
        rawMessage: "Fetching followers collection...",
        properties: {},
      },
      {
        timestamp: 1714380009257,
        category: ["fedify", "federation", "outbox"],
        level: "info",
        message: [
          "Successfully sent activity ",
          "https://fedify.dev/r/123",
          ".",
        ],
        rawMessage: "Successfully sent activity https://fedify.dev/r/123.",
        properties: {
          activityId: "https://fedify.dev/r/123",
        },
      },
      {
        timestamp: 1714380009257,
        category: ["fedify", "federation", "inbox"],
        level: "warning",
        message: ["Failed to parse activity."],
        rawMessage: "Failed to parse activity.",
        properties: {
          json: await activity.toJsonLd(),
        },
      },
      {
        timestamp: 1714380009257,
        category: ["fedify", "federation", "inbox"],
        level: "error",
        message: ["Failed to parse activity."],
        rawMessage: "Failed to parse activity.",
        properties: {
          json: await activity.toJsonLd(),
        },
      },
      {
        timestamp: 1714380009257,
        category: ["fedify", "federation", "collection"],
        level: "fatal",
        message: ["Something went wrong: ", { foo: 1, bar: 2 }],
        rawMessage: 'Something went wrong: {"foo":1,"bar":2}',
        properties: {},
      },
    ],
  };
  return c.html(
    <ActivityEntryPage
      idx={idx}
      entry={entry}
      // @ts-ignore:
      tabPage={c.req.query("tab") ?? "request"}
    />,
  );
});

app.get("/r/1", (c) => {
  const idx = 456;
  const entry: ActivityEntry = {
    timestamp: Temporal.Now.instant(),
    request: c.req.raw.clone(),
    response: c.res,
    logs: [],
  };
  return c.html(
    <ActivityEntryPage
      idx={idx}
      entry={entry}
      // @ts-ignore:
      tabPage={c.req.query("tab") ?? "request"}
    />,
  );
});

app.get("/r/2", (c) => {
  const idx = 789;
  const entry: ActivityEntry = {
    timestamp: Temporal.Now.instant(),
    request: c.req.raw.clone(),
    logs: [],
  };
  return c.html(
    <ActivityEntryPage
      idx={idx}
      entry={entry}
      // @ts-ignore:
      tabPage={c.req.query("tab") ?? "request"}
    />,
  );
});

app.get("/r", (c) => {
  const entries: ActivityEntry[] = [
    {
      timestamp: Temporal.Now.instant(),
      request: new Request("https://fedify.dev/r/0", { method: "POST" }),
      response: new Response("OK"),
      activity: new Accept({}),
      logs: [],
    },
    {
      timestamp: Temporal.Now.instant(),
      request: new Request("https://fedify.dev/r/0", { method: "POST" }),
      response: new Response("OK"),
      activity: new Accept({}),
      logs: [],
    },
    {
      timestamp: Temporal.Now.instant(),
      request: c.req.raw.clone(),
      response: c.res,
      logs: [],
    },
    {
      timestamp: Temporal.Now.instant(),
      request: new Request("https://fedify.dev/r/0", { method: "POST" }),
      response: new Response("OK"),
      activity: new Accept({}),
      logs: [],
    },
    {
      timestamp: Temporal.Now.instant(),
      request: c.req.raw.clone(),
      activity: new Accept({}),
      logs: [],
    },
    {
      timestamp: Temporal.Now.instant(),
      request: c.req.raw.clone(),
      logs: [],
    },
  ];
  return c.html(
    <ActivityListPage entries={entries} />,
  );
});

Deno.serve(app.fetch.bind(app));
