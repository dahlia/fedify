---
description: >-
  This tutorial provides a step-by-step guide to building a small federated
  server with the Fedify framework.  It is intended for developers who want
  to build a federated server with the Fedify framework.
prev:
  text: Installation
  link: ./install.md
---

Tutorial
========

In this tutorial, we will build a small federated server that can only accept
follow requests.  Despite its simplicity, it will cover the key features of the
ActivityPub protocol and the Fedify framework, such as actors, sending and
receiving activities, and the inbox.

As prerequisite knowledge, you should have a basic understanding of
JavaScript, command-line interfaces, and minimum experience with building
web server apps.  However, it's perfectly fine if you're not familiar with
the ActivityPub protocol or TypeScript; we will explain them as we go.


What we will build
------------------

We will build a small federated server which can accept follow requests from
other servers.  The server will have a single actor (i.e., account) and an inbox
to receive follow requests.  When the server receives a follow request, it will
send an accept activity back to the sender.  The home page of the server will
list the actor's followers.


Creating a new project
----------------------

> [!TIP]
> We recommend using [Deno] or [Bun] (which are TypeScript-first) for the best
> experience, but you can use [Node.js] if you prefer.

Let's create a new project directory and initialize a new project:

::: code-group

~~~~ sh [Deno]
mkdir follow-server
cd follow-server/
echo '{ "unstable": ["kv", "temporal"] }' > deno.json
deno add @fedify/fedify
~~~~

~~~~ sh [Node.js]
mkdir follow-server
cd follow-server/
echo '{ "type": "module" }' > package.json
npm add -D typescript tsx @types/node
npm add @deno/kv @fedify/fedify @hono/node-server
~~~~

~~~~ sh [Bun]
mkdir follow-server
cd follow-server/
bun add @deno/kv @fedify/fedify
~~~~

:::

The above commands will create a *deno.json* (in case of Deno) or *package.json*
(in case of Node.js or Bun) in the project directory with the following content
(formatted for readability):[^2]

::: code-group

~~~~ json [Deno]
{
  "unstable": ["kv", "temporal"],
  "imports": {
    "@fedify/fedify": "jsr:@fedify/fedify@^0.11.0"
  }
}
~~~~

~~~ json [Node.js]
{
  "type": "module",
  "devDependencies": {
    "@types/node": "^20.12.7",
    "tsx": "^4.8.2",
    "typescript": "^5.4.5"
  },
  "dependencies": {
    "@fedify/fedify": "^0.11.0",
    "@hono/node-server": "^1.11.1"
  }
}
~~~

~~~ json [Bun]
{
  "dependencies": {
    "@deno/kv": "^0.8.0",
    "@fedify/fedify": "^0.11.0"
  }
}
~~~

:::

[^2]: The actual version number may vary depending on the latest version of the
      Fedify framework as of reading this tutorial.

[Deno]: https://deno.com/
[Bun]: https://bun.sh/
[Node.js]: https://nodejs.org/


Creating the server
-------------------

Now, let's create the server script.  Create a new file named *server.ts* in the
project directory and write the following code:

::: code-group

~~~~ typescript [Deno]
Deno.serve(request =>
  new Response("Hello, world", {
    headers: { "Content-Type": "text/plain" }
  })
);
~~~~

~~~~ typescript [Node.js]
import { serve } from "@hono/node-server";

serve({
  port: 8000,
  fetch(request) {
    return new Response("Hello, world", {
      headers: { "Content-Type": "text/plain" }
    });
  }
});
~~~~

~~~~ typescript [Bun]
Bun.serve({
  port: 8000,
  fetch(request) {
    return new Response("Hello, world", {
      headers: { "Content-Type": "text/plain" }
    });
  }
});
~~~~

:::

It's a simple HTTP server that responds with <q>Hello, world</q> to any incoming
request.  You can run the server by executing the following command:

::: code-group

~~~~ sh [Deno]
deno run -A server.ts
~~~~

~~~~ sh [Node.js]
node --import tsx server.ts
~~~~

~~~~ sh [Bun]
bun server.ts
~~~~

::::

Now, open your web browser and navigate to <http://localhost:8000/>.  You should
see the <q>Hello, world</q> message.

