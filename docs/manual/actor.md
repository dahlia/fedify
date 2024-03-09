---
parent: Manual
nav_order: 4
---

Actor dispatcher
================

In ActivityPub, [actors] are entities that can perform [activities].  You can
register an actor dispatcher so that Fedify can dispatch an appropriate actor
by its bare handle (i.e., handle without @ prefix and domain suffix).
Since the actor dispatcher is the most significant part of the Fedify,
it is the first thing you need to do to make Fedify work.

An actor dispatcher is a callback function that takes a `Context` object and
a bare handle, and returns an actor object.  The actor object can be one of
the following:

 -  `Application`
 -  `Group`
 -  `Organization`
 -  `Person`
 -  `Service`

The below example shows how to register an actor dispatcher:

~~~~ typescript
import { Federation, Person } from "jsr:@fedify/fedify";

const federation = new Federation({
  // Omitted for brevity; see the related section for details.
});

federation.setActorDispatcher("/users/{handle}", async (ctx, handle) => {
  // Work with the database to find the actor by the handle.
  if (user == null) return null;  // Return null if the actor is not found.
  return new Person({
    id: ctx.getActorUri(handle),
    preferredUsername: handle,
    // Many more properties; see the next section for details.
  });
});
~~~~

In the above example, the `~Federation.setActorDispatcher()` method registers
an actor dispatcher for the `/users/{handle}` path.  This pattern syntax
follows the [URI Template] specification.

> [!TIP]
> By regisrtering the actor dispatcher, `Federation.handle()` automatically
> deals with [WebFinger] requests for the actor.

[actors]: https://www.w3.org/TR/activitystreams-core/#actors
[activities]: https://www.w3.org/TR/activitystreams-core/#activities
[URI Template]: https://datatracker.ietf.org/doc/html/rfc6570
[WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033


Key properties of an `Actor`
----------------------------

Despite ActivityPub declares every property of an actor as optional,
in practice, you need to set some of them to make the actor work properly
with the existing ActivityPub implementations.  The following shows
the key properties of an `Actor` object:

### `id`

The `~Object.id` property is the URI of the actor.  It is a required property
in ActivityPub.  You can use the `Context.getActorUri()` method to generate
the dereferenceable URI of the actor by its bare handle.

### `preferredUsername`

The `preferredUsername` property is the bare handle of the actor.  For the most
cases, it is okay to set the `preferredUsername` property to the string taken
from the `handle` parameter of the actor dispatcher.

### `name`

The `~Object.name` property is the full name of the actor.

### `summary`

The `~Object.summary` property is usually a short biography of the actor.

### `url`

The `~Object.url` property usually refers to the actor's profile page.

### `published`

The `~Object.published` property is the date and time when the actor was
created.  Note that Fedify represents the date and time in
the [`Temporal.Instant`] value.

[`Temporal.Instant`]: https://tc39.es/proposal-temporal/docs/instant.html

### `inbox`

The `inbox` property is the URI of the actor's inbox.  You can use
the `Context.getInboxUri()` method to generate the URI of the actor's
inbox.

See the [*Inbox listeners*](./inbox.md) section for details.

### `outbox`

The `outbox` property is the URI of the actor's outbox.  You can use
the `Context.getOutboxUri()` method to generate the URI of the actor's
outbox.

### `followers`

The `followers` property is the URI of the actor's followers collection.
You can use the `Context.getFollowersUri()` method to generate the URI of
the actor's followers collection.

### `following`

The `following` property is the URI of the actor's following collection.
You can use the `Context.getFollowingUri()` method to generate the URI of
the actor's following collection.

### `publicKey`

The `publicKey` property is the public key of the actor.  It is an instance
of `CryptographicKey` class.

See the [next section](#public-key-of-an-actor) for details.


Public key of an `Actor`
------------------------

In order to sign and verify the activities, you need to set the `publicKey`
property of the actor.  The `publicKey` property is an instance of the
`CryptographicKey` class, and usually you don't have to create it manually.
Instead, you can register a key pair dispatcher through
the `~ActorCallbackSetters.setKeyPairDispatcher()` method so that Fedify can
dispatch an appropriate key pair by the actor's bare handle:

~~~~ typescript
federation.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
  // Work with the database to find the actor by the handle.
  if (user == null) return null;  // Return null if the actor is not found.
  return new Person({
    id: ctx.getActorUri(handle),
    preferredUsername: handle,
    // The third parameter of the actor dispatcher is the public key, if any.
    publicKey: key,
    // Many more properties; see the previous section for details.
  });
})
  .setKeyPairDispatcher(async (ctxData, handle) => {
    // Work with the database to find the key pair by the handle.
    if (user == null) return null;  // Return null if the key pair is not found.
    return { publicKey, privateKey };
  });
~~~~

In the above example, the `~ActorCallbackSetters.setKeyPairDispatcher()` method
registers a key pair dispatcher.  The key pair dispatcher is a callback function
that takes context data and a bare handle, and returns a [`CryptoKeyPair`]
object which is defined in the Web Cryptography API.

Usuaully, you need to generate a key pair for each actor when the actor is
created (i.e., when a new user is signed up), and securely store an actor's key
pair in the database.  The key pair dispatcher should load the key pair from
the database and return it.

How to generate a key pair and store it in the database is out of the scope of
this document, but here's a simple example of how to generate a key pair and
store it in a [Deno KV] database in form of JWK:

~~~~ typescript
const kv = await Deno.openKv();
const { privateKey, publicKey } = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 4096,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
await kv.set(["keypair", handle], {
  privateKey: await crypto.subtle.exportKey("jwk", privateKey),
  publicKey: await crypto.subtle.exportKey("jwk", publicKey),
});
~~~~

> [!NOTE]
> As of March 2024, Fedify only supports RSA-PKCS#1-v1.5 algorithm with SHA-256
> hash function for signing and verifying the activities.  This limitation
> is due to the fact that Mastodon, the most popular ActivityPub implementation,
> [only supports it][1].  In the future, Fedify will support more algorithms
> and hash functions.

Here's an example of how to load a key pair from the database too:

~~~~ typescript
.setKeyPairDispatcher(async (ctxData, handle) => {
  const kv = await Deno.openKv();
  const entry = await kv.get<{ privateKey: unknown; publicKey: unknown }>(
    ["keypair", handle],
  );
  if (entry == null || entry.value == null) return null;
  return {
    privateKey: await crypto.subtle.importKey(
      "jwk",
      entry.value.privateKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["sign"],
    ),
    publicKey: await crypto.subtle.importKey(
      "jwk",
      entry.value.publicKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"],
    ),
  };
});
~~~~

[`CryptoKeyPair`]: https://developer.mozilla.org/en-US/docs/Web/API/CryptoKeyPair
[Deno KV]: https://deno.com/kv
[1]: https://github.com/mastodon/mastodon/issues/21429
