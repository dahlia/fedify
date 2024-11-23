---
description: >-
  The Federation object is the main entry point of the Fedify library.
  This section explains the key features of the Federation object.
---

# Federation

> [!TIP]
>
> This tutorial is also available in the following languages: [한국어] (Korean).

The `Federation` object is the main entry point of the Fedify library.
It provides a set of methods to configure and run the federated server.
The key features of the `Federation` object are as follows:

- Registering an [actor dispatcher](./actor.md)
- Registering [inbox listeners](./inbox.md)
- Registering [collections](./collections.md)
- Registering [object dispatchers](./object.md)
- Creating a `Context` object
- Maintaining a queue of [outgoing activities](./send.md)
- Registering a [NodeInfo dispatcher](./nodeinfo.md)

You can create a `Federation` object by calling `createFederation()` function
with a configuration object:

```typescript twoslash
import { createFederation, MemoryKvStore } from '@fedify/fedify';

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
  // Omitted for brevity; see the following sections for details.
});
```

[한국어]: https://hackmd.io/loX34fmjTxqKfdIL-1PM3A

## Constructor parameters

The `createFederation()` function takes an object with the following
properties. Some of them are required:

### `kv`

_Required._ The `~CreateFederationOptions.kv` property is a `KvStore` instance
that the `Federation` object uses to store several kinds of cache data and
to maintain the queue of outgoing activities.

`KvStore` is an abstract interface that represents a key-value store.
For now, Fedify provides two built-in implementations of `KvStore`, which are
`MemoryKvStore` and `DenoKvStore` classes. The `MemoryKvStore` class is for
testing and development purposes, and the `DenoKvStore` class is Deno KV-backed
implementation for production use (as you can guess from the name, it is only
available in Deno runtime).

As separate packages, [@fedify/redis] provides [`RedisKvStore`] class, which is
a Redis-backed implementation for production use, and [@fedify/postgres]
provides [`PostgresKvStore`] class, which is a PostgreSQL-backed implementation
for production use.

Further details are explained in the [_Key–value store_ section](./kv.md).

[@fedify/redis]: https://github.com/dahlia/fedify-redis
[`RedisKvStore`]: https://jsr.io/@fedify/redis/doc/kv/~/RedisKvStore
[@fedify/postgres]: https://github.com/dahlia/fedify-postgres
[`PostgresKvStore`]: https://jsr.io/@fedify/postgres/doc/kv/~/PostgresKvStore

### `kvPrefixes`

The `~CreateFederationOptions.kvPrefixes` property is an object that contains
the key prefixes for the cache data. The following are the key prefixes
that the `Federation` object uses:

`~FederationKvPrefixes.activityIdempotence`
: The key prefix used for storing whether activities have already been
processed or not. `["_fedify", "activityIdempotence"]` by default.

`~FederationKvPrefixes.remoteDocument`
: The key prefix used for storing remote JSON-LD documents.
`["_fedify", "remoteDocument"]` by default.

`~FederationKvPrefixes.publicKey`
: _This API is available since Fedify 0.12.0._

    The key prefix used for caching public keys.  `["_fedify", "publicKey"]`
    by default.

### `queue`

_This API is available since Fedify 0.5.0._

The `~CreateFederationOptions.queue` property is a `MessageQueue` instance that
the `Federation` object uses to maintain the queue of incoming and outgoing
activities. If you don't provide this option, activities will not be queued
and will be processed immediately.

`MessageQueue` is an abstract interface that represents a message queue.
For now, Fedify provides two built-in implementations of `MessageQueue`, which
are `InProcessMessageQueue` and `DenoKvMessageQueue` classes.
The `InProcessMessageQueue` class is for testing and development purposes,
and the `DenoKvMessageQueue` class is a Deno KV-backed implementation for
production use (as you can guess from the name, it is only available in Deno
runtime).

As separate packages, [@fedify/redis] provides [`RedisMessageQueue`] class,
which is a Redis-backed implementation for production use,
and [@fedify/postgres] provides [`PostgresMessageQueue`] class, which is a
PostgreSQL-backed implementation for production use, and [@fedify/amqp] provides
[`AmqpMessageQueue`] class, which is an AMQP broker-backed implementation for
production use.

Further details are explained in the [_Message queue_ section](./mq.md).

> [!IMPORTANT]
> While the `queue` option is optional, it is highly recommended to provide
> a message queue implementation in production environments. If you don't
> provide a message queue implementation, activities will not be queued and
> will be sent immediately. This can make delivery of activities unreliable
> and can cause performance issues.

