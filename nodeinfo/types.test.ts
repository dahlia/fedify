import { assertEquals, assertThrows } from "jsr:@std/assert@^0.218.2";
import { NodeInfo, toJson } from "./types.ts";

Deno.test("toJson()", () => {
  const validInfo: NodeInfo = {
    software: {
      name: "software-name",
      version: { major: 1, minor: 2, patch: 3 },
    },
    protocols: ["activitypub"],
    usage: {
      users: { total: 100, activeHalfyear: 50, activeMonth: 10 },
      localPosts: 1000,
      localComments: 10000,
    },
  };
  assertEquals(
    toJson(validInfo),
    {
      "$schema": "http://nodeinfo.diaspora.software/ns/schema/2.1#",
      version: "2.1",
      software: {
        name: "software-name",
        version: "1.2.3",
        repository: undefined,
        homepage: undefined,
      },
      protocols: ["activitypub"],
      services: { inbound: [], outbound: [] },
      openRegistrations: false,
      usage: {
        localComments: 10000,
        localPosts: 1000,
        users: { activeHalfyear: 50, activeMonth: 10, total: 100 },
      },
      metadata: {},
    },
  );
  assertEquals(
    toJson({
      ...validInfo,
      software: {
        ...validInfo.software,
        repository: new URL("https://example.com/repo"),
        homepage: new URL("https://example.com/home"),
      },
      services: {
        inbound: ["atom1.0", "imap"],
        outbound: ["atom1.0", "smtp"],
      },
      openRegistrations: true,
    }),
    {
      "$schema": "http://nodeinfo.diaspora.software/ns/schema/2.1#",
      version: "2.1",
      software: {
        name: "software-name",
        version: "1.2.3",
        repository: "https://example.com/repo",
        homepage: "https://example.com/home",
      },
      protocols: ["activitypub"],
      services: {
        inbound: ["atom1.0", "imap"],
        outbound: ["atom1.0", "smtp"],
      },
      openRegistrations: true,
      usage: {
        localComments: 10000,
        localPosts: 1000,
        users: { activeHalfyear: 50, activeMonth: 10, total: 100 },
      },
      metadata: {},
    },
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        software: { ...validInfo.software, name: "INVALID-NAME" },
      }),
    TypeError,
    "Invalid software name",
  );
  assertThrows(
    () => toJson({ ...validInfo, protocols: [] }),
    TypeError,
    "At least one protocol must be supported",
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        usage: {
          ...validInfo.usage,
          users: { ...validInfo.usage.users, total: -1 },
        },
      }),
    TypeError,
    "Invalid total users",
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        usage: {
          ...validInfo.usage,
          users: { ...validInfo.usage.users, total: 1.23 },
        },
      }),
    TypeError,
    "Invalid total users",
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        usage: {
          ...validInfo.usage,
          users: { ...validInfo.usage.users, activeHalfyear: -1 },
        },
      }),
    TypeError,
    "Invalid active halfyear users",
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        usage: {
          ...validInfo.usage,
          users: { ...validInfo.usage.users, activeHalfyear: 1.23 },
        },
      }),
    TypeError,
    "Invalid active halfyear users",
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        usage: {
          ...validInfo.usage,
          users: { ...validInfo.usage.users, activeMonth: -1 },
        },
      }),
    TypeError,
    "Invalid active month users",
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        usage: {
          ...validInfo.usage,
          users: { ...validInfo.usage.users, activeMonth: 1.23 },
        },
      }),
    TypeError,
    "Invalid active month users",
  );
  assertThrows(
    () =>
      toJson({ ...validInfo, usage: { ...validInfo.usage, localPosts: -1 } }),
    TypeError,
    "Invalid local posts",
  );
  assertThrows(
    () =>
      toJson({ ...validInfo, usage: { ...validInfo.usage, localPosts: 1.23 } }),
    TypeError,
    "Invalid local posts",
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        usage: { ...validInfo.usage, localComments: -1 },
      }),
    TypeError,
    "Invalid local comments",
  );
  assertThrows(
    () =>
      toJson({
        ...validInfo,
        usage: { ...validInfo.usage, localComments: 1.23 },
      }),
    TypeError,
    "Invalid local comments",
  );
});