As you can guess, [`Deno.serve()`] (in case of Deno), [`serve()`] (in case of
Node.js), and [`Bun.serve()`] (in case of Bun) are a function to create an HTTP
server.  They take a callback function that receives a [`Request`] object and
returns a [`Response`] object. The `Response` object is sent back to the client.

This server is not federated yet, but it's a good starting point to build a
federated server.

[`Deno.serve()`]: https://deno.land/api?s=Deno.serve
[`serve()`]: https://github.com/honojs/node-server?tab=readme-ov-file#usage
[`Bun.serve()`]: https://bun.sh/docs/api/http#bun-serve
[`Request`]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[`Response`]: https://developer.mozilla.org/en-US/docs/Web/API/Response


`Federation` object
-------------------

To make the server federated, we need to use the `Federation` object from the
Fedify framework.  The `Federation` object is the main object that handles
ActivityPub activities and actors.  Let's modify the server script to use the
`Federation` object:

~~~~ typescript
import { createFederation, MemoryKvStore } from "@fedify/fedify";

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
});
~~~~

In the above code, we import the `createFederation` function from the Fedify
framework to create a new `Federation` object.  We pass an object to the
`createFederation()` function, which is the configuration object.
The `kv` property is a key-value store that is used to store several internal
data of the `Federation` object.  We use the `MemoryKvStore` to open
a key-value store.

> [!IMPORTANT]
> Since `MemoryKvStore` is for testing and development purposes, you should
> use a persistent key-value store like `DenoKvStore` for production use.

Then, we pass the incoming `Request` to the `Federation.fetch()` method:

::: code-group

~~~~ typescript{2} [Deno]
Deno.serve(
  request => federation.fetch(request, { contextData: undefined })
);
~~~~

~~~~ typescript{6} [Node.js]
import { serve } from "@hono/node-server";

serve({
  port: 8000,
  fetch(request) {
    return federation.fetch(request, { contextData: undefined });
  }
});
~~~~

~~~~ typescript{4} [Bun]
Bun.serve({
  port: 8000,
  fetch(request) {
    return federation.fetch(request, { contextData: undefined });
  }
});
~~~~

:::

The `Federation.fetch()` method takes the incoming `Request` and few options.
In this case, we pass `undefined` as the `contextData` because we don't
need to share any context data here.

> [!TIP]
> The `Federation` object is a generic class that takes a type parameter named
> `TContextData`.  The `TContextData` type is the type of the context data,
> which is shared among the actor dispatcher, inbox listener, and other
> callback functions.  The `TContextData` type can be `void` if you don't
> need to share any context data, but it can be any type if you need to share
> context data.
>
> See [*`TContextData`* section](./manual/federation.md#tcontextdata) for more
> details.

The `Federation` object is now ready to handle incoming requests.  Let's move on
to the next step.

> [!TIP]
> Although it's not mandatory, we highly recommend to set up loggers to see
> what's going on in the server.  To set up loggers, you need to install
> [LogTape] first:
>
> ::: code-group
>
> ~~~~ sh [Deno]
> deno add @logtape/logtape
> ~~~~
>
> ~~~~ sh [Node.js]
> npm add @logtape/logtape
> ~~~~
>
> ~~~~ sh [Bun]
> bun add @logtape/logtape
> ~~~~
>
> :::
>
> Then, you can set up loggers by calling [`configure()`] function at the
> top of the *server.ts* file:
>
> ~~~~ typescript
> import { configure, getConsoleSink } from "@logtape/logtape";
>
> await configure({
>   sinks: { console: getConsoleSink() },
>   filters: {},
>   loggers: [
>     { category: "fedify",  sinks: ["console"], level: "info" },
>   ],
> });
> ~~~~

[`Deno.openKv()`]: https://deno.land/api?s=Deno.openKv
[LogTape]: https://github.com/dahlia/logtape
[`configure()`]: https://jsr.io/@logtape/logtape/doc/~/configure


Actor dispatcher
----------------

The `Federation` object needs an actor dispatcher to handle incoming activities
from other servers.  The actor dispatcher is a function that is called when
an incoming activity is addressed to an actor on the server.

As mentioned earlier, there will be only one actor (i.e., account) on
the server.  We will name its handle as *me* (you can choose any handle you
like).

Let's create an actor dispatcher for our server:

::: code-group

~~~~ typescript{7-16} [Deno]
import { Federation, MemoryKvStore, Person } from "@fedify/fedify";

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
});