> [!TIP]
> Since Fedify 1.3.0, you can separately configure the message queue for
> incoming and outgoing activities by providing an object with `inbox` and
> `outbox` properties:
>
> ```typescript twoslash
> import {
>   createFederation,
>   type KvStore,
>   MemoryKvStore,
>   type MessageQueue,
> } from '@fedify/fedify';
> import { PostgresMessageQueue } from '@fedify/postgres';
> import { RedisMessageQueue } from '@fedify/redis';
> import postgres from 'postgres';
> import Redis from 'ioredis';
>
> createFederation<void>({
>   kv: null as unknown as KvStore,
>   // ---cut-before---
>   queue: {
>     inbox: new PostgresMessageQueue(
>       postgres('postgresql://user:pass@localhost/db')
>     ),
>     outbox: new RedisMessageQueue(() => new Redis()),
>   },
>   // ---cut-after---
> });
> ```
>
> Or, you can provide a message queue for only the `inbox` or `outbox` by
> omitting the other:
>
> ```typescript twoslash
> import {
>   createFederation,
>   type KvStore,
>   MemoryKvStore,
>   type MessageQueue,
> } from '@fedify/fedify';
> import { PostgresMessageQueue } from '@fedify/postgres';
> import postgres from 'postgres';
>
> createFederation<void>({
>   kv: null as unknown as KvStore,
>   // ---cut-before---
>   queue: {
>     inbox: new PostgresMessageQueue(
>       postgres('postgresql://user:pass@localhost/db')
>     ),
>     // outbox is not provided; outgoing activities will not be queued.
>   },
>   // ---cut-after---
> });
> ```

[`RedisMessageQueue`]: https://jsr.io/@fedify/redis/doc/mq/~/RedisMessageQueue
[`PostgresMessageQueue`]: https://jsr.io/@fedify/postgres/doc/mq/~/PostgresMessageQueue
[@fedify/amqp]: https://github.com/dahlia/fedify-amqp
[`AmqpMessageQueue`]: https://jsr.io/@fedify/amqp/doc/mq/~/AmqpMessageQueue

### `manuallyStartQueue`

_This API is available since Fedify 0.12.0._

Whether to start the task queue manually or automatically.

If `true`, the task queue will not start automatically and you need to
manually start it by calling the `Federation.startQueue()` method.

If `false`, the task queue will start automatically as soon as the first
task is enqueued.

By default, the queue starts automatically.

