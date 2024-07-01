---
description: >-
  The Federation object is the main entry point of the Fedify library.
  This section explains the key features of the Federation object.
next:
  text: Context
  link: ./context.md
---

Federation
==========

The `Federation` object is the main entry point of the Fedify library.
It provides a set of methods to configure and run the federated server.
The key features of the `Federation` object are as follows:

 -  Registering an [actor dispatcher](./actor.md)
 -  Registering [inbox listeners](./inbox.md)
 -  Registering [collections](./collections.md)
 -  Registering [object dispatchers](./object.md)
 -  Creating a `Context` object
 -  Maintaining a queue of [outgoing activities](./send.md)
 -  Registering a [NodeInfo dispatcher](./nodeinfo.md)

You can create a `Federation` object by calling `createFederation()` function
with a configuration object:

~~~~ typescript
import { createFederation, MemoryKvStore } from "@fedify/fedify";

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
  // Omitted for brevity; see the following sections for details.
});
~~~~


Constructor parameters
----------------------

The `Federation` constructor function takes an object with the following
properties.  Some of them are required:

### `kv`

*Required.*  The `~FederationOptions.kv` property is a `KvStore` instance
that the `Federation` object uses to store several kinds of cache data and
to maintain the queue of outgoing activities.

`KvStore` is an abstract interface that represents a key-value store.
For now, Fedify provides two built-in implementations of `KvStore`, which are
`MemoryKvStore` and `DenoKvStore` classes.  The `MemoryKvStore` class is for
testing and development purposes, and the `DenoKvStore` class is Deno KV-backed
implementation for production use (as you can guess from the name, it is only
available in Deno runtime).

As a separate package, [@fedify/redis] provides [`RedisKvStore`] class, which is
a Redis-backed implementation for production use.

You can define your own `KvStore` implementation if you want to use a different
key-value store.[^1]

[^1]: We are welcome to contributions of `KvStore` implementations for other
      key-value stores.

[@fedify/redis]: https://github.com/dahlia/fedify-redis
[`RedisKvStore`]: https://jsr.io/@fedify/redis/doc/kv/~/RedisKvStore

### `kvPrefixes`

The `~FederationOptions.kvPrefixes` property is an object that contains
the key prefixes for the cache data.  The following are the key prefixes
that the `Federation` object uses:

`~FederationKvPrefixes.activityIdempotence`
:   The key prefix used for storing whether activities have already been
    processed or not.  `["_fedify", "activityIdempotence"]` by default.

`~FederationKvPrefixes.remoteDocument`
:   The key prefix used for storing remote JSON-LD documents.
    `["_fedify", "remoteDocument"]` by default.

### `queue`

*This API is available since Fedify 0.5.0.*

The `~FederationOptions.queue` property is a `MessageQueue` instance that
the `Federation` object uses to maintain the queue of incoming and outgoing
activities.  If you don't provide this option, activities will not be queued
and will be processed immediately.

`MessageQueue` is an abstract interface that represents a message queue.
For now, Fedify provides two built-in implementations of `MessageQueue`, which
are `InProcessMessageQueue` and `DenoKvMessageQueue` classes.
The `InProcessMessageQueue` class is for testing and development purposes,
and the `DenoKvMessageQueue` class is a Deno KV-backed implementation for
production use (as you can guess from the name, it is only available in Deno
runtime).

As a separate package, [@fedify/redis] provides [`RedisMessageQueue`] class,
which is a Redis-backed implementation for production use.

You can define your own `MessageQueue` implementation if you want to use
a different message queue.[^1]

> [!IMPORTANT]
> While the `queue` option is optional, it is highly recommended to provide
> a message queue implementation in production environments.  If you don't
> provide a message queue implementation, activities will not be queued and
> will be sent immediately.  This can make delivery of activities unreliable
> and can cause performance issues.

[`RedisMessageQueue`]: https://jsr.io/@fedify/redis/doc/mq/~/RedisMessageQueue

### `documentLoader`

A JSON-LD document loader function that the `Federation` object uses to
load remote JSON-LD documents.  The function takes a URL and returns a
promise that resolves to a `RemoteDocument`.

Usually, you don't need to set this property because the default document
loader function is sufficient for most cases.  The default document loader
caches the loaded documents in the key-value store.

