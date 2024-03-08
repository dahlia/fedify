---
parent: Manual
nav_order: 1
---

Federation
==========

The `Federation` object is the main entry point of the Fedify library.
It provides a set of methods to configure and run the federated server.
The key features of the `Federation` object are as follows:

 -  Registering an [actor dispatcher](./actor.md)
 -  Registering [inbox listeners](./inbox.md)
 -  Creating a `Context` object
 -  Maintaining a queue of outgoing activities

You can create a `Federation` object by calling the constructor function
with an optional configuration object:

~~~~ typescript
import { Federation } from "jsr:@fedify/fedify";

const federation = new Federation<void>({
  kv: await Deno.openKv(),
  // Omitted for brevity; see the following sections for details.
});
~~~~


Constructor parameters
----------------------

The `Federation` constructor function takes an object with the following
properties.  Some of them are required:

### `kv`

*Required.*  The `~FederationParameters.kv` property is a [`Deno.Kv`] instance
that the `Federation` object uses to store several kinds of cache data and
to maintain the queue of outgoing activities.  Usually instantiated by
calling the [`Deno.openKv()`] function.

[`Deno.Kv`]: https://deno.land/api?unstable&s=Deno.Kv
[`Deno.openKv()`]: https://deno.land/api?unstable&s=Deno.openKv

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

### `treatHttps`

Whether to treat HTTP requests as HTTPS.  This is useful for testing and
local development.  However, it must be disabled in production.
Turned off by default.


Integrating with a web framework
--------------------------------

The `Federation` object is designed to be integrated with a web framework
such as [Fresh].  By integrating, you can handle only federation-related
requests with the `Federation` object, and handle other requests with
the web framework.

Web frameworks usually provide a way to intercept requests and handle them
in the middle, which is so-called <dfn>middleware</dfn>.  If your web framework
has a middleware feature, you can use it to intercept federation-related
requests and handle them with the `Federation` object.

For example, if you use the Fresh web framework, [you can define a middleware
in a *routes/_middleware.ts* file.][fresh-middleware]  The following is an
example of how to integrate the `Federation` object with Fresh:

~~~~ typescript
import { FreshContext } from "$fresh/server.ts";
import { federation } from "../federation.ts"; // Import the `Federation` object

export async function handler(request: Request, context: FreshContext) {
  return await federation.handle(request, {
    // Wonder what is `contextData`?  See the next section for details.
    contextData: undefined,

    // If the `federation` object finds a request not responsible for it
    // (i.e., not a federation-related request), it will call the `next`
    // provided by the Fresh framework to continue the request handling
    // by the Fresh:
    onNotFound: context.next.bind(context),

    // Similar to `onNotFound`, but slightly more tricky one.
    // When the `federation` object finds a request not acceptable type-wise
    // (i.e., a user-agent doesn't want JSON-LD), it will call the `next`
    // provided by the Fresh framework so that it renders HTML if there's some
    // page.  Otherwise, it will simply return a 406 Not Acceptable response.
    // This kind of trick enables the Fedify and Fresh to share the same routes
    // and they do content negotiation depending on `Accept` header:
    async onNotAcceptable(_request: Request) {
      const response = await context.next();
      if (response.status !== 404) return response;
      return new Response("Not acceptable", {
        status: 406,
        headers: {
          "Content-Type": "text/plain",
          Vary: "Accept",
        },
      });
    },
  });
}
~~~~

In some cases, your web framework may not represent requests and responses
as [`Request`] and [`Response`] objects.  In that case, you need to convert
the request and response objects to the appropriate types that the `Federation`
object can handle.

> [!TIP]
> In theory, you can directly pass `Federation.handle()` to the [`Deno.serve()`]
> function, but you probably wouldn't want to do that because you want to handle
> other requests with the web framework.

[Fresh]: https://fresh.deno.dev/
[fresh-middleware]: https://fresh.deno.dev/docs/concepts/middleware
[`Request`]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[`Response`]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[`Deno.serve()`]: https://deno.land/api?unstable&s=Deno.serve


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
  return federation.handle(request, {
    contextData: getPool(),
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
