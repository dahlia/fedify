import { assertEquals } from "jsr:@std/assert@^0.218.2";
import { parse } from "jsr:@std/semver@^0.218.2";
import { NodeInfoDispatcher } from "../federation/callback.ts";
import { createRequestContext } from "../testing/context.ts";
import { handleNodeInfo, handleNodeInfoJrd } from "./handler.ts";

Deno.test("handleNodeInfo()", async () => {
  const request = new Request("https://example.com/nodeinfo/2.1");
  const context = createRequestContext<void>({
    data: undefined,
    request,
    url: new URL(request.url),
  });
  const nodeInfoDispatcher: NodeInfoDispatcher<void> = (_ctx) => ({
    software: {
      name: "test",
      version: parse("1.2.3"),
    },
    protocols: ["activitypub"],
    usage: {
      users: { total: 3, activeHalfyear: 2, activeMonth: 1 },
      localPosts: 123,
      localComments: 456,
    },
  });
  const response = await handleNodeInfo(request, {
    context,
    nodeInfoDispatcher,
  });
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/json;" +
      ' profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"',
  );
  const json = await response.json();
  assertEquals(json, {
    "$schema": "http://nodeinfo.diaspora.software/ns/schema/2.1#",
    version: "2.1",
    software: {
      name: "test",
      version: "1.2.3",
    },
    protocols: ["activitypub"],
    services: {
      inbound: [],
      outbound: [],
    },
    openRegistrations: false,
    usage: {
      users: { total: 3, activeHalfyear: 2, activeMonth: 1 },
      localPosts: 123,
      localComments: 456,
    },
    metadata: {},
  });
});

Deno.test("handleNodeInfoJrd()", async () => {
  const request = new Request("https://example.com/.well-known/nodeinfo");
  let context = createRequestContext<void>({
    data: undefined,
    request,
    url: new URL(request.url),
  });
  let response = await handleNodeInfoJrd(request, context);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/jrd+json");
  assertEquals(await response.json(), { links: [] });

  context = createRequestContext<void>({
    ...context,
    getNodeInfoUri() {
      return new URL("https://example.com/nodeinfo/2.1");
    },
  });
  response = await handleNodeInfoJrd(request, context);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/jrd+json");
  assertEquals(await response.json(), {
    links: [
      {
        href: "https://example.com/nodeinfo/2.1",
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        type: "application/json;" +
          ' profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"',
      },
    ],
  });
});
