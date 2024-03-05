import { assertEquals } from "jsr:@std/assert@^0.218.2";
import { Service } from "../mod.ts";
import { Actor } from "../vocab/actor.ts";
import { Application, Endpoints, Group, Person } from "../vocab/vocab.ts";
import { extractInboxes } from "./send.ts";

Deno.test("extractInboxes()", () => {
  const recipients: Actor[] = [
    new Person({
      id: new URL("https://example.com/alice"),
      inbox: new URL("https://example.com/alice/inbox"),
      endpoints: new Endpoints({
        sharedInbox: new URL("https://example.com/inbox"),
      }),
    }),
    new Application({
      id: new URL("https://example.com/app"),
      inbox: new URL("https://example.com/app/inbox"),
      endpoints: new Endpoints({
        sharedInbox: new URL("https://example.com/inbox"),
      }),
    }),
    new Group({
      id: new URL("https://example.org/group"),
      inbox: new URL("https://example.org/group/inbox"),
    }),
    new Service({
      id: new URL("https://example.net/service"),
      inbox: new URL("https://example.net/service/inbox"),
      endpoints: new Endpoints({
        sharedInbox: new URL("https://example.net/inbox"),
      }),
    }),
  ];
  let inboxes = extractInboxes({ recipients });
  assertEquals(
    inboxes,
    new Set([
      new URL("https://example.com/alice/inbox"),
      new URL("https://example.com/app/inbox"),
      new URL("https://example.org/group/inbox"),
      new URL("https://example.net/service/inbox"),
    ]),
  );
  inboxes = extractInboxes({ recipients, preferSharedInbox: true });
  assertEquals(
    inboxes,
    new Set([
      new URL("https://example.com/inbox"),
      new URL("https://example.org/group/inbox"),
      new URL("https://example.net/inbox"),
    ]),
  );
});