> [!TIP]
> This option is useful when you want to separately deploy the web server
> and the task queue worker. In this case, you can start the task queue
> in the worker process, and the web server process doesn't start the task
> queue, but only enqueues tasks. Of course, in this case, you need to
> provide a `MessageQueue` backend that can be shared between the web server
> and the worker process (e.g., a Redis-backed message queue) as
> the [`queue`](#queue) option.

### `documentLoader`

A JSON-LD document loader function that the `Federation` object uses to
load remote JSON-LD documents. The function takes a URL and returns a
promise that resolves to a `RemoteDocument`.

Usually, you don't need to set this property because the default document
loader function is sufficient for most cases. The default document loader
caches the loaded documents in the key-value store.

See the
[_Getting a `DocumentLoader`_ section](./context.md#getting-a-documentloader)
for details.

### `authenticatedDocumentLoaderFactory`

_This API is available since Fedify 0.4.0._

A factory function that creates an authenticated document loader function.
The factory function takes the key pair of an actor and returns a document
loader function that loads remote JSON-LD documents as the actor.

Usually, you don't need to set this property because the default document
loader factory is sufficient for most cases. The default document loader
factory intentionally doesn't cache the loaded documents in the key-value
store.

See the [_Getting an authenticated `DocumentLoader`_
section](./context.md#getting-an-authenticated-documentloader) for details.

### `contextLoader`

_This API is available since Fedify 0.8.0._

A JSON-LD context loader function that the `Federation` object uses to
load remote JSON-LD contexts. The type of the function is the same as the
`documentLoader` function, but their purposes are different (see also
[_Document loader vs. context loader_
section](./context.md#document-loader-vs-context-loader)).

### `allowPrivateAddress`

_This API is available since Fedify 0.15.0._

> [!WARNING]
> Do not turn on this option in production environments. Disallowing fetching
> private network addresses is a security feature to prevent [SSRF] attacks.

Whether to allow fetching private network addresses in the document loader.

If turned on, [`documentLoader`](#documentloader),
[`contextLoader`](#contextloader),
and [`authenticatedDocumentLoaderFactory`](#authenticateddocumentloaderfactory)
cannot be configured.

Mostly useful for testing purposes.

Turned off by default.

[SSRF]: https://owasp.org/www-community/attacks/Server_Side_Request_Forgery

### `userAgent`

_This API is available since Fedify 1.3.0._

The options for making `User-Agent` header in the HTTP requests that Fedify
makes. By default, it contains the name and version of the Fedify library,
and the name and version of the JavaScript runtime, e.g.:

```
Fedify/1.3.0 (Deno/2.0.4)
Fedify/1.3.0 (Node.js/v22.10.0)
Fedify/1.3.0 (Bun/1.1.33)
```

You can customize the `User-Agent` header by providing options like `software`
and `url`. For example, if you provide the following options:

```ts
{
  software: "MyApp/1.0.0",
  url: "https://myinstance.com/"
}
```

The `User-Agent` header will be like:

```
MyApp/1.0.0 (Fedify/1.3.0; Deno/2.0.4; +https://myinstance.com/)
```

Or, you can rather provide a custom `User-Agent` string directly instead of
an object for options.

> [!CAUTION]
>
> This settings do not affect the `User-Agent` header of the HTTP requests
> that `lookupWebFinger()`, `lookupObject()`, and `getNodeInfo()` functions make,
> since they do not depend on the `Federation` object.
>
> However, `Context.lookupObject()` method is affected by this settings.

### `outboxRetryPolicy`

_This API is available since Fedify 0.12.0._

The retry policy for sending activities to recipients' inboxes.

By default, this uses an exponential backoff strategy with a maximum of 10
attempts and a maximum delay of 12 hours.

You can fully customize the retry policy by providing a custom function that
satisfies the `RetryPolicy` type. Or you can adjust the parameters of
the `createExponentialBackoffRetryPolicy()` function, which is a default
implementation of the retry policy.

### `inboxRetryPolicy`

_This API is available since Fedify 0.12.0._

The retry policy for processing incoming activities.

By default, this uses an exponential backoff strategy with a maximum of 10
attempts and a maximum delay of 12 hours.

In the same way as the `outboxRetryPolicy` option, you can fully customize
the retry policy by providing a custom function that satisfies the `RetryPolicy`
type. Or you can adjust the parameters of the built-in
`createExponentialBackoffRetryPolicy()` function.

### `trailingSlashInsensitive`

_This API is available since Fedify 0.12.0._

Whether the router should be insensitive to trailing slashes in the URL paths.
For example, if this option is `true`, `/foo` and `/foo/` are treated as the
same path.

Turned off by default.

## The `~Federation.fetch()` API

_This API is available since Fedify 0.6.0._

The `Federation` object provides the `~Federation.fetch()` method to handle
incoming HTTP requests. The `~Federation.fetch()` method takes an incoming
[`Request`] and returns a [`Response`].

Actually, this interface is de facto standard in the server-side JavaScript
world, and it is inspired by the [`window.fetch()`] method in the browser
environment.

Therefore, you can pass it to the [`Deno.serve()`] function in [Deno], and
the [`Bun.serve()`] function in [Bun]:

::: code-group

```typescript twoslash [Deno]
import { type Federation } from '@fedify/fedify';
const federation = null as unknown as Federation<void>;
const request = new Request('');
// ---cut-before---
Deno.serve((request) => federation.fetch(request, { contextData: undefined }));
```

```typescript twoslash [Bun]
import '@types/bun';
import { type Federation } from '@fedify/fedify';
const federation = null as unknown as Federation<void>;
const request = new Request('');
// ---cut-before---
Bun.serve({
  fetch: (request) => federation.fetch(request, { contextData: undefined }),
});
```

:::

However, in case of [Node.js], it has no built-in server API that takes
`fetch()` callback function like Deno or Bun. Instead, you need to use
[@hono/node-server] package to adapt the `~Federation.fetch()` method to
the Node.js' HTTP server API:

::: code-group

```sh [Node.js]
npm add @hono/node-server
```

:::

And then, you can use the [`serve()`] function from the package:

::: code-group

```typescript twoslash [Node.js]
import { type Federation } from '@fedify/fedify';
const federation = null as unknown as Federation<void>;
const request = new Request('');
// ---cut-before---
import { serve } from '@hono/node-server';

serve({
  fetch: (request) => federation.fetch(request, { contextData: undefined }),
});
```

:::

> [!NOTE]
>
> Although a `Federation` object can be directly passed to the HTTP server
> APIs, you would usually integrate it with a web framework. For details,
> see the [_Integration_ section](./integration.md).

[`Request`]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[`Response`]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[`window.fetch()`]: https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch
[`Deno.serve()`]: https://docs.deno.com/api/deno/~/Deno.serve
[Deno]: http://deno.com/
[`Bun.serve()`]: https://bun.sh/docs/api/http#bun-serve
[Bun]: https://bun.sh/
[Node.js]: https://nodejs.org/
[@hono/node-server]: https://github.com/honojs/node-server
[`serve()`]: https://github.com/honojs/node-server?tab=readme-ov-file#usage

## How the `Federation` object recognizes the domain name

The `Federation` object recognizes the domain name of the server by
the [`Host`] header of the incoming HTTP requests. The `Host` header is
a standard HTTP header that contains the domain name of the server.

However, the `Host` header is not always reliable because it can be
bypassed by a reverse proxy or a load balancer. If you use a reverse
proxy or a load balancer, you should configure it to pass the original
`Host` header to the server.

Or you can make the `Federation` object recognize the domain name by looking
at the [`X-Forwarded-Host`] header instead of the `Host` header using
the [x-forwarded-fetch] middleware. To use the `x-forwarded-fetch` middleware,
install the package:

::: code-group

```sh [Deno]
deno add jsr:@hongminhee/x-forwarded-fetch
```

```sh [Node.js]
npm install x-forwarded-fetch
```

```sh [Bun]
bun add x-forwarded-fetch
```

:::

Then, import the package and place the `behindProxy()` middleware in front of
the `Federation.fetch()` method:

::: code-group

```typescript{1,4} twoslash [Deno]
// @noErrors: 2300 2307
import { behindProxy } from "x-forwarded-fetch";
import { type Federation } from "@fedify/fedify";
const federation = null as unknown as Federation<void>;
// ---cut-before---
import { behindProxy } from "@hongminhee/x-forwarded-fetch";

Deno.serve(
  behindProxy(request => federation.fetch(request, { contextData: undefined }))
);
```

```typescript{2,5} twoslash [Node.js]
import { type Federation } from "@fedify/fedify";
const federation = null as unknown as Federation<void>;
// ---cut-before---
import { serve } from "@hono/node-server";
import { behindProxy } from "x-forwarded-fetch";

serve({
  fetch: behindProxy((request) => federation.fetch(request, { contextData: undefined })),
});
```

```typescript{1,4} twoslash [Bun]
import "@types/bun";
import { type Federation } from "@fedify/fedify";
const federation = null as unknown as Federation<void>;
// ---cut-before---
import { behindProxy } from "x-forwarded-fetch";

Bun.serve({
  fetch: behindProxy((request) => federation.fetch(request, { contextData: undefined })),
});
```

:::

> [!TIP]
> When your `Federation` object is integrated with a web framework, you should
> place the `behindProxy()` middleware in front of the framework's `fetch()`
> method, not the `Federation.fetch()` method.

[`Host`]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host
[`X-Forwarded-Host`]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host
[x-forwarded-fetch]: https://github.com/dahlia/x-forwarded-fetch

## Integrating with web frameworks

`Federation` is designed to be used together with web frameworks. For details,
see the [_Integration_ section](./integration.md).

## `TContextData`

The `Federation` class is a generic class that takes a type parameter named
`TContextData`. The `TContextData` type is the type of the context data,
which is shared among the actor dispatcher, inbox listener, and other
callback functions. The `TContextData` type can be `void` if you don't
need to share any context data, but it can be any type if you need to share
context data.

For example, if you want to share a database connection among the actor
dispatcher, inbox listener, and other callback functions, you can set the
`TContextData` type to the type of the database connection:

```typescript
import { FreshContext } from '$fresh/server.ts';
import { federation } from '../federation.ts'; // Import the `Federation` object
import { DatabasePool, getPool } from './database.ts';

export async function handler(request: Request, context: FreshContext) {
  return federation.fetch(request, {
    contextData: getPool(), // [!code highlight]
    onNotFound: context.next.bind(context),
    onNotAcceptable: async (request: Request) => {
      // Omitted for brevity
    },
  });
}
```

The `Context.data` is passed to registered callback functions as their first
parameter within the `Context` object:

```typescript twoslash
// @noErrors: 2345
import { type Federation } from '@fedify/fedify';
const federation = null as unknown as Federation<void>;
// ---cut-before---
federation.setActorDispatcher('/users/{handle}', async (ctx, handle) => {
  // There is a database connection in `ctx.data`.
});
```

Another example is to determine the virtual host of the server based on the
incoming HTTP request. See the [next section](#virtual-hosting) for details.

## Virtual hosting

_This API is available since Fedify 0.12.0._

You may want to support multiple domains on the same server, so-called
_virtual hosts_. To determine the virtual host of the server based on the
incoming HTTP request, you can use `Context.host` that contains
the virtual host information:

```typescript{2} twoslash
// @noErrors: 2345
import { type Federation } from "@fedify/fedify";
const federation = null as unknown as Federation<void>;
// ---cut-before---
federation.setActorDispatcher("/@{handle}", (ctx, handle) => {
  const fullHandle = `${handle}@${ctx.host}`;
  // Omitted for brevity
});
```

You can access the virtual host information in the actor dispatcher,
inbox listener, and other callback functions.

See also the [_Getting the base URL_ section](./context.md#getting-the-base-url)
in the _Context_ document.
