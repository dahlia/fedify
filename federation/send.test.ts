import {
  assertEquals,
  assertNotEquals,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import * as mf from "mock_fetch";
import { doesActorOwnKey, verify } from "../httpsig/mod.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import { privateKey2, publicKey2 } from "../testing/keys.ts";
import { Actor } from "../vocab/actor.ts";
import {
  Activity,
  Application,
  Create,
  Endpoints,
  Group,
  Person,
  Service,
} from "../vocab/vocab.ts";
import { extractInboxes, sendActivity } from "./send.ts";

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

Deno.test("sendActivity()", async (t) => {
  mf.install();

  let verified: boolean | null = null;
  let request: Request | null = null;
  mf.mock("POST@/inbox", async (req) => {
    request = req;
    const key = await verify(req, mockDocumentLoader);
    const activity = await Activity.fromJsonLd(await req.json(), {
      documentLoader: mockDocumentLoader,
    });
    if (
      key != null && await doesActorOwnKey(activity, key, mockDocumentLoader)
    ) {
      verified = true;
      return new Response("", { status: 202 });
    }
    verified = false;
    return new Response("", { status: 401 });
  });

  await t.step("success", async () => {
    const activity = new Create({
      actor: new URL("https://example.com/person"),
    });
    await sendActivity({
      activity,
      privateKey: privateKey2,
      keyId: publicKey2.id!,
      inbox: new URL("https://example.com/inbox"),
      documentLoader: mockDocumentLoader,
    });
    assertStrictEquals(verified, true);
    assertNotEquals(request, null);
    assertEquals(request?.method, "POST");
    assertEquals(request?.url, "https://example.com/inbox");
    assertEquals(
      request?.headers.get("Content-Type"),
      "application/activity+json",
    );
  });

  mf.mock("POST@/inbox2", (_req) => {
    return new Response("something went wrong", {
      status: 500,
      statusText: "Internal Server Error",
    });
  });

  await t.step("failure", async () => {
    let activity = new Create({
      actor: new URL("https://example.com/person"),
    });
    await assertRejects(
      () =>
        sendActivity({
          activity,
          privateKey: privateKey2,
          keyId: publicKey2.id!,
          inbox: new URL("https://example.com/inbox2"),
          documentLoader: mockDocumentLoader,
        }),
      Error,
      "Failed to send activity to https://example.com/inbox2 " +
        "(500 Internal Server Error):\n" +
        "something went wrong",
    );

    activity = new Create({});
    await assertRejects(
      () =>
        sendActivity({
          activity,
          privateKey: privateKey2,
          keyId: publicKey2.id!,
          inbox: new URL("https://example.com/inbox2"),
          documentLoader: mockDocumentLoader,
        }),
      TypeError,
      "The activity to send must have at least one actor property.",
    );
  });

  mf.uninstall();
});
