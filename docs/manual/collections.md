---
description: >-
  Fedify provides a generic way to construct and handle collections.
  This section explains how to work with collections in Fedify.
prev:
  text: Inbox listeners
  link: ./inbox.md
next:
  text: NodeInfo
  link: ./nodeinfo.md
---

Collections
===========

In ActivityPub, a [collection] is a group of objects.  For example, the
followers collection consists of the followers of an actor, and the outbox
collection consists of the activities that an actor has sent.

Fedify provides a generic way to construct and handle collections.  This
section explains how to work with collections in Fedify.

[collection]: https://www.w3.org/TR/activitypub/#collections


Outbox
------

> [!TIP]
> Since the way to construct an outbox collection is the same as the way to
> construct any other collection, the following examples are also applicable to
> constructing other collections.

First, let's see how to construct an [outbox] collection.  An outbox collection
consists of the activities that an actor has sent.  As each collection has its
own URI, the outbox collection has its own URI, too.  The URI of the outbox
collection is determined by the first parameter of
the `Federation.setOutboxDispatcher()` method:

~~~~ typescript
federation
  .setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle) => {
    // Work with the database to find the activities that the actor has sent.
    // Omitted for brevity.  See the next example for details.
  });
~~~~

Each actor has its own outbox collection, so the URI pattern of the outbox
dispatcher should include the actor's bare `{handle}`.  The URI pattern syntax
follows the [URI Template] specification.

Since the outbox is a collection of activities, the outbox dispatcher should
return an array of activities.  The following example shows how to construct
an outbox collection:

~~~~ typescript
import { Article, Create } from "@fedify/fedify";

federation
  .setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle) => {
    // Work with the database to find the activities that the actor has sent
    // (the following `getPostsByUserHandle` is a hypothetical function):
    const posts = await getPostsByUserHandle(handle);
    // Turn the posts into `Create` activities:
    const items = posts.map(post =>
      new Create({
        id: new URL(`/posts/${post.id}#activity`, ctx.url),
        actor: ctx.getActorUri(handle),
        object: new Article({
          id: new URL(`/posts/${post.id}`, ctx.url),
          summary: post.title,
          content: post.content,
        }),
      })
    );
    return { items }
  });
~~~~

If you try to access the outbox collection of an actor, the server will respond
with a JSON object that contains the activities that the actor has sent:

~~~~ http
GET /users/alice/outbox HTTP/1.1
Accept: application/activity+json
Host: localhost
~~~~

~~~~ http
HTTP/1.1 200 OK
Content-Type: application/activity+json
Vary: Accept

{
  "@context": "https://www.w3.org/ns/activitystreams",
  "items": [
    {
      "id": "http://localhost/posts/123#activity",
      "type": "Create",
      "actor": "http://localhost/users/alice",
      "object": {
        "id": "http://localhost/posts/123",
        "type": "Article",
        "summary": "Hello, world!",
        "content": "This is the first post."
      }
    },
    // More items...
  ]
}
~~~~

As you can expect, the server responds with the whole activities that the actor
has sent without any pagination.  In the real world, you should implement
pagination for the outbox collection.  In the next section, we'll see how to
implement pagination for a collection.

[outbox]: https://www.w3.org/TR/activitypub/#outbox
[URI Template]: https://datatracker.ietf.org/doc/html/rfc6570

### Page

A collection page is a subset of a collection.  For example, the first page of
the outbox collection is a collection page that contains the first few items of
the outbox collection.  Each page has its own URI which is determined by
a unique cursor, and links to the next and previous pages if they exist.
No random access is allowed for a collection page; you can only access the next
and previous pages.

Fedify abstracts the concept of a collection page as cursor-based pagination.
The cursor is a string that represents the position in the collection.  It can
be either an opaque token or an offset numeric value; the way to interpret it
is up to the server implementation.

