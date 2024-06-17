---
description: >-
  You can register an actor dispatcher so that Fedify can dispatch
  an appropriate actor by its bare handle.  This section explains
  how to register an actor dispatcher and the key properties of an actor.
prev:
  text: Vocabulary
  link: ./vocab.md
next:
  text: Inbox listeners
  link: ./inbox.md
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

~~~~ typescript{7-15}
import { createFederation, Person } from "@fedify/fedify";

const federation = createFederation({
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
> By registering the actor dispatcher, `Federation.fetch()` automatically
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

### `endpoints`

The `endpoints` property is an `Endpoints` instance, an object that contains
the URIs of the actor's endpoints.  The most important endpoint is the `sharedInbox`.  You can use the `Context.getInboxUri()` method with no arguments
to generate the URI of the actor's shared inbox:

~~~~ typescript
new Endpoints({ sharedInbox: ctx.getInboxUri() })
~~~~

### `publicKey`

The `publicKey` property contains the public key of the actor.  It is
a `CryptographicKey` instance.  This property is usually used for verifying
[HTTP Signatures](./send.md#http-signatures).

See the [next section](#public-keys-of-an-actor) for details.

> [!TIP]
> In theory, an actor has multiple `publicKeys`, but in practice, the most
> implementations have trouble with multiple keys.  Therefore, it is recommended
> to set only one key in the `publicKey` property.  Usually, it contains
> the first RSA-PKCS#1-v1.5 public key of the actor.
>
> If you need to set multiple keys, you can use the `assertionMethods` property
> instead.

### `assertionMethods`

*This API is available since Fedify 0.10.0.*

The `assertionMethods` property contains the public keys of the actor.  It is
an array of `Multikey` instances.  This property is usually used for verifying
[Object Integrity Proofs](./send.md#object-integrity-proofs).

> [!TIP]
> Usually, the `assertionMethods` property contains the Ed25519 public keys of
> the actor.  Although it is okay to include RSA-PKCS#1-v1.5 public keys too,
> those RSA-PKCS#1-v1.5 keys are not used for verifying Object Integrity Proofs.


Public keys of an `Actor`
-------------------------

In order to sign and verify the activities, you need to set the `publicKey`
property of the actor.  The `publicKey` property contains a `CryptographicKey`
instance, and usually you don't have to create it manually.
Instead, you can register a key pairs dispatcher through
the `~ActorCallbackSetters.setKeyPairsDispatcher()` method so that Fedify can
dispatch appropriate key pairs by the actor's bare handle:

~~~~ typescript{7-9,12-17}
federation.setActorDispatcher("/users/{handle}", async (ctx, handle) => {
  // Work with the database to find the actor by the handle.
  if (user == null) return null;  // Return null if the actor is not found.
  return new Person({
    id: ctx.getActorUri(handle),
    preferredUsername: handle,
    // Context.getActorKeyPairs() method dispatches the key pairs of an actor
    // by the handle, and returns an array of key pairs in various formats.
    // In this example, we only use first CryptographicKey.
    publicKey: (await ctx.getActorKeyPairs(handle))[0].cryptographicKey,
    // Many more properties; see the previous section for details.
  });
})
  .setKeyPairsDispatcher(async (ctxData, handle) => {
    // Work with the database to find the key pair by the handle.
    if (user == null) return [];  // Return null if the key pair is not found.
    // Return the loaded key pair.  See the below example for details.
    return [{ publicKey, privateKey }];
  });
~~~~

In the above example, the `~ActorCallbackSetters.setKeyPairsDispatcher()` method
registers a key pairs dispatcher.  The key pairs dispatcher is a callback
function that takes context data and a bare handle, and returns an array of
[`CryptoKeyPair`] object which is defined in the Web Cryptography API.

Usually, you need to generate key pairs for each actor when the actor is
created (i.e., when a new user is signed up), and securely store an actor's key
pairs in the database.  The key pairs dispatcher should load the key pairs from
the database and return them.

How to generate key pairs and store them in the database is out of the scope of
this document, but here's a simple example of how to generate a key pair and
store it in a [Deno KV] database in form of JWK:

~~~~ typescript
import { generateCryptoKeyPair, exportJwk } from "@fedify/fedify";

const kv = await Deno.openKv();
const { privateKey, publicKey } =
  await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
await kv.set(["keypair", handle], {
  privateKey: await exportJwk(privateKey),
  publicKey: await exportJwk(publicKey),
});
~~~~

> [!TIP]
> Fedify currently supports two key types:
>
>  -  RSA-PKCS#1-v1.5 (`"RSASSA-PKCS1-v1_5"`) is used for [HTTP
>     Signatures](./send.md#http-signatures).
>  -  Ed25519 (`"Ed25519"`) is used for [Object Integrity
>     Proofs](./send.md#object-integrity-proofs).
>
> HTTP Signatures is a de facto standard for signing ActivityPub activities,
> and Object Integrity Proofs is a new standard for verifying the integrity
> of the objects in the fediverse.  While HTTP Signatures is widely supported
> in the fediverse, it's limited to the RSA-PKCS#1-v1.5 algorithm,
> and unusable for [forwarding from inbox][1] and [several other cases][2].
>
> If your federated app needs to support both HTTP Signatures and Object
> Integrity Proofs, you need to generate both RSA-PKCS#1-v1.5 and Ed25519 key
> pairs for each actor, and store them in the database.

Here's an example of how to load a key pair from the database too:

~~~~ typescript{8-16}
import { importJwk } from "@fedify/fedify";

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle) => {
    // Omitted for brevity; see the previous example for details.
  })
  .setKeyPairsDispatcher(async (ctxData, handle) => {
    const kv = await Deno.openKv();
    const entry = await kv.get<{ privateKey: JsonWebKey; publicKey: JsonWebKey }>(
      ["keypair", handle],
    );
    if (entry == null || entry.value == null) return [];
    return [
      {
        privateKey: await importJwk(entry.value.privateKey, "private"),
        publicKey: await importJwk(entry.value.publicKey, "public"),
      }
    ];
  });
~~~~

[1]: https://www.w3.org/TR/activitypub/#inbox-forwarding
[2]: https://socialhub.activitypub.rocks/t/fep-8b32-object-integrity-proofs/2725/79?u=hongminhee
[`CryptoKeyPair`]: https://developer.mozilla.org/en-US/docs/Web/API/CryptoKeyPair
[Deno KV]: https://deno.com/kv
