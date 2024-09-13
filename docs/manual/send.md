---
description: >-
  Fedify provides a way to send activities to other actors' inboxes.
  This section explains how to send activities to others.
prev:
  text: Inbox listeners
  link: ./inbox.md
next:
  text: Collections
  link: ./collections.md
---

Sending activities
==================

In ActivityPub, an actor can deliver an activity to another actor by [sending
an HTTP `POST` request to the recipient's inbox][1].  Fedify provides
an abstracted way to send activities to other actors' inboxes.

[1]: https://www.w3.org/TR/activitypub/#delivery


Prerequisite: actor key pairs
-----------------------------

Before sending an activity to another actor, you need to have the sender's
key pairs.  The key pairs are used to sign the activity so that the recipient
can verify the sender's identity.  The key pairs can be registered by calling
`~ActorCallbackSetters.setKeyPairsDispatcher()` method.

For more information about this topic, see [*Public keys of an `Actor`*
section](./actor.md#public-keys-of-an-actor) in the *Actor dispatcher* section.


Sending an activity
-------------------

To send an activity to another actor, you can use the `Context.sendActivity()`
method.  The following shows how to send a `Follow` activity to another actor:

~~~~ typescript{8-15}
import { Context, Follow, Recipient } from "@fedify/fedify";

async function sendFollow(
  ctx: Context<void>,
  senderHandle: string,
  recipient: Recipient,
) {
  await ctx.sendActivity(
    { handle: senderHandle },
    recipient,
    new Follow({
      actor: ctx.getActorUri(senderHandle),
      object: recipient.id,
    }),
  );
}
~~~~

> [!TIP]
> Wonder where you can acquire a `Context` object?  See the [*Where to get a
> `Context` object* section](./context.md#where-to-get-a-context-object) in
> the *Context* section.


Enqueuing an outgoing activity
------------------------------

The delivery failure can happen for various reasons, such as network failure,
recipient server failure, and so on.  For reliable delivery, Fedify enqueues
an outgoing activity to the queue instead of immediately sending it to
the recipient's inbox if possible; the system retries the delivery on failure.

This queueing mechanism is enabled only if a [`queue`](./federation.md#queue)
option is set to the `createFederation()` function:

~~~~ typescript
import { createFederation, InProcessMessageQueue } from "@fedify/fedify";

const federation = createFederation({
  // Omitted for brevity; see the related section for details.
  queue: new InProcessMessageQueue(),  // [!code highlight]
});
~~~~

> [!NOTE]
> The `InProcessMessageQueue` is a simple in-memory message queue that is
> suitable for development and testing.  For production use, you should
> consider using a more robust message queue, such as `DenoKvMessageQueue`
> from `@fedify/fedify/x/deno` module or [`RedisMessageQueue`] from
> [`@fedify/redis`] package.

The failed activities are automatically retried after a certain period of time.
The default retry strategy is exponential backoff with a maximum of 10 retries,
but you can customize it by providing
an [`outboxRetryPolicy`](./federation.md#outboxretrypolicy) option to
the `createFederation()` function.

If the `queue` is not set, the `~Context.sendActivity()` method immediately
sends the activity to the recipient's inbox.  If the delivery fails, it throws
an error and does not retry the delivery.

[`RedisMessageQueue`]: https://jsr.io/@fedify/redis/doc/mq/~/RedisMessageQueue
[`@fedify/redis`]: https://github.com/dahlia/fedify-redis


Immediately sending an activity
-------------------------------

Sometimes you may want to send an activity immediately without queueing it.
You can do this by calling the `~Context.sendActivity()` method with the
`immediate` option:


~~~~ typescript
import { Context, Follow, Recipient } from "@fedify/fedify";

async function sendFollow(
  ctx: Context<void>,
  senderHandle: string,
  recipient: Recipient,
) {
  await ctx.sendActivity(
    { handle: senderHandle },
    recipient,
    new Follow({
      actor: ctx.getActorUri(senderHandle),
      object: recipient.id,
    }),
    { immediate: true },  // [!code highlight]
  );
}
~~~~

Shared inbox delivery
---------------------

The [shared inbox delivery] is an efficient way to deliver an activity to
multiple recipients belonging to the same server at once.  It is useful
for broadcasting activities, such as a public post.

By default, `~Context.sendActivity()` method delivers an activity to the
recipient's personal inbox.  To deliver an activity to the shared inbox,
you can pass the `preferSharedInbox` option:

~~~~ typescript
import {
  Context,
  Create,
  Note,
  Recipient,
  PUBLIC_COLLECTION,
} from "@fedify/fedify";

async function sendNote(
  ctx: Context<void>,
  senderHandle: string,
  recipient: Recipient,
) {
  await ctx.sendActivity(
    { handle: senderHandle },
    recipient,
    new Create({
      actor: ctx.getActorUri(senderHandle),
      to: PUBLIC_COLLECTION,
      object: new Note({
        attribution: ctx.getActorUri(senderHandle),
        to: PUBLIC_COLLECTION,
      }),
    }),
    { preferSharedInbox: true },  // [!code highlight]
  );
}
~~~~

> [!TIP]
> `PUBLIC_COLLECTION` constant contains a `URL` object of
> <https://www.w3.org/ns/activitystreams#Public>, a special IRI that
> represents the public audience.  By setting the `to` property to this IRI,
> the activity is visible to everyone.  See also the [*Public Addressing*
> section](https://www.w3.org/TR/activitypub/#public-addressing) in the
> ActivityPub specification.

> [!NOTE]
> To deliver an activity to the shared inbox, the recipient server must support
> the shared inbox delivery.  Otherwise, Fedify silently falls back to
> the personal inbox delivery.

[shared inbox delivery]: https://www.w3.org/TR/activitypub/#shared-inbox-delivery


Followers collection synchronization
------------------------------------

*This API is available since Fedify 0.8.0.*

> [!NOTE]
> For efficiency, you should implement
> [filtering-by-server](./collections.md#filtering-by-server) of
> the followers collection, otherwise the synchronization may be slow.

If an activity needs to be delivered to only followers of the sender through
the shared inbox, the server of the recipients has to be aware of the list of
followers residing on the server.  However, synchronizing the followers
collection every time an activity is sent is inefficient. To solve this problem,
Mastodon, etc., use a mechanism called [followers collection
synchronization][FEP-8fcf].

The idea is to send a digest of the followers collection with the activity
so that the recipient server can check if it needs to resynchronize
the followers collection.  Fedify provides a way to include the digest
of the followers collection in the activity delivery request by specifying
the recipients parameter of the `~Context.sendActivity()` method as
the `"followers"` string:

~~~~ typescript
await ctx.sendActivity(
  { handle: senderHandle },
  "followers",  // [!code highlight]
  new Create({
    actor: ctx.getActorUri(senderHandle),
    to: ctx.getFollowersUri(senderHandle),
    object: new Note({
      attribution: ctx.getActorUri(senderHandle),
      to: ctx.getFollowersUri(senderHandle),
    }),
  }),
  { preferSharedInbox: true },  // [!code highlight]
);
~~~~

If you specify the `"followers"` string as the recipients parameter,
it automatically sends the activity to the sender's followers and includes
the digest of the followers collection in the payload.

> [!NOTE]
> The `to` and `cc` properties of an `Activity` and its `object` should be set
> to the followers collection IRI to ensure that the activity is visible to
> the followers.  If you set the `to` and `cc` properties to
> the `PUBLIC_COLLECTION`, the activity is visible to everyone regardless of
> the recipients parameter.

[FEP-8fcf]: https://w3id.org/fep/8fcf


Excluding same-server recipients
--------------------------------

*This API is available since Fedify 0.9.0.*

In most cases, you will not want to deliver activities via ActivityPub to
recipients on the same server with the sender.  To exclude same-server
recipients, you can pass the `excludeBaseUris` option to the
`~Context.sendActivity()` method:

~~~~ typescript
await ctx.sendActivity(
  { handle: senderHandle },
  "followers",
  activity,
  { excludeBaseUris: [ctx.getInboxUri()] },  // [!code highlight]
);
~~~~

Excluded recipients do not receive the activity, even if they are included in
the recipients parameter.

> [!NOTE]
> Only the `origin` parts of the specified URIs are compared with the
> inbox URLs of the recipients.  Even if they have `pathname` or `search` parts,
> they are ignored when comparing the URIs.


Error handling
--------------

*This API is available since Fedify 0.6.0.*

Since an outgoing activity is not immediately processed, but enqueued to the
queue, the `~Context.sendActivity()` method does not throw an error even if
the delivery fails.  Instead, the delivery failure is reported to the queue
and retried later.

If you want to handle the delivery failure, you can register an error handler
to the queue:

~~~~ typescript{6-9}
import { createFederation, InProcessMessageQueue } from "@fedify/fedify";

const federation = createFederation({
  // Omitted for brevity; see the related section for details.
  queue: new InProcessMessageQueue(),
  onOutboxError: (error, activity) => {
    console.error("Failed to deliver an activity:", error);
    console.error("Activity:", activity);
  },
});
~~~~

> [!NOTE]
> The `onOutboxError` callback can be called multiple times for the same
> activity, because the delivery is retried according to the backoff schedule
> until it succeeds or reaches the maximum retry count.


HTTP Signatures
---------------

[HTTP Signatures] is a de facto standard for signing ActivityPub activities.
It is widely used in the fediverse to verify the sender's identity and
the integrity of the activity.

Fedify automatically signs activities with the sender's private key if
the [actor keys dispatcher is set](./actor.md#public-keys-of-an-actor) and
the actor has any RSA-PKCS#1-v1.5 key pair.  If there are multiple key pairs,
Fedify selects the first RSA-PKCS#1-v1.5 key pair among them.

[HTTP Signatures]: https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures


Linked Data Signatures
----------------------

*This API is available since Fedify 1.0.0.*

[Linked Data Signatures] is a more advanced and widely used, but *obsolete*,
mechanism for signing portable ActivityPub activities.  As of September 2024,
major ActivityPub implementations, such as Mastodon, et al., still rely on
Linked Data Signatures for signing portable activities, despite they declare
that Linked Data Signatures is outdated.

It shares the similar concept with [HTTP Signatures](#http-signatures),
but unlike HTTP Signatures, it can be used for signing portable activities.
For example, it can be used for [forwarding from inbox] and several other
cases that HTTP Signatures cannot handle.

Fedify automatically includes the Linked Data Signature of activities by
signing them with the sender's private key if the [actor keys dispatcher is
set](./actor.md#public-keys-of-an-actor) and the actor has any RSA-PKCS#1-v1.5
key pair.  If there are multiple key pairs, Fedify uses the first
RSA-PKCS#1-v1.5 key pair among them.

> [!TIP]
> The combination of HTTP Signatures and Linked Data Signatures is the most
> widely supported way to sign activities in the fediverse, as of September
> 2024.  Despite Linked Data Signatures is outdated and not recommended for
> new implementations, it is still widely used in the fediverse due to Mastodon
> and other major implementations' reliance on it.
>
> However, for new implementations, you should consider using *both* [Object
> Integrity Proofs](#object-integrity-proofs) and Linked Data Signatures
> for maximum compatibility and future-proofing.  Fortunately, Fedify supports
> both Object Integrity Proofs and Linked Data Signatures simultaneously,
> in addition to HTTP Signatures.

> [!NOTE]
> If an activity is signed with both HTTP Signatures and Linked Data Signatures,
> the recipient verifies the Linked Data Signatures first when it is supported,
> and ignores the HTTP Signatures if the Linked Data Signatures are valid.
> If the recipient does not support Linked Data Signatures, it falls back to
> verifying the HTTP Signatures.

[Linked Data Signatures]: https://web.archive.org/web/20170923124140/https://w3c-dvcg.github.io/ld-signatures/
[forwarding from inbox]: https://www.w3.org/TR/activitypub/#inbox-forwarding


Object Integrity Proofs
-----------------------

*This API is available since Fedify 0.10.0.*

[Object Integrity Proofs][FEP-8b32] is a mechanism to ensure the integrity
of ActivityPub objects (not only activities!) in the fediverse.  It shares
the similar concept with [Linked Data Signatures](#linked-data-signatures),
but it has more functionalities and is more flexible.  However, as it is
relatively new, it is not widely supported yet.

Fedify automatically includes the integrity proof of activities by signing
them with the sender's private key if the [actor keys dispatcher is
set](./actor.md#public-keys-of-an-actor) and the actor has any Ed25519 key pair.
If there are multiple key pairs, Fedify creates the number of integrity proofs
equal to the number of Ed25519 key pairs.

> [!TIP]
> HTTPS Signatures, Linked Data Signatures, and Object Integrity Proofs can
> coexist in an application and be used together for maximum compatibility.
>
> If an activity is signed with HTTP Signatures, Linked Data Signatures,
> and Object Integrity Proofs, the recipient verifies the Object Integrity
> Proofs first when it is supported, and ignores the HTTP Signatures and
> Linked Data Signatures if the Object Integrity Proofs are valid.
> If the recipient does not support Object Integrity Proofs, it falls back to
> verifying the HTTP Signatures and Linked Data Signatures.
>
> To support HTTP Signatures, Linked Data Signatures, and Object Integrity
> Proofs simultaneously, you need to generate both RSA-PKCS#1-v1.5 and Ed25519
> key pairs for each actor, and store them in the database.

[FEP-8b32]: https://w3id.org/fep/8b32
[several other cases]: https://socialhub.activitypub.rocks/t/fep-8b32-object-integrity-proofs/2725/79?u=hongminhee
