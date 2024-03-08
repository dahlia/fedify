---
parent: Manual
nav_order: 5
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

~~~~ typescript
import { Federation, Follow } from "jsr:@fedify/fedify";

const federation = new Federation({
  // Omitted for brevity; see the related section for details.
});

federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    const handle = ctx.getHandleFromActorUri(follow.objectId);
    if (handle == null) return;
    const recipient = await follow.getActor(ctx);
    await ctx.sendActivity(
      { handle },
      recipient,
      new Accept({ actor: follow.objectId, object: follow }),
    );
  });
~~~~

In the above example, the `~Federation.setInboxListeners()` method registers
path patterns for the personal inbox and the shared inbox, and the following
`~InboxListenerSetter.on()` method registers an inbox listener for the `Follow`
activity.  The `~InboxListenerSetter.on()` method takes a class of the activity
and a callback function that takes a `Context` object and the activity object.

Note that the `~InboxListenerSetter.on()` method can be chained to register
multiple inbox listeners for different activity types.

> [!WARNING]
> Activities of any type that are not registered with
> the `~InboxListenerSetter.on()` method are silently ignored.
> If you want to catch all types of activities anyway, add a listener
> for the `Activity` class.

> [!TIP]
> You can get a personal or shared inbox URI by calling
> the `~Context.getInboxUri()` method.  It takes an optional parameter
> `handle` to get the personal inbox URI for the actor with the bare handle.
> If the `handle` parameter is not provided, the method returns the shared
> inbox URI.

[shared inbox]: https://www.w3.org/TR/activitypub/#shared-inbox-delivery


Error handling
--------------

Since an incoming activity can be malformed or invalid, you may want to handle
such cases.  Also, your listener itself may throw an error.
The `~InboxListenerSetter.onError()` method registers a callback
function that takes a `Context` object and an error object.  The following shows
an example of handling errors:

~~~~ typescript
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
> Activities with invalid signatures are silently ignored and not passed to
> the error handler.
