import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import * as mf from "mock_fetch";
import { verifyRequest } from "../sig/http.ts";
import { detachSignature, verifyJsonLd } from "../sig/ld.ts";
import { doesActorOwnKey } from "../sig/owner.ts";
import { verifyObject } from "../sig/proof.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import {
  ed25519Multikey,
  ed25519PrivateKey,
  rsaPrivateKey2,
  rsaPrivateKey3,
  rsaPublicKey2,
  rsaPublicKey3,
} from "../testing/keys.ts";
import { test } from "../testing/mod.ts";
import type { Actor } from "../vocab/actor.ts";
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

test("extractInboxes()", () => {
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
    {
      "https://example.com/alice/inbox": new Set(["https://example.com/alice"]),
      "https://example.com/app/inbox": new Set(["https://example.com/app"]),
      "https://example.org/group/inbox": new Set(["https://example.org/group"]),
      "https://example.net/service/inbox": new Set([
        "https://example.net/service",
      ]),
    },
  );
  inboxes = extractInboxes({ recipients, preferSharedInbox: true });
  assertEquals(
    inboxes,
    {
      "https://example.com/inbox": new Set([
        "https://example.com/alice",
        "https://example.com/app",
      ]),
      "https://example.org/group/inbox": new Set(["https://example.org/group"]),
      "https://example.net/inbox": new Set(["https://example.net/service"]),
    },
  );
  inboxes = extractInboxes({
    recipients,
    excludeBaseUris: [new URL("https://foo.bar/")],
  });
  assertEquals(
    inboxes,
    {
      "https://example.com/alice/inbox": new Set(["https://example.com/alice"]),
      "https://example.com/app/inbox": new Set(["https://example.com/app"]),
      "https://example.org/group/inbox": new Set(["https://example.org/group"]),
      "https://example.net/service/inbox": new Set([
        "https://example.net/service",
      ]),
    },
  );
  inboxes = extractInboxes({
    recipients,
    excludeBaseUris: [new URL("https://example.com/")],
  });
  assertEquals(
    inboxes,
    {
      "https://example.org/group/inbox": new Set(["https://example.org/group"]),
      "https://example.net/service/inbox": new Set([
        "https://example.net/service",
      ]),
    },
  );
  inboxes = extractInboxes({
    recipients,
    preferSharedInbox: true,
    excludeBaseUris: [new URL("https://example.com/")],
  });
  assertEquals(
    inboxes,
    {
      "https://example.org/group/inbox": new Set(["https://example.org/group"]),
      "https://example.net/inbox": new Set(["https://example.net/service"]),
    },
  );
});

test("sendActivity()", async (t) => {
  mf.install();

  let verified: ("http-sig" | "proof" | "ld-sig")[] | null = null;
  let request: Request | null = null;
  mf.mock("POST@/inbox", async (req) => {
    verified = [];
    request = req.clone();
    const options = {
      documentLoader: mockDocumentLoader,
      contextLoader: mockDocumentLoader,
    };
    const reqClone = req.clone();
    let jsonLd = await req.json();
    if (await verifyJsonLd(jsonLd, options)) {
      verified.push("ld-sig");
    }
    jsonLd = detachSignature(jsonLd);
    const verifiedObject = await verifyObject(Activity, jsonLd, options);
    if (verifiedObject != null) {
      verified.push("proof");
    }
    const key = await verifyRequest(reqClone, options);
    const activity = await Activity.fromJsonLd(await reqClone.json(), options);
    if (key != null && await doesActorOwnKey(activity, key, options)) {
      verified.push("http-sig");
    }
    if (verified.length > 0) return new Response("", { status: 202 });
    return new Response("", { status: 401 });
  });

  await t.step("success", async () => {
    const activity = new Create({
      id: new URL("https://example.com/activity"),
      actor: new URL("https://example.com/person"),
    });

    await sendActivity({
      activity,
      keys: [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
      inbox: new URL("https://example.com/inbox"),
      contextLoader: mockDocumentLoader,
      headers: new Headers({
        "X-Test": "test",
      }),
    });
    assertEquals(verified, ["http-sig"]);
    assertNotEquals(request, null);
    assertEquals(request?.method, "POST");
    assertEquals(request?.url, "https://example.com/inbox");
    assertEquals(
      request?.headers.get("Content-Type"),
      "application/activity+json",
    );
    assertEquals(request?.headers.get("X-Test"), "test");

    verified = null;
    await sendActivity({
      activity: activity.clone({
        actor: new URL("https://example.com/person2"),
      }),
      keys: [{ privateKey: ed25519PrivateKey, keyId: ed25519Multikey.id! }],
      inbox: new URL("https://example.com/inbox"),
      contextLoader: mockDocumentLoader,
    });
    assertEquals(verified, ["proof"]);
    assertNotEquals(request, null);
    assertEquals(request?.method, "POST");
    assertEquals(request?.url, "https://example.com/inbox");
    assertEquals(
      request?.headers.get("Content-Type"),
      "application/activity+json",
    );

    verified = null;
    await sendActivity({
      activity: activity.clone({
        actor: new URL("https://example.com/person2"),
      }),
      keys: [{ privateKey: rsaPrivateKey3, keyId: rsaPublicKey3.id! }],
      inbox: new URL("https://example.com/inbox"),
      contextLoader: mockDocumentLoader,
    });
    assertEquals(verified, ["ld-sig", "http-sig"]);
    assertNotEquals(request, null);
    assertEquals(request?.method, "POST");
    assertEquals(request?.url, "https://example.com/inbox");
    assertEquals(
      request?.headers.get("Content-Type"),
      "application/activity+json",
    );

    verified = null;
    await sendActivity({
      activity: activity.clone({
        actor: new URL("https://example.com/person2"),
      }),
      keys: [
        { privateKey: rsaPrivateKey3, keyId: rsaPublicKey3.id! },
        { privateKey: ed25519PrivateKey, keyId: ed25519Multikey.id! },
      ],
      inbox: new URL("https://example.com/inbox"),
      contextLoader: mockDocumentLoader,
    });
    assertEquals(verified, ["ld-sig", "proof", "http-sig"]);
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
      id: new URL("https://example.com/activity"),
      actor: new URL("https://example.com/person"),
    });
    await assertRejects(
      () =>
        sendActivity({
          activity,
          keys: [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
          inbox: new URL("https://example.com/inbox2"),
          contextLoader: mockDocumentLoader,
        }),
      Error,
      "Failed to send activity https://example.com/activity to " +
        "https://example.com/inbox2 (500 Internal Server Error):\n" +
        "something went wrong",
    );

    activity = new Create({});
    await assertRejects(
      () =>
        sendActivity({
          activity,
          keys: [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
          inbox: new URL("https://example.com/inbox2"),
          contextLoader: mockDocumentLoader,
        }),
      TypeError,
      "The activity to send must have an id.",
    );

    activity = new Create({
      id: new URL("https://example.com/activity"),
    });
    await assertRejects(
      () =>
        sendActivity({
          activity,
          keys: [{ privateKey: rsaPrivateKey2, keyId: rsaPublicKey2.id! }],
          inbox: new URL("https://example.com/inbox2"),
          contextLoader: mockDocumentLoader,
        }),
      TypeError,
      "The activity to send must have at least one actor property.",
    );
  });

  mf.uninstall();
});