If your database system supports cursor-based pagination ([Deno KV], for
example), you can just use the cursor that the database system provides as is.
If your database system supports only offset-based pagination (the most
relational databases), you can use the offset as the cursor.

Although it's omitted in the previous example, there is the third parameter to
a callback that `~Federation.setOutboxDispatcher()` method takes: the cursor.
When the request is for a collection page, the cursor is passed to the callback
as the third parameter.  When the request is for a whole collection, the cursor
is `null` (that the previous example assumes).

Here's an example of how to implement collection pages for the outbox collection
with assuming that the database system supports cursor-based pagination:

~~~~ typescript
federation
  .setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle, cursor) => {
    // If a whole collection is requested, returns nothing as we prefer
    // collection pages over the whole collection:
    if (cursor == null) return null;
    // Work with the database to find the activities that the actor has sent
    // (the following `getPostsByUserHandle` is a hypothetical function):
    const { posts, nextCursor, last } = await getPostsByUserHandle(handle, {
      cursor,
      limit: 10,
    });
    // Turn the posts into `Create` activities:
    const items = posts.map(post =>
      new Create({
        id: new URL(`/posts/${post.id}#activity`, ctx.url),
        actor: ctx.getActorUri(handle),
        object: new Article({
          id: new URL(`/posts/${post.id}`, ctx.url),
          summary: post.title,
          content: post.content,
        }),
      })
    );
    return {
      items,
      // If `last` is `true`, it means that the current page is the last page:
      nextCursor: last ? null : nextCursor,
    }
  });
~~~~

In the above example, the hypothetical `getPostsByUserHandle()` function returns
the `nextCursor` along with the `items`.  The `nextCursor` represents the
position of the next page, which is provided by the database system.  If the
`last` is `true`, it means that the current page is the last page, so the
`nextCursor` is `null`.

[Deno KV]: https://deno.com/kv

### First cursor

The first cursor is a special cursor that represents the beginning of the
collection.  It's used to initialize a traversal of the collection.  The first
cursor is `null` if the collection is empty.

The value for the first cursor is determined by
`~CollectionCallbackSetters.setFirstCursor()` method:

~~~~ typescript
// The number of items per page:
const window = 10;

federation
  .setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle, cursor) => {
    if (cursor == null) return null;
    // The following `getPostsByUserHandle` is a hypothetical function:
    const { posts, nextCursor, last } = await getPostsByUserHandle(
      handle,
      cursor === "" ? { limit: window } : { cursor, limit: window }
    );
    // Turn the posts into `Create` activities:
    const items = posts.map(post =>
      new Create({
        id: new URL(`/posts/${post.id}#activity`, ctx.url),
        actor: ctx.getActorUri(handle),
        object: new Article({
          id: new URL(`/posts/${post.id}`, ctx.url),
          summary: post.title,
          content: post.content,
        }),
      })
    );
    return { items, nextCursor: last ? null : nextCursor }
  })
  .setFirstCursor(async (ctx, handle) => {
    // Let's assume that an empty string represents the beginning of the
    // collection:
    return "";  // Note that it's not `null`.
  });
~~~~

In the above example, the first cursor is an empty string.  When the first
cursor is requested, the server queries the database *without any cursor* to
get the first few items of the collection.

Of course, since the first cursor is also an opaque token, you can use any
string as the first cursor.

> [!NOTE]
> The first cursor is an enabler of the pagination.  If you don't set the first
> cursor, the collection is not considered as paginated, and the server will
> respond with the whole collection without any pagination.

### Counter

As the name suggests, the counter is a callback that counts the *total* number
of items in the collection, which is useful for the client to show, for example,
the total number of articles a user has posted.

The following example shows how to implement the counter for the outbox
collection:

~~~~ typescript
federation
  .setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle, cursor) => {
    // Omitted for brevity.
  })
  .setCounter(async (ctx, handle) => {
    // The following `countPostsByUserHandle` is a hypothetical function:
    return await countPostsByUserHandle(handle);
  });