See the
[*Getting a `DocumentLoader`* section](./context.md#getting-a-documentloader)
for details.

### `authenticatedDocumentLoaderFactory`

*This API is available since Fedify 0.4.0.*

A factory function that creates an authenticated document loader function.
The factory function takes the key pair of an actor and returns a document
loader function that loads remote JSON-LD documents as the actor.

Usually, you don't need to set this property because the default document
loader factory is sufficient for most cases.  The default document loader
factory intentionally doesn't cache the loaded documents in the key-value
store.

See the [*Getting an authenticated `DocumentLoader`*
section](./context.md#getting-an-authenticated-documentloader) for details.

### `contextLoader`

*This API is available since Fedify 0.8.0.*

A JSON-LD context loader function that the `Federation` object uses to
load remote JSON-LD contexts.  The type of the function is the same as the
`documentLoader` function, but their purposes are different (see also
[*Document loader vs. context loader*
section](./context.md#document-loader-vs-context-loader)).


How the `Federation` object recognizes the domain name
------------------------------------------------------

The `Federation` object recognizes the domain name of the server by
the [`Host`] header of the incoming HTTP requests.  The `Host` header is
a standard HTTP header that contains the domain name of the server.

However, the `Host` header is not always reliable because it can be
bypassed by a reverse proxy or a load balancer.  If you use a reverse
proxy or a load balancer, you should configure it to pass the original
`Host` header to the server.

Or you can make the `Federation` object recognize the domain name by looking
at the [`X-Forwarded-Host`] header instead of the `Host` header using
the [x-forwarded-fetch] middleware.  To use the `x-forwarded-fetch` middleware,
install the package:

::: code-group

~~~~ sh [Deno]
deno add @hongminhee/x-forwarded-fetch
~~~~

~~~~ sh [Node.js]
npm install x-forwarded-fetch
~~~~

~~~~ sh [Bun]
bun add x-forwarded-fetch
~~~~

:::

Then, import the package and place the `behindProxy()` middleware in front of
the `Federation.fetch()` method:

::: code-group

~~~~ typescript{1,4} [Deno]
import { behindProxy } from "@hongminhee/x-forwarded-fetch";

Deno.serve(
  behindProxy(request => federation.fetch(request, { contextData: undefined }))
);
~~~~

~~~~ typescript{2,5} [Node.js]
import { serve } from "@hono/node-server";
import { behindProxy } from "x-forwarded-fetch";

serve({
  fetch: behindProxy((request) => federation.fetch(request, { contextData: undefined }),
});
~~~~

~~~~ typescript{1,4} [Bun]
import { behindProxy } from "x-forwarded-fetch";

Bun.serve({
  fetch: behindProxy((request) => federation.fetch(request, { contextData: undefined })),
});
~~~~

:::

> [!TIP]
> When your `Federation` object is integrated with a web framework, you should
> place the `behindProxy()` middleware in front of the framework's `fetch()`
> method, not the `Federation.fetch()` method.

[`Host`]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host
[`X-Forwarded-Host`]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host
[x-forwarded-fetch]: https://github.com/dahlia/x-forwarded-fetch


Integrating with web frameworks
-------------------------------

`Federation` is designed to be used together with web frameworks.  For details,
see the [*Integration* section](./integration.md).


`TContextData`
--------------

The `Federation` class is a generic class that takes a type parameter named
`TContextData`.  The `TContextData` type is the type of the context data,
which is shared among the actor dispatcher, inbox listener, and other
callback functions.  The `TContextData` type can be `void` if you don't
need to share any context data, but it can be any type if you need to share
context data.

For example, if you want to share a database connection among the actor
dispatcher, inbox listener, and other callback functions, you can set the
`TContextData` type to the type of the database connection:

~~~~ typescript
import { FreshContext } from "$fresh/server.ts";
import { federation } from "../federation.ts"; // Import the `Federation` object
import { DatabasePool, getPool } from "./database.ts";

export async function handler(request: Request, context: FreshContext) {
  return federation.fetch(request, {
    contextData: getPool(),  // [!code highlight]
    onNotFound: context.next.bind(context),
    onNotAcceptable: async (request: Request) => {
      // Omitted for brevity
    }
  });
};
~~~~

The `Context.data` is passed to registered callback functions as their first
parameter within the `Context` object:

~~~~ typescript
federation.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
  // There is a database connection in `ctx.data`.
});
~~~~

Another example is to determine the virtual host of the server based on the
incoming HTTP request.  See the [next section](#virtual-hosting) for details.


Virtual hosting
---------------

*This API is available since Fedify 0.12.0.*

You may want to support multiple domains on the same server, so-called
*virtual hosts*.  To determine the virtual host of the server based on the
incoming HTTP request, you can use `Context.host` that contains
the virtual host information:

~~~~ typescript{2}
federation.setActorDispatcher("/@{handle}", (ctx, handle) => {
  const fullHandle = `${handle}@${ctx.host}`;
  // Omitted for brevity
});
~~~~

You can access the virtual host information in the actor dispatcher,
inbox listener, and other callback functions.

See also the [*Getting the base URL* section](./context.md#getting-the-base-url)
in the *Context* document.