federation.setActorDispatcher("/users/{handle}", async (ctx, handle) => {
  if (handle !== "me") return null;  // Other than "me" is not found.
  return new Person({
    id: ctx.getActorUri(handle),
    name: "Me",  // Display name
    summary: "This is me!",  // Bio
    preferredUsername: handle,  // Bare handle
    url: new URL("/", ctx.url),
  });
});

Deno.serve(
  request => federation.fetch(request, { contextData: undefined })
);
~~~~

~~~~ typescript{8-17} [Node.js]
import { Federation, MemoryKvStore, Person } from "@fedify/fedify";
import { serve } from "@hono/node-server";

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
});

federation.setActorDispatcher("/users/{handle}", async (ctx, handle) => {
  if (handle !== "me") return null;  // Other than "me" is not found.
  return new Person({
    id: ctx.getActorUri(handle),
    name: "Me",  // Display name
    summary: "This is me!",  // Bio
    preferredUsername: handle,  // Bare handle
    url: new URL("/", ctx.url),
  });
});

serve({
  port: 8000,
  fetch(request) {
    return federation.fetch(request, { contextData: undefined });
  }
});
~~~~

~~~~ typescript{7-16} [Bun]
import { Federation, MemoryKvStore, Person } from "@fedify/fedify";

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
});

federation.setActorDispatcher("/users/{handle}", async (ctx, handle) => {
  if (handle !== "me") return null;  // Other than "me" is not found.
  return new Person({
    id: ctx.getActorUri(handle),
    name: "Me",  // Display name
    summary: "This is me!",  // Bio
    preferredUsername: handle,  // Bare handle
    url: new URL("/", ctx.url),
  });
});

Bun.serve({
  port: 8000,
  fetch(request) {
    return federation.fetch(request, { contextData: undefined });
  }
});
~~~~

:::

In the above code, we use the `Federation.setActorDispatcher()` method to set
an actor dispatcher for the server.  The first argument is the path pattern
for the actor, and the second argument is a callback function that takes
a `Context` object and the actor's handle.  The callback function should return
an `Actor` object or `null` if the actor is not found.  In this case, we return
a `Person` object for the actor *me*.

Alright, we have an actor on the server.  Let's see if it works by querying
WebFinger for the actor.  Run the server by executing the following command:

::: code-group

~~~~ sh [Deno]
deno run -A server.ts
~~~~

~~~~ sh [Node.js]
node --import tsx server.ts
~~~~

~~~~ sh [Bun]
bun server.ts
~~~~

:::

Now, open a new terminal session and run the following command to query the
actor:[^3]

~~~~ sh
curl http://localhost:8000/.well-known/webfinger?resource=acct:me@localhost:8000
~~~~

The response should look like this (formatted for readability):

~~~~ json
{
  "subject": "acct:me@localhost:8000",
  "aliases": [
    "http://localhost:8000/users/me"
  ],
  "links": [
    {
      "rel": "self",
      "href": "http://localhost:8000/users/me",
      "type": "application/activity+json"
    },
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "href": "http://localhost:8000/"
    }
  ]
}
~~~~

The above response shows that the actor *me* is found on the server, and its
canonical URI is `http://localhost:8000/users/me`.  Let's see what happens when
we query the actor's canonical URI (note that the request contains
the `Accept: application/activity+json` header):[^3]

~~~~ sh
curl -H"Accept: application/activity+json" http://localhost:8000/users/me
~~~~

The response should look like this (formatted for readability):

~~~~ json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1",
    {
      "toot": "http://joinmastodon.org/ns#",
      "discoverable": "toot:discoverable",
      "suspended": "toot:suspended",
      "memorial": "toot:memorial",
      "indexable": "toot:indexable"
    }
  ],
  "id": "http://localhost:8000/users/me",
  "type": "Person",
  "name": "Me",
  "preferredUsername": "me",
  "summary": "This is me!",
  "url": "http://localhost:8000/"
}
~~~~

