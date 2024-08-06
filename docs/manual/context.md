---
description: >-
  The Context object is a container that holds the information of the current
  request.  This section explains the key features of the Context object.
prev:
  text: Federation
  link: ./federation.md
next:
  text: Vocabulary
  link: ./vocab.md
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
 -  Dispatching Activity Vocabulary objects
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
 -  [Outbox collection dispatcher](./collections.md#outbox)
 -  [Inbox collection dispatcher](./collections.md#inbox)
 -  [Following collection dispatcher](./collections.md#following)
 -  [Followers collection dispatcher](./collections.md#followers)
 -  [Liked collection dispatcher](./collections.md#liked)
 -  [Featured collection dispatcher](./collections.md#featured)
 -  [Featured tags collection dispatcher](./collections.md#featured-tags)
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


Getting the base URL
--------------------

*This API is available since Fedify 0.12.0.*

The `Context` object has properties to get the base URL of the current request:

| Property           | Description                             | Value example              |
|--------------------|-----------------------------------------|----------------------------|
| `Context.hostname` | A hostname                              | `"example.com"`            |
| `Context.host`     | A hostname followed by an optional port | `"example.com:88"`         |
| `Context.origin`   | A scheme followed by a host             | `"https://example.com:88"` |

For `RequestContext`, there is an additional property named `~RequestContext.url` that
contains the full URL of the current request.


Building the object URIs
------------------------

The `Context` object has a few methods to build the object URIs.  The following
shows the methods:

 -  `~Context.getNodeInfoUri()`
 -  `~Context.getActorUri()`
 -  `~Context.getObjectUri()`
 -  `~Context.getInboxUri()`
 -  `~Context.getOutboxUri()`
 -  `~Context.getFollowingUri()`
 -  `~Context.getFollowersUri()`
 -  `~Context.getLikedUri()`
 -  `~Context.getFeaturedUri()`
 -  `~Context.getFeaturedTagsUri()`

You could hard-code the URIs, but it is better to use those methods to build
the URIs because the URIs are subject to change in the future.

Here's an example of using the `~Context.getActorUri()` method in the actor
dispatcher:

~~~~ typescript
federation.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
  // Work with the database to find the actor by the handle.
  if (user == null) return null;
  return new Person({
    id: ctx.getActorUri(handle),  // [!code highlight]
    preferredUsername: handle,
    // Many more properties...
  });
});
~~~~

On the other way around, you can use the `~Context.parseUri()` method to
determine the type of the URI and extract the handle or other values from
the URI.


Enqueuing an outgoing activity
------------------------------

The `Context` object can enqueue an outgoing activity to the actor's outbox
by calling the `~Context.sendActivity()` method.  The following shows an
example in an [inbox listener](./inbox.md):

~~~~ typescript{10-14}
import { Accept, Follow } from "@fedify/fedify";

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    // In order to send an activity, we need the bare handle of the sender:
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor") return;
    const recipient = await follow.getActor(ctx);
    await ctx.sendActivity(
      { handle: parsed.handle }, // sender
      recipient,
      new Accept({ actor: follow.objectId, object: follow }),
    );
  });
~~~~

For more information about this topic, see the [*Sending activities*
section](./send.md).

> [!NOTE]
> The `~Context.sendActivity()` method works only if the [key pairs dispatcher]
> is registered to the `Federation` object.  If the key pairs dispatcher is not
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

[key pairs dispatcher]: ./actor.md#public-keys-of-an-actor


Dispatching objects
-------------------

*This API is available since Fedify 0.7.0.*

The `RequestContext` object has a method to dispatch an Activity Vocabulary
object from the URL arguments.  The following shows an example of using
the `RequestContext.getActor()` method:

~~~~ typescript
const ctx = federation.createContext(request, undefined);
const actor = await ctx.getActor(handle);  // [!code highlight]
await ctx.sendActivity(
  { handle },
  followers,
  new Update({ actor: actor.id, object: actor }),
);
~~~~

> [!NOTE]
> The `RequestContext.getActor()` method is only available when the actor
> dispatcher is registered to the `Federation` object.  If the actor dispatcher
> is not registered, the `RequestContext.getActor()` method throws an error.

In the same way, you can use the `RequestContext.getObject()` method to dispatch
an object from the URL arguments.  The following shows an example:

~~~~ typescript
const ctx = federation.createContext(request, undefined);
const note = await ctx.getObject(Note, { handle, id });  // [!code highlight]
~~~~


Getting a `DocumentLoader`
--------------------------

The `Context.documentLoader` property carries a `DocumentLoader` object that
is specified in the `Federation` constructor.  It is used to load remote
documents and contexts in the JSON-LD format.  There are a few methods to take
a `DocumentLoader` as an option in vocabulary API:

 -  [`fromJsonLd()` static method](./vocab.md#json-ld)
 -  [`toJsonLd()` method](./vocab.md#json-ld)
 -  [`get*()` dereferencing accessors](./vocab.md#object-ids-and-remote-objects)
 -  [`lookupObject()` function](./vocab.md#looking-up-remote-objects)

All of those methods take options in the form of
`{ documentLoader?: DocumentLoader, contextLoader?: DocumentLoader }` which is
compatible with `Context`.  So you can just pass a `Context` object to those
methods:

~~~~ typescript
const object = await Object.fromJsonLd(jsonLd, ctx);
const json = await object.toJsonLd(ctx);
~~~~


Getting an authenticated `DocumentLoader`
-----------------------------------------

*This API is available since Fedify 0.4.0.*

Sometimes you need to load a remote document which requires authentication,
such as an actor's following collection that is configured as private.
In such cases, you can use the `Context.getDocumentLoader()` method to get
an authenticated `DocumentLoader` object.  The following shows an example:

~~~~ typescript
const documentLoader = await ctx.getDocumentLoader({ handle: "john" });
const following = await actor.getFollowing({ documentLoader });
~~~~

In the above example, the `getFollowing()` method takes the `documentLoader`
which is authenticated as the actor with a handle of `john`.
If the `actor` allows `john` to see the following collection,
the `getFollowing()` method returns the following collection.

> [!TIP]
> Inside a personal inbox listener, the `Context.documentLoader` property is
> automatically set to an authenticated `DocumentLoader` object that is
> identified by the inbox owner's key.  So you don't need to call the
> `Context.getDocumentLoader()` method in the personal inbox listener,
> but just passing the `Context` object to dereferencing accessors is enough.
>
> See the [*`Context.documentLoader` on an inbox listener*
> section](./inbox.md#context-documentloader-on-an-inbox-listener) for details.


Document loader vs. context loader
----------------------------------

Both a document loader and a context loader are represented by `DocumentLoader`
type, but they are used for different purposes:

 -  A <dfn>document loader</dfn> is used to load remote documents,
    such as an actor's profile document, an object document, and so on.

 -  A <dfn>context loader</dfn> is used to load remote contexts,
    such as the ActivityStreams context, the W3C security context, and so on.

Sometimes a document loader needs to be authenticated to load a remote document
which requires authorization, but a context loader mostly needs to be highly
cached and doesn't require authorization.
