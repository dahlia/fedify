---
description: >-
  Fedify provides a flexible access control system that allows you to control
  who can access your resources.  This section explains how to use the access
  control system.
prev:
  text: Object dispatcher
  link: ./object.md
next:
  text: NodeInfo
  link: ./nodeinfo.md
---

Access control
==============

*This API is available since Fedify 0.7.0.*

Fedify provides a flexible access control system that allows you to control who
can access your resources through the method named [authorized fetch], which is
popularized by Mastodon.  The method requires HTTP Signatures to be attached to
even `GET` requests, and Fedify automatically verifies the signatures and
derives the actor from the signature.

> [!NOTE]
> Although the method is popularized by Mastodon, it is not a part of the
> ActivityPub specification, and clients are not required to use the method.
> Turning this feature on may limit the compatibility with some clients.

[authorized fetch]: https://swicg.github.io/activitypub-http-signature/#authorized-fetch


Enabling authorized fetch
-------------------------

To enable authorized fetch, you need to register an `AuthorizePredicate`
callback with `ActorCallbackSetters.authorize()` or
`CollectionCallbackSetters.authorize()`, or `ObjectAuthorizePredicate` callback
with `ObjectCallbackSetters.authorize()`.  The below example shows how to enable
authorized fetch for the actor dispatcher:

~~~~ typescript{8-10}
import { federation } from "./your-federation.ts";
import { isBlocked } from "./your-blocklist.ts";

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
    // Omitted for brevity; see the related section for details.
  })
  .authorize(async (ctx, handle, signedKey, signedKeyOwner) => {
    return !isBlocked(handle, signedKeyOwner);
  });
~~~~

The equivalent method is available for collections as well:

~~~~ typescript{8-10}
import { federation } from "./your-federation.ts";
import { isBlocked } from "./your-blocklist.ts";

federation
  .setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle) => {
    // Omitted for brevity; see the related section for details.
  })
  .authorize(async (ctx, handle, signedKey, signedKeyOwner) => {
    return !isBlocked(handle, signedKeyOwner);
  });
~~~~

If the predicate returns `false`, the request is rejected with a
`401 Unauthorized` response.


Fine-grained access control
---------------------------

You may not want to block everything from an unauthorized user, but only filter
some resources.  For example, you may want to show some private posts to
a specific group of users.  In such cases, you can use the
`RequestContext.getSignedKeyOwner()` method to get the actor who signed
the request and make a decision based on the actor.

The method returns the `Actor` object who signed the request (more precisely,
the owner of the key that signed the request, if the key is associated with an
actor).  The below pseudo code shows how to filter out private posts:

~~~~ typescript{7,9}
import { federation } from "./your-federation.ts";
import { getPosts, toCreate } from "./your-model.ts";

federation
  .setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle) => {
    const posts = await getPosts(handle);  // Get posts from the database
    const keyOwner = await ctx.getSignedKeyOwner();  // Get the actor who signed the request
    const items = posts
      .filter(post => post.isVisibleTo(keyOwner))
      .map(toCreate);  // Convert model objects to ActivityStreams objects
    return { items };
  });
~~~~