The response shows the actor *me* with its basic information.

Requests we've made so far are what ordinary ActivityPub implementations
do behind the scenes when they try to look up an actor (i.e., account).
For example, when you search with a full handle of an actor on Mastodon,
a Mastodon instance queries the WebFinger endpoint to find the actor's
canonical URI and then queries the canonical URI to get the actor's profile.

However, you still can't follow the actor *me* from other ActivityPub servers,
because our server is not exposed to the public internet yet.  We will cover
this in the next section.

> [!TIP]
> If you are curious about the actor dispatcher further, see the
> [*Actor dispatcher* section](./manual/actor.md) in the manual.

[^3]: It assumes that you have [curl] installed on your system.  If you don't
      have curl, you need to install it first.

[curl]: https://curl.se/


Exposing the server to the public internet
------------------------------------------

To expose the server to the public internet, generally, you need a proper domain
name configured with a DNS record pointing to your server's IP address.
However, for local development, you can use a tool like [ngrok] to temporarily
expose your server to the public internet.

In order to install ngrok on your system, please follow the [instructions on
the ngrok website][ngrok quickstart] (you only need to follow until the step 2).

After installing ngrok, you can expose your server to the public internet by
running the following command (note that you need to run this command in a new
terminal session so that the server is still running):

~~~~ sh
ngrok http 8000
~~~~

The above command will expose your server to the public internet.  You will see
a public URL that you can use to access your server from the internet.

> [!NOTE]
> Do not rely on ngrok for production use.  It is only for local development.
> Unless you have paid for a subscription, the domain name ngrok provides is
> temporary and will change every time you restart ngrok.

However, since ngrok is a reverse proxy between the public internet and your
server, the server still is not aware the fact that it is exposed to the public
internet through HTTPS.  In order to make the server aware of it, you need to
place a [x-forwarded-fetch] middleware in front of the `Federation`.

To do this, you need to install the package:

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

~~~~ typescript{2,6} [Node.js]
import { serve } from "@hono/node-server";
import { behindProxy } from "x-forwarded-fetch";

serve({
  port: 8000,
  fetch: behindProxy((request) => federation.fetch(request, { contextData: undefined }),
});
~~~~

~~~~ typescript{1,5} [Bun]
import { behindProxy } from "x-forwarded-fetch";

Bun.serve({
  port: 8000,
  fetch: behindProxy((request) => federation.fetch(request, { contextData: undefined })),
});
~~~~

:::

To restart the server, you need to stop the server by pressing <kbd>^C</kbd> and
then run the server again:

::: code-group

~~~~ sh [Deno]
deno run -A server.ts
~~~~

~~~~ sh [Node.js]
node --import tsx server.ts
~~~~

~~~~ sh [Bun]
bun server.ts
~~~~

:::

Let's query the actor *me* again, but this time with the public URL (change
the domain name to the one ngrok provides you):[^3]

~~~~ sh
curl https://79e8-125-129-0-52.ngrok-free.app/.well-known/webfinger?resource=acct:me@7d2d-125-129-0-52.ngrok-free.app
curl https://79e8-125-129-0-52.ngrok-free.app/users/me
~~~~

Does it work?  If so, congratulations!  Your server is now exposed to the
public internet.  However, you still can't follow the actor *me* from other
ActivityPub servers because our server doesn't accept follow requests yet.

> [!TIP]
> There are alternatives to ngrok.  See also the [*Exposing a local server to
> the public* section](./manual/test.md#exposing-a-local-server-to-the-public)
> in the manual for more details.

[ngrok]: https://ngrok.com/
[ngrok quickstart]: https://ngrok.com/docs/getting-started/
[x-forwarded-fetch]: https://github.com/dahlia/x-forwarded-fetch


Inbox listener
--------------

In ActivityPub, an [inbox] is where an actor receives incoming activities from
other actors.  To accept follow requests from other servers, we need to register
an inbox listener for the actor *me*.

Let's register an inbox listener for the actor *me*.  First of all, every
activity is represented as a class in the Fedify framework.  The `Follow` class
represents the `Follow` activity.  We will use the `Follow` class to handle
incoming follow requests:

~~~~ typescript
import { Federation, Follow, Person, MemoryKvStore } from "@fedify/fedify";
~~~~

Then, we register an inbox listener for the `Follow` activity:

~~~~ typescript{3-11}
federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.handle !== "me") return;
    const follower = await follow.getActor(ctx);
    console.debug(follower);
  });
