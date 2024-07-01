---
description: >-
  Fedify provides a way to register inbox listeners so that you can handle
  incoming activities from other actors.  This section explains how to
  register an inbox listener and how to handle errors.
prev:
  text: Actor dispatcher
  link: ./actor.md
next:
  text: Sending activities
  link: ./send.md
---

Inbox listeners
===============

In ActivityPub, an [inbox] is where an actor receives incoming activities from
other actors.  Fedify provides a way to register inbox listeners so that you can
handle incoming activities from other actors.

[inbox]: https://www.w3.org/TR/activitypub/#inbox


Registering an inbox listener
-----------------------------

An inbox is basically an HTTP endpoint that receives webhook requests from other
servers.  There are two types of inboxes in ActivityPub: the [shared inbox] and
the personal inbox.  The shared inbox is a single inbox that receives activities
for all actors in the server, while the personal inbox is an inbox for a specific
actor.

With Fedify, you can register an inbox listener for both types of inboxes at
a time.  The following shows how to register an inbox listener:

~~~~ typescript{7-18}
import { createFederation, Follow } from "@fedify/fedify";

const federation = createFederation({
  // Omitted for brevity; see the related section for details.
});

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor") return;
    const recipient = await follow.getActor(ctx);
    await ctx.sendActivity(
      { handle: parsed.handle },
      recipient,
      new Accept({ actor: follow.objectId, object: follow }),
    );
  });
~~~~

In the above example, the `~Federation.setInboxListeners()` method registers
path patterns for the personal inbox and the shared inbox, and the following
`~InboxListenerSetters.on()` method registers an inbox listener for the `Follow`
activity.  The `~InboxListenerSetters.on()` method takes a class of the activity
and a callback function that takes a `Context` object and the activity object.

Note that the `~InboxListenerSetters.on()` method can be chained to register
multiple inbox listeners for different activity types.

> [!WARNING]
> Activities of any type that are not registered with
> the `~InboxListenerSetters.on()` method are silently ignored.
> If you want to catch all types of activities anyway, add a listener
> for the `Activity` class.

> [!TIP]
> You can get a personal or shared inbox URI by calling
> the `~Context.getInboxUri()` method.  It takes an optional parameter
> `handle` to get the personal inbox URI for the actor with the bare handle.
> If the `handle` parameter is not provided, the method returns the shared
> inbox URI.

[shared inbox]: https://www.w3.org/TR/activitypub/#shared-inbox-delivery


`Context.documentLoader` on an inbox listener
---------------------------------------------

The `Context.documentLoader` property carries a `DocumentLoader` object that
you can use to fetch a remote document.  If a request is made to a shared inbox,
the `Context.documentLoader` property is set to the default `documentLoader`
that is specified in the `createFederation()` function.  However, if a request
is made to a personal inbox, the `Context.documentLoader` property is set to
an authenticated `DocumentLoader` object that is identified by the inbox owner's
key.

This means that you can pass the `Context` object to dereferencing accessors[^1]
inside a personal inbox listener so that they can fetch remote documents with
the correct authentication.

[^1]: See the [*Object IDs and remote objects*
      section](./vocab.md#object-ids-and-remote-objects) if you are not familiar
      with dereferencing accessors.

### Shared inbox key dispatcher

*This API is available since Fedify 0.11.0.*

> [!TIP]
> We highly recommend configuring the shared inbox key dispatcher to avoid
> potential incompatibility issues with ActivityPub servers that require
> [authorized fetch] (i.e., secure mode).

If you want to use an authenticated `DocumentLoader` object as
the `Context.documentLoader` for a shared inbox, you can set the identity
for the authentication using `~InboxListenerSetters.setSharedKeyDispatcher()`
method.  For example, the following shows how to implement the [instance actor]
pattern:

~~~~ typescript{5-9,13-18}
import { Application, Person } from "@fedify/fedify";

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  // The following line assumes that there is an instance actor named `~actor`
  // for the server.  The leading tilde (`~`) is just for avoiding conflicts
  // with regular actor handles, but you don't have to necessarily follow this
  // convention:
  .setSharedKeyDispatcher((_ctx) => ({ handle: "~actor" }));

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle) => {
    if (handle === "~actor") {
      // Returns an Application object for the instance actor:
      return new Application({
        // ...
      });
    }

    // Fetches the regular actor from the database and returns a Person object:
    return new Person({
      // ...
    });
  });
~~~~

Or you can manually configure the key pair instead of referring to an actor
by its handle:

~~~~ typescript{11-18}
import { importJwk } from "@fedify/fedify";

interface InstanceActor {
  privateKey: JsonWebKey;
  publicKeyUri: string;
}

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .setSharedKeyDispatcher(async (_ctx) => {
    // The following getInstanceActor() is just a hypothetical function that
    // fetches information about the instance actor from a database or some
    // other storage:
    const instanceActor: InstanceActor = await getInstanceActor();
    return {
      privateKey: await importJwk(instanceActor.privateKey, "private"),
      keyId: new URL(instanceActor.publicKeyUri),
    };
  });
~~~~

> [!NOTE]
> If a shared inbox key dispatcher returns `null`, the default `documentLoader`,
> which is not authenticated, is used for the shared inbox.

[authorized fetch]: https://swicg.github.io/activitypub-http-signature/#authorized-fetch
[instance actor]: https://seb.jambor.dev/posts/understanding-activitypub-part-4-threads/#the-instance-actor


Making inbox listeners non-blocking
-----------------------------------

*This API is available since Fedify 0.12.0.*

Usually, processes inside an inbox listener should be non-blocking because
they may involve long-running tasks.  Fortunately, you can easily turn inbox
listeners into non-blocking by providing a [`queue`](./federation.md#queue)
option to `createFederation()` function.  If it is not present, incoming
activities are processed immediately and block the response to the sender until
the processing is done.

While the [`queue`](./federation.md#queue) option is not mandatory,
it is highly recommended to use it in production environments to prevent
the server from being overwhelmed by incoming activities.

> [!NOTE]
> Activities with invalid signatures/proofs are silently ignored and not queued.


Error handling
--------------

Since an incoming activity can be malformed or invalid, you may want to handle
such cases.  Also, your listener itself may throw an error.
The `~InboxListenerSetters.onError()` method registers a callback
function that takes a `Context` object and an error object.  The following shows
an example of handling errors:

~~~~ typescript{6-8}
federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    // Omitted for brevity
  })
  .onError(async (ctx, error) => {
    console.error(error);
  });
~~~~

> [!NOTE]
> Activities with invalid signatures/proofs are silently ignored and not passed
> to the error handler.
