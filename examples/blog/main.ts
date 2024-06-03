/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import "@std/dotenv/load";

import { ServerContext } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import config from "./fresh.config.ts";
import { behindProxy } from "@hongminhee/x-forwarded-fetch";

const ctx = await ServerContext.fromManifest(manifest, {
  ...config,
  dev: false,
});
const handler = behindProxy(ctx.handler());

Deno.serve({
  handler,
  ...config.server,
});