~~~~

Yet, the above code doesn't do anything other than printing the follower's
information to the console.  We will send an accept activity back to the sender
when we receive a follow request in the next section, but here we just see
who the follower is.

In order to test the inbox listener, the actor *me* needs to point out its inbox
URI in the actor object.  Let's modify the actor dispatcher to include the inbox
URI:

~~~~ typescript
federation.setActorDispatcher("/users/{handle}", async (ctx, handle) => {
  if (handle !== "me") return null;
  return new Person({
    id: ctx.getActorUri(handle),
    name: "Me",
    summary: "This is me!",
    preferredUsername: handle,
    url: new URL("/", ctx.url),
    inbox: ctx.getInboxUri(handle),  // Inbox URI // [!code highlight]
  });
});
~~~~

Now, let's restart the server and look up the actor *me* again, but this time
on your Mastodon instance (or any other ActivityPub server you have account on).
To look up the actor *me*, you need to search with the full handle of the actor
(i.e., *@me@your-server-domain*):

![Search results on Mastodon; the actor @me shows up.](./tutorial/search-result.png)

When you find the actor *me*, click on the actor's profile and then click on
the *Follow* button.  You should see your Mastodon account sending a follow
request to the actor *me* on the console where the server is running:

~~~~
Person {
  id: URL "...",
  name: "...",
  ... omitted for brevity ...
}
~~~~

However, the server doesn't send an accept activity back to the sender yet.
We will cover this in the next section.

[inbox]: https://www.w3.org/TR/activitypub/#inbox


Generating a key pair
---------------------

To send an activity, first, we need to generate a key pair for the actor *me*
so that the server can sign the activity with the private key.  Fortunately,
Fedify provides helper functions to generate and export/import keys:

~~~~ typescript
import {
  Federation, Follow, Person, MemoryKvStore,
  // Import helper functions:
  exportJwk, generateCryptoKeyPair, importJwk,  // [!code highlight]
} from "@fedify/fedify";
~~~~

By the way, when should we generate a key pair?  In general, you should generate
a key pair when the actor is created.  In our case, we generate a key pair when
the actor *me* is dispatched for the first time.  Then, we store the key pair
in the key-value store so that the server can use the key pair later.

The `~ActorCallbackSetters.setKeyPairsDispatcher()` method is used to set a key
pairs dispatcher for the actor.  The key pairs dispatcher is a function that is
called when the key pairs of an actor is needed.  Let's set a key pairs
dispatcher for the actor *me*.  `~ActorCallbackSetters.setKeyPairsDispatcher()`
method should be chained after the `Federation.setActorDispatcher()` method:

::: code-group

~~~~ typescript{13-14,17-37} [Deno]
const kv = await Deno.openKv();  // Open the key-value store

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle) => {
    if (handle !== "me") return null;
    return new Person({
      id: ctx.getActorUri(handle),
      name: "Me",
      summary: "This is me!",
      preferredUsername: handle,
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(handle),
      // The public keys of the actor; they are provided by the key pairs
      // dispatcher we define below:
      publicKeys: (await ctx.getActorKeyPairs(handle))
        .map(keyPair => keyPair.cryptographicKey),
    });
  })
  .setKeyPairsDispatcher(async (ctx, handle) => {
    if (handle != "me") return [];  // Other than "me" is not found.
    const entry = await kv.get<{ privateKey: unknown, publicKey: unknown }>(["key"]);
    if (entry == null || entry.value == null) {
      // Generate a new key pair at the first time:
      const { privateKey, publicKey } =
        await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
      // Store the generated key pair to the Deno KV database in JWK format:
      await kv.set(
        ["key"],
        {
          privateKey: await exportJwk(privateKey),
          publicKey: await exportJwk(publicKey),
        }
      );
      return [{ privateKey, publicKey }];
    }
    // Load the key pair from the Deno KV database:
    const privateKey = await importJwk(entry.value.privateKey, "private");
    const publicKey =  await importJwk(entry.value.publicKey, "public");
    return [{ privateKey, publicKey }];
  });