~~~~

> [!TIP]
> The counter can return either a `number` or a `bigint`.

### Last cursor

The last cursor is a special cursor that represents the end of the collection.
With the last cursor and `prevCursor`, the client can traverse the collection
backwards.

Since not all database systems support backward pagination, the last cursor is
optional.  If you don't set the last cursor, the client can only traverse the
collection forwards, which is fine in most cases.

So, the below example assumes that the database system supports offset-based
pagination, which is easy to implement backward pagination:

~~~~ typescript
// The number of items per page:
const window = 10;

federation
  .setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle, cursor) => {
    if (cursor == null) return null;
    // Here we use the offset numeric value as the cursor:
    const offset = parseInt(cursor);
    // The following `getPostsByUserHandle` is a hypothetical function:
    const posts = await getPostsByUserHandle(
      handle,
      { offset, limit: window }
    );
    // Turn the posts into `Create` activities:
    const items = posts.map(post =>
      new Create({
        id: new URL(`/posts/${post.id}#activity`, ctx.url),
        actor: ctx.getActorUri(handle),
        object: new Article({
          id: new URL(`/posts/${post.id}`, ctx.url),
          summary: post.title,
          content: post.content,
        }),
      })
    );
    return { items, nextCursor: (offset + window).toString() }
  })
  .setFirstCursor(async (ctx, handle) => "0")
  .setLastCursor(async (ctx, handle) => {
    // The following `countPostsByUserHandle` is a hypothetical function:
    const total = await countPostsByUserHandle(handle);
    // The last cursor is the offset of the last page:
    return (total - (total % window)).toString();
  });
~~~~


Following
---------

The following collection consists of the actors that an actor is following.
The following collection is similar to the outbox collection, but it's a
collection of actors instead of activities.  More specifically, the following
collection can consist of `Actor` objects or `URL` objects that represent the
actors.

Cursors and counters for the following collection are implemented in the same
way as the outbox collection, so we don't repeat the explanation here.

The below example shows how to construct a following collection:

~~~~ typescript
federation
  .setFollowingDispatcher("/users/{handle}/following", async (ctx, handle, cursor) => {
    // If a whole collection is requested, returns nothing as we prefer
    // collection pages over the whole collection:
    if (cursor == null) return null;
    // Work with the database to find the actors that the actor is following
    // (the below `getFollowingByUserHandle` is a hypothetical function):
    const { users, nextCursor, last } = await getFollowingByUserHandle(
      handle,
      cursor === "" ? { limit: 10 } : { cursor, limit: 10 }
    );
    // Turn the users into `URL` objects:
    const items = users.map(actor => actor.uri);
    return { items, nextCursor: last ? null : nextCursor }
  })
  // The first cursor is an empty string:
  .setFirstCursor(async (ctx, handle) => "");
~~~~


Followers
---------

The followers collection is very similar to the following collection, but it's
a collection of actors that are following the actor.  The followers collection
also can consist of `Actor` objects or `URL` objects that represent the actors.

The below example shows how to construct a followers collection:

~~~~ typescript
federation
  .setFollowersDispatcher("/users/{handle}/followers", async (ctx, handle, cursor) => {
    // If a whole collection is requested, returns nothing as we prefer
    // collection pages over the whole collection:
    if (cursor == null) return null;
    // Work with the database to find the actors that are following the actor
    // (the below `getFollowersByUserHandle` is a hypothetical function):
    const { users, nextCursor, last } = await getFollowersByUserHandle(
      handle,
      cursor === "" ? { limit: 10 } : { cursor, limit: 10 }
    );
    // Turn the users into `URL` objects:
    const items = users.map(actor => actor.uri);
    return { items, nextCursor: last ? null : nextCursor }
  })
  // The first cursor is an empty string:
  .setFirstCursor(async (ctx, handle) => "");
~~~~
