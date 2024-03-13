---
parent: Manual
nav_order: 2
metas:
  description: >-
    The Context object is a container that holds the information of the current
    request.  This section explains the key features of the Context object.
---

Context
=======

The `Context` object is a container that holds the information of the current
request.  It is passed to various callback functions that are registered to
the `Federation` object, and also can be gathered from the outside of the
callbacks.

The key features of the `Context` object are as follows:

 -  Carrying [`TContextData`](./federation.md#tcontextdata)
 -  Building the object URIs (e.g., actor URIs, shared inbox URI)
 -  Getting the current HTTP request
 -  Enqueuing an outgoing activity
 -  Getting a `DocumentLoader`


Where to get a `Context` object
-------------------------------

You can get a `Context` object from the first parameter of the most of callbacks
that are registered to the `Federation` object.  The following shows a few
callbacks that take a `Context` object as the first parameter:

 -  [Actor dispatcher](./actor.md)
 -  [Inbox listeners](./inbox.md)
 -  Outbox dispatcher
 -  Followers collection
 -  Following collection
 -  [NodeInfo dispatcher](./nodeinfo.md)

Those are not all; there are more callbacks that take a `Context` object.

You can also get a `Context` object from the `Federation` object by calling the
`~Federation.createContext()` method.  The following shows an example:

~~~~ typescript
import { federation } from "../federation.ts"; // Import the `Federation` object

export async function handler(request: Request) {
  const ctx = federation.createContext(request, undefined);
  // Work with the `ctx` object...
};
~~~~


Building the object URIs
------------------------

The `Context` object has a few methods to build the object URIs.  The following
shows the methods:

 -  `~Context.getNodeInfoUri()`
 -  `~Context.getActorUri()`
 -  `~Context.getInboxUri()`
 -  `~Context.getOutboxUri()`
 -  `~Context.getFollowingUri()`
 -  `~Context.getFollowersUri()`

You could hard-code the URIs, but it is better to use those methods to build
the URIs because the URIs are subject to change in the future.

Here's an example of using the `~Context.getActorUri()` method in the actor
dispatcher:

~~~~ typescript
federation.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
  // Work with the database to find the actor by the handle.
  if (user == null) return null;
  return new Person({
    id: ctx.getActorUri(handle),
    preferredUsername: handle,
    // Many more properties...
  });
});
~~~~

On the other way around, you can use the `~Context.getHandleFromActorUri()`
method to get the bare handle from the actor URI.


Enqueuing an outgoing activity
------------------------------

The `Context` object can enqueue an outgoing activity to the actor's outbox
by calling the `~Context.sendActivity()` method.  The following shows an
example in an [inbox listener](./inbox.md):

~~~~ typescript
import { Accept, Follow } from "@fedify/fedify";

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    // In order to send an activity, we need the bare handle of the sender:
    const handle = ctx.getHandleFromActorUri(follow.objectId);
    if (handle == null) return;
    const recipient = await follow.getActor(ctx);
    await ctx.sendActivity(
      { handle }, // sender
      recipient,
      new Accept({ actor: follow.objectId, object: follow }),
    );
  });
~~~~

> [!NOTE]
> The `~Context.sendActivity()` method works only if the [key pair dispatcher]
> is registered to the `Federation` object.  If the key pair dispatcher is not
> registered, the `~Context.sendActivity()` method throws an error.

> [!TIP]
> Why do you need to enqueue an outgoing activity, instead of directly sending
> the activity to the recipient's inbox?  The reason is that in distributed
> systems, we need to consider the delivery failure.  If the delivery fails,
> the system needs to retry the delivery.  Delivery failure can happen for
> various reasons, such as network failure, recipient server failure, and so on.
>
> Anyway, you don't have to worry about the delivery failure because the
> Fedify handles the delivery failure by enqueuing the outgoing
> activity to the actor's outbox and retrying the delivery on failure.

[key pair dispatcher]: ./actor.md#public-key-of-an-actor


Getting a `DocumentLoader`
--------------------------

The `Context.documentLoader` property carries a `DocumentLoader` object that
is specified in the `Federation` constructor.  It is used to load remote
document in the JSON-LD format.  There are a few methods to take
a `DocumentLoader` as an option in vocabulary API:

 -  [`fromJsonLd()` static method](./vocab.md#json-ld)
 -  [`toJsonLd()` method](./vocab.md#json-ld)
 -  [`get*()` dereferencing accessors](./vocab.md#object-ids-and-remote-objects)
 -  [`lookupObject()` function](./vocab.md#looking-up-remote-objects)

All of those methods take options in the form of
`{ documentLoader: DocumentLoader }` which is compatible with `Context`.
So you can just pass a `Context` object to those methods:

~~~~ typescript
const object = await Object.fromJsonLd(jsonLd, ctx);
const json = await object.toJsonLd(ctx);
~~~~