~~~~

~~~~ typescript{15-16,19-39} [Node.js]
import { openKv } from "@deno/kv";

const kv = await openKv("kv.db");  // Open the key-value store

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
    if (handle !== "me") return null;
    return new Person({
      id: ctx.getActorUri(handle),
      name: "Me",
      summary: "This is me!",
      preferredUsername: handle,
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(handle),
      // The public keys of the actor; they are provided by the key pairs
      // dispatcher we define below:
      publicKeys: (await ctx.getActorKeyPairs(handle))
        .map(keyPair => keyPair.cryptographicKey),
    });
  })
  .setKeyPairsDispatcher(async (ctx, handle) => {
    if (handle != "me") return [];  // Other than "me" is not found.
    const entry = await kv.get<{ privateKey: unknown, publicKey: unknown }>(["key"]);
    if (entry == null || entry.value == null) {
      // Generate a new key pair at the first time:
      const { privateKey, publicKey } =
        await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
      // Store the generated key pair to the Deno KV database in JWK format:
      await kv.set(
        ["key"],
        {
          privateKey: await exportJwk(privateKey),
          publicKey: await exportJwk(publicKey),
        }
      );
      return [{ privateKey, publicKey }];
    }
    // Load the key pair from the Deno KV database:
    const privateKey = await importJwk(entry.value.privateKey, "private");
    const publicKey =  await importJwk(entry.value.publicKey, "public");
    return [{ privateKey, publicKey }];
  });
~~~~

~~~~ typescript{15-16,19-39} [Bun]
import { serialize as encodeV8, deserialize as decodeV8 } from "node:v8";
import { openKv } from "@deno/kv";

// Open the key-value store:
const kv = await openKv("kv.db", { encodeV8, decodeV8 });

federation
  .setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
    if (handle !== "me") return null;
    return new Person({
      id: ctx.getActorUri(handle),
      name: "Me",
      summary: "This is me!",
      preferredUsername: handle,
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(handle),
      // The public keys of the actor; they are provided by the key pairs
      // dispatcher we define below:
      publicKeys: (await ctx.getActorKeyPairs(handle))
        .map(keyPair => keyPair.cryptographicKey),
    });
  })
  .setKeyPairsDispatcher(async (ctx, handle) => {
    if (handle != "me") return [];  // Other than "me" is not found.
    const entry = await kv.get<{ privateKey: unknown, publicKey: unknown }>(["key"]);
    if (entry == null || entry.value == null) {
      // Generate a new key pair at the first time:
      const { privateKey, publicKey } =
        await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
      // Store the generated key pair to the Deno KV database in JWK format:
      await kv.set(
        ["key"],
        {
          privateKey: await exportJwk(privateKey),
          publicKey: await exportJwk(publicKey),
        }
      );
      return [{ privateKey, publicKey }];
    }
    // Load the key pair from the Deno KV database:
    const privateKey = await importJwk(entry.value.privateKey, "private");
    const publicKey =  await importJwk(entry.value.publicKey, "public");
    return [{ privateKey, publicKey }];
  });
~~~~

:::

In the above code, we use the `~ActorCallbackSetters.setKeyPairsDispatcher()`
method to set a key pairs dispatcher for the actor *me*.  The key pairs
dispatcher is called when the key pairs of an actor is needed. The key pairs
dispatcher should return an array of objects that contain the private key
and the public key of the actor.  In this case, we generate a new key pair
at the first time and store it in the key-value store.  When the actor *me* is
dispatched again, the key pairs dispatcher loads the key pair from the key-value
store.

> [!NOTE]
> Although we use the Deno KV database in this tutorial, you can use any
> other your favorite database to store the key pair.  The key-value store
> is just an example.

Restart the server and make an HTTP request to the actor *me* using `curl`.
Now you should see the actor *me* with the public key in the response:

