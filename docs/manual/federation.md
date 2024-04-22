---
description: >-
  The Federation object is the main entry point of the Fedify library.
  This section explains the key features of the Federation object.
prev:
  text: Manual
  link: ../manual.md
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

You can create a `Federation` object by calling the constructor function
with an optional configuration object:

~~~~ typescript
import { Federation, MemoryKvStore } from "@fedify/fedify";

const federation = new Federation<void>({
  kv: new MemoryKvStore(),
  // Omitted for brevity; see the following sections for details.
});
~~~~


Constructor parameters
----------------------

The `Federation` constructor function takes an object with the following
properties.  Some of them are required:

### `kv`

*Required.*  The `~FederationParameters.kv` property is a `KvStore` instance
that the `Federation` object uses to store several kinds of cache data and
to maintain the queue of outgoing activities.

`KvStore` is an abstract interface that represents a key-value store.
Currently, there are two implementations of `KvStore`, which are the
`MemoryKvStore` and `DenoKvStore` classes.  The `MemoryKvStore` class is for
testing and development purposes, and the `DenoKvStore` class is Deno KV-backed
implementation for production use (as you can guess from the name, it is only
available in Deno runtime).  However, you can define your own `KvStore`
implementation if you want to use a different key-value store.[^1]

[^1]: We are welcome to contributions of `KvStore` implementations for other
      key-value stores.

### `kvPrefixes`

The `~FederationParameters.kvPrefixes` property is an object that contains
the key prefixes for the cache data.  The following are the key prefixes
that the `Federation` object uses:

`~FederationKvPrefixes.activityIdempotence`
:   The key prefix used for storing whether activities have already been
    processed or not.  `["_fedify", "activityIdempotence"]` by default.

`~FederationKvPrefixes.remoteDocument`
:   The key prefix used for storing remote JSON-LD documents.
    `["_fedify", "remoteDocument"]` by default.

### `queue`

The `~FederationParameters.queue` property is a `MessageQueue` instance that
the `Federation` object uses to maintain the queue of outgoing activities.
If you don't provide this option, activities will not be queued and will
be sent immediately.

`MessageQueue` is an abstract interface that represents a message queue.
Currently, there are only two implementations of `MessageQueue`, which are
the `InProcessMessageQueue` and `DenoKvMessageQueue` classes.
The `InProcessMessageQueue` class is for testing and development purposes,
and the `DenoKvMessageQueue` class is a Deno KV-backed implementation for
production use (as you can guess from the name, it is only available in Deno
runtime).  However, you can define your own `MessageQueue` implementation if
you want to use a different message queue.[^1]

> [!IMPORTANT]
> While the `queue` option is optional, it is highly recommended to provide
> a message queue implementation in production environments.  If you don't
> provide a message queue implementation, activities will not be queued and
> will be sent immediately.  This can make delivery of activities unreliable
> and can cause performance issues.

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

### `treatHttps`

Whether to treat HTTP requests as HTTPS.  This affects how URLs are generated
as well.  According to the [*Object Identifiers* section][1] in the ActivityPub
specification, the public dereferenceable URIs should use HTTPS URIs, so this
option is useful for testing and local development, which is normally done
over HTTP.

However, it should be disabled in production.  Turned off by default.

> [!TIP]
> This option is usually used together with tunneling services like [ngrok]
> in testing and local development.  See also the [*Exposing a local server
> to the public* section](./test.md#exposing-a-local-server-to-the-public).

[1]: https://www.w3.org/TR/activitypub/#obj-id
[ngrok]: https://ngrok.com/


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