~~~~ json {16-21}
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1",
    {
      "toot": "http://joinmastodon.org/ns#",
      "discoverable": "toot:discoverable",
      "suspended": "toot:suspended",
      "memorial": "toot:memorial",
      "indexable": "toot:indexable"
    }
  ],
  "id": "https://79e8-125-129-0-52.ngrok-free.app/users/me",
  "type": "Person",
  "inbox": "https://79e8-125-129-0-52.ngrok-free.app/users/me/inbox",
  "publicKey": {
    "id": "https://79e8-125-129-0-52.ngrok-free.app/users/me#main-key",
    "type": "CryptographicKey",
    "owner": "https://79e8-125-129-0-52.ngrok-free.app/users/me",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA0kptPO/arJVTv1qBzISP\nhJC8MZSut20FHZuJFON/kTscQT19eP2zGC9qDnQVl1vOXrvFybPWMjQP4p2x1/VM\np0wnY2EzKsdU4+lKfHsjd0VU2+TJvPtZ/AqJAG3PLMXeN7E5RpeUTwdTr9fkyrHE\n0M8n8yWG1AMtXp5pzhR/Le8uHmuSjbgJxIZPZOj8T6ZdMXKxudF0H/i0IB60lN9D\nt5tOzajmE5jvZD0mapdIDhghidGBu77fgopKmBtNn3IDjLJLXIh3dp7NICl1czHB\ntVtU1c2kmNPXq1WSndQgokN4CXNoy/BqTKo4VhIOWWb/oGaTZOWflFM5EXWTJUxK\n8JFyCD/1KVJXYEd662y+r400oDJqHKHhG78yud83PD4bpbJm/t7BD7RgO95g/rpN\nwi8mjLQVp7Y9ttXGf3lEgbBPZfPr0pm3X4ppoDAwtzVO7RmfboSb9ECa9uwQc1VG\nse3yNi7bDrHIu+HjBzk+glELcW2Hj4t4s/PPX9g0fH3UHgME1Pysz3Y8OZZeJlTu\n1yYcCg9X/dMV1qxxon6b8XhIEttW+RZjJunmtzOt1sKf2NM2jPXv+ZmFRao1eOzo\nvcVI/eeXV+1LDhHtTQJGnLObqnHnVdg3Qiaao176KOxrKh4/l6kJmaq/pw8+ZSkE\nzxUovxHGCJ0UqqgcaPsBsJMCAwEAAQ==\n-----END PUBLIC KEY-----"
  },
  "name": "Me",
  "preferredUsername": "me",
  "summary": "This is me!",
  "url": "https://79e8-125-129-0-52.ngrok-free.app/"
}
~~~~

Alright, we have the public key of the actor *me*.  Let's move on to the next
section to send an accept activity back to the sender when we receive a follow
request.


Sending an `Accept` activity
----------------------------

When the server receives a follow request, it should send an `Accept` or
`Reject` activity back to the sender.  The `Accept` activity is a response to
the follow request and indicates that the follow request is accepted.

Let's import the `Accept` class from the Fedify framework:

~~~~ typescript
import {
  Accept,  // Import the Accept class // [!code highlight]
  Federation, Follow, Person,
  exportJwk, generateCryptoKeyPair, importJwk,
} from "@fedify/fedify";
~~~~

Then, we modify the inbox listener to send an `Accept` activity back to the
follower when we receive a follow request:

~~~~ typescript{10-17}
federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.handle !== "me") return;
    const follower = await follow.getActor(ctx);
    // Note that if a server receives a `Follow` activity, it should reply
    // with either an `Accept` or a `Reject` activity.  In this case, the
    // server automatically accepts the follow request:
    await ctx.sendActivity(
      { handle: parsed.handle },
      follower,
      new Accept({ actor: follow.objectId, object: follow }),
    );
  });
~~~~

Restart the server, and make a follow request from your Mastodon account to
the actor *me*.  You should see the server immediately accept the follow
request.


Listing followers
-----------------

The server should list the actor's followers on the home page.  To do this,
we need to store the followers in the key-value store.  We will store each
`Follow` activity's ID as the key and the follower's actor ID as the value:

~~~~ typescript{15-16}
federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.handle !== "me") return;
    const follower = await follow.getActor(ctx);
    await ctx.sendActivity(
      { handle: parsed.handle },
      follower,
      new Accept({ actor: follow.objectId, object: follow }),
    );
    // Store the follower in the key-value store:
    await kv.set(["followers", follow.id.href], follow.actorId.href);
  });
~~~~

Now, we need to make the home page to show the actor's followers.  Let's modify
the script inside the fetch function:

::: code-group

~~~~ typescript{2-16} [Deno]
Deno.serve(async (request) => {
  const url = new URL(request.url);
  // The home page:
  if (url.pathname === "/") {
    const followers: string[] = [];
    for await (const entry of kv.list<string>({ prefix: ["followers"] })) {
      if (followers.includes(entry.value)) continue;
      followers.push(entry.value);
    }
    return new Response(
      `<ul>${followers.map((f) => `<li>${f}</li>`)}</ul>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  // The federation-related requests are handled by the Federation object:
  return await federation.fetch(request, { contextData: undefined });
});
~~~~

~~~~ typescript{4-18} [Node.js]
serve({
  port: 8000,
  async fetch(request) {
    const url = new URL(request.url);
    // The home page:
    if (url.pathname === "/") {
      const followers: string[] = [];
      for await (const entry of kv.list<string>({ prefix: ["followers"] })) {
        if (followers.includes(entry.value)) continue;
        followers.push(entry.value);
      }
      return new Response(
        `<ul>${followers.map((f) => `<li>${f}</li>`)}</ul>`,
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    // The federation-related requests are handled by the Federation object:
    return await federation.fetch(request, { contextData: undefined });
  }
});
~~~~

~~~~ typescript{4-18} [Bun]
Bun.serve({
  port: 8000,
  async fetch(request) {
    const url = new URL(request.url);
    // The home page:
    if (url.pathname === "/") {
      const followers: string[] = [];
      for await (const entry of kv.list<string>({ prefix: ["followers"] })) {
        if (followers.includes(entry.value)) continue;
        followers.push(entry.value);
      }
      return new Response(
        `<ul>${followers.map((f) => `<li>${f}</li>`)}</ul>`,
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    // The federation-related requests are handled by the Federation object:
    return await federation.fetch(request, { contextData: undefined });
  }
});
~~~~

:::

The above code lists the actor's followers on the home page.  The followers are
stored in the key-value store, and we retrieve the followers from the key-value
store and display them on the home page.

Restart the server and navigate to the home page in your web browser.  You
should see the actor's followers in the bulleted list.


Wrapping up
-----------

Congratulations!  You have built a small federated server that can accept
follow requests and list the actor's followers.  You have learned the key
features of the ActivityPub protocol and the Fedify framework, such as actors,
sending and receiving activities, and the inbox.

In this tutorial, we have covered the following topics:

 -  Creating a new project
 -  Creating the server
 -  `Federation` object
 -  Actor dispatcher
 -  Exposing the server to the public internet
 -  Inbox listener
 -  Generating a key pair
 -  Sending an `Accept` activity
 -  Listing followers

You can extend the server by adding more features, such as sending other
activities, handling other types of activities, and implementing other callback
functions.  The Fedify framework provides a wide range of features to build
a federated server, and you can explore them by reading
the [manual](./manual.md) and the [API reference].

If you have any questions or feedback, feel free to ask in
the [Fedify community] on Matrix or the [GitHub Discussions].

[API reference]: https://jsr.io/@fedify/fedify
[Fedify community]: https://matrix.to/#/#fedify:matrix.org
[GitHub Discussions]: https://github.com/dahlia/fedify/discussions


Exercises
---------

 -  Implement unfollowing feature: Listen to the `Undo` activity and remove
    the follower from the key-value store when the server receives an `Undo`
    activity.

 -  Integration with a web framework: In the above example, we hard-coded
    the home page inside the callback function passed to the `Deno.serve()`.
    Instead, you can use a web framework like [Fresh] to utilize the proper
    routing system and [JSX] templates to produce HTML.

    See also the [*Integration* section](./manual/integration.md) in
    the manual for more details.

[Fresh]: https://fresh.deno.dev/
[JSX]: https://facebook.github.io/jsx/
