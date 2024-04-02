---
nav_order: 3
metas:
  description: >-
    This tutorial provides a step-by-step guide to building a small federated
    server with the Fedify framework.  It is intended for developers who want
    to build a federated server with the Fedify framework.
---

Tutorial
========

In this tutorial, we will build a small federated server that can only accept
follow requests.  Despite its simplicity, it will cover the key features of the
ActivityPub protocol and the Fedify framework, such as actors, sending and
receiving activities, and the inbox.

As prerequisite knowledge, you should have a basic understanding of
JavaScript/TypeScript, command-line interfaces, and minimum experience with
building web server apps.  However, it's perfectly fine if you're not familiar
with the ActivityPub protocol or the Deno runtime; we will explain them as
we go.

> [!NOTE]
> The Deno runtime is a secure runtime for JavaScript and TypeScript.  It is
> similar to Node.js but has a few differences, such as a built-in
> TypeScript compiler and a secure-by-default design.  If you are already
> familiar with Node.js, you can think of Deno as a more modern version of
> Node.js created by the same person, Ryan Dahl.
>
> Although this tutorial is written for Deno, you can use the Fedify framework
> in Node.js as well.  The API is the same in both Deno and Node.js.


What we will build
------------------

We will build a small federated server which can accept follow requests from
other servers.  The server will have a single actor (i.e., account) and an inbox
to receive follow requests.  When the server receives a follow request, it will
send an accept activity back to the sender.  The home page of the server will
list the actor's followers.


Setting up Deno
---------------

> [!TIP]
> If you are already familiar with Deno, you can skip to the [*`Federation`
> object* section](#federation-object).

First, you need to install the Deno runtime.  Please run the following command
in your terminal:

~~~~ sh
curl -fsSL https://deno.land/install.sh | sh  # Linux or macOS
~~~~

~~~~ powershell
irm https://deno.land/install.ps1 | iex  # Windows
~~~~

> [!TIP]
> If you are doubtful about running scripts from the internet, there are
> additional installation options available on the [Deno installation] docs.

After installing Deno, you can verify the installation by running the following
command:

~~~~ sh
deno --version
~~~~

Your Deno installation must be at least version 1.41.0.  If you see the version
number, you are ready to go.

[Deno installation]: https://docs.deno.com/runtime/manual/getting_started/installation


Creating a new project
----------------------

Let's create a new project directory and initialize a new Deno project:

~~~~ sh
mkdir follow-server
cd follow-server/
deno add @fedify/fedify
~~~~

The `deno add` command will create a *deno.json* file in the project directory
with the following content (formatted for readability):[^2]

~~~~ json
{
  "imports": {
    "@fedify/fedify": "jsr:@fedify/fedify@^0.4.0"
  }
}
~~~~

[^2]: The actual version number may vary depending on the latest version of the
      Fedify framework as of reading this tutorial.


Creating the server
-------------------

Now, let's create the server script.  Create a new file named *server.ts* in the
project directory and write the following code:

~~~~ typescript
Deno.serve(request =>
  new Response("Hello, world", {
    headers: { "Content-Type": "text/plain" }
  })
);
~~~~

It's a simple HTTP server that responds with <q>Hello, world</q> to any incoming
request.  You can run the server by executing the following command:

~~~~ sh
deno run -A server.ts
~~~~

Now, open your web browser and navigate to <http://localhost:8000/>.  You should
see the <q>Hello, world</q> message.

As you can guess, [`Deno.serve()`] is a function to create an HTTP server.
It takes a callback function that receives a [`Request`] object and returns
a [`Response`] object.  The `Response` object is sent back to the client.

This server is not federated yet, but it's a good starting point to build a
federated server.

[`Deno.serve()`]: https://deno.land/api?s=Deno.serve
[`Request`]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[`Response`]: https://developer.mozilla.org/en-US/docs/Web/API/Response


`Federation` object
-------------------

To make the server federated, we need to use the `Federation` object from the
Fedify framework.  The `Federation` object is the main object that handles
ActivityPub activities and actors.  Let's modify the server script to use the
`Federation` object:

~~~~ typescript
import { Federation, MemoryKvStore } from "@fedify/fedify";

const federation = new Federation<void>({
  kv: new MemoryKvStore(),
});
~~~~

In the above code, we import the `Federation` object from the Fedify framework
and create a new `Federation` object.  We pass an object to the
`new Federation()` constructor, which is the configuration object.
The `kv` property is a key-value store that is used to store several internal
data of the `Federation` object.  We use the `MemoryKvStore` to open
a key-value store.

> [!IMPORTANT]
> Since `MemoryKvStore` is for testing and development purposes, you should
> use a persistent key-value store like `DenoKvStore` for production use.

Then, we pass the incoming `Request` to the `Federation.fetch()` method:

~~~~ typescript
Deno.serve(
  request => federation.fetch(request, { contextData: undefined })
);
~~~~

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

[`Deno.openKv()`]: https://deno.land/api?s=Deno.openKv


Actor dispatcher
----------------

The `Federation` object needs an actor dispatcher to handle incoming activities
from other servers.  The actor dispatcher is a function that is called when
an incoming activity is addressed to an actor on the server.

As mentioned earlier, there will be only one actor (i.e., account) on
the server.  We will name its handle as *me* (you can choose any handle you
like).

Let's create an actor dispatcher for our server:

~~~~ typescript
import { Federation, MemoryKvStore, Person } from "@fedify/fedify";

const federation = new Federation<void>({
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

In the above code, we use the `Federation.setActorDispatcher()` method to set
an actor dispatcher for the server.  The first argument is the path pattern
for the actor, and the second argument is a callback function that takes
a `Context` object and the actor's handle.  The callback function should return
an `Actor` object or `null` if the actor is not found.  In this case, we return
a `Person` object for the actor *me*.

Alright, we have an actor on the server.  Let's see if it works by querying
WebFinger for the actor.  Run the server by executing the following command:

~~~~ sh
deno run -A server.ts
~~~~

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
set the `treatHttps` property to `true` in the `Federation` object:

~~~~ typescript
const federation = new Federation<void>({
  kv: new MemoryKvStore(),
  treatHttps: true,  // Treat HTTP requests as HTTPS
});
~~~~

To restart the server, you need to stop the server by pressing <kbd>^C</kbd> and
then run the server again:

~~~~ sh
deno run -A server.ts
~~~~

Let's query the actor *me* again, but this time with the public URL (change
the domain name to the one ngrok provides you):

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

~~~~ typescript
federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const handle = ctx.getHandleFromActorUri(follow.objectId);
    if (handle !== "me") return;
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
    inbox: ctx.getInboxUri(handle),  // Inbox URI
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
  exportJwk, generateCryptoKeyPair, importJwk,
} from "@fedify/fedify";
~~~~

By the way, when should we generate a key pair?  In general, you should generate
a key pair when the actor is created.  In our case, we generate a key pair when
the actor *me* is dispatched for the first time.  Then, we store the key pair
in the key-value store so that the server can use the key pair later.

The `~ActorCallbackSetters.setKeyPairDispatcher()` method is used to set a key
pair dispatcher for the actor.  The key pair dispatcher is a function that is
called when the key pair of an actor is needed.  Let's set a key pair dispatcher
for the actor *me*.  `~ActorCallbackSetters.setKeyPairDispatcher()` method
should be chained after the `Federation.setActorDispatcher()` method:

~~~~ typescript
const kv = await Deno.openKv();  // Open the key-value store

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
      publicKey: key,  // The public key of the actor; it's provided by the key
                       // pair dispatcher we define below
    });
  })
  .setKeyPairDispatcher(async (ctx, handle) => {
    if (handle != "me") return null;  // Other than "me" is not found.
    const entry = await kv.get<{ privateKey: unknown, publicKey: unknown }>(["key"]);
    if (entry == null || entry.value == null) {
      // Generate a new key pair at the first time:
      const { privateKey, publicKey } = await generateCryptoKeyPair();
      // Store the generated key pair to the Deno KV database in JWK format:
      await kv.set(
        ["key"],
        {
          privateKey: await exportJwk(privateKey),
          publicKey: await exportJwk(publicKey),
        }
      );
      return { privateKey, publicKey };
    }
    // Load the key pair from the Deno KV database:
    const privateKey = await importJwk(entry.value.privateKey, "private");
    const publicKey =  await importJwk(entry.value.publicKey, "public");
    return { privateKey, publicKey };
  });
~~~~

In the above code, we use the `~ActorCallbackSetters.setKeyPairDispatcher()`
method to set a key pair dispatcher for the actor *me*.  The key pair dispatcher
is a function that is called when the key pair of an actor is needed.
The key pair dispatcher should return an object that contains the private key
and the public key of the actor.  In this case, we generate a new key pair
at the first time and store it in the key-value store.  When the actor *me* is
dispatched again, the key pair dispatcher loads the key pair from the key-value
store.

> [!IMPORTANT]
> In the above code, we use the `Deno.openKv()` function to open the key-value
> store, which is persistent.  However, Deno KV is an unstable feature as of
> March 2024, so you need to add the `"unstable": ["kv"]` field to the
> *deno.json* file:
>
> ~~~~ json
> {
>   "imports": {
>     "@fedify/fedify": "jsr:@fedify/fedify@^0.4.0"
>   },
>   "unstable": ["kv"]
> }
> ~~~~

> [!NOTE]
> Although we use the Deno KV database in this tutorial, you can use any
> other your favorite database to store the key pair.  The key-value store
> is just an example.

Restart the server and make an HTTP request to the actor *me* using `curl`.
Now you should see the actor *me* with the public key in the response:

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
  Accept,  // Import the Accept class
  Federation, Follow, Person,
  exportJwk, generateCryptoKeyPair, importJwk,
} from "@fedify/fedify";
~~~~

Then, we modify the inbox listener to send an `Accept` activity back to the
follower when we receive a follow request:

~~~~ typescript
federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const handle = ctx.getHandleFromActorUri(follow.objectId);
    if (handle !== "me") return;
    const follower = await follow.getActor(ctx);
    // Note that if a server receives a `Follow` activity, it should reply
    // with either an `Accept` or a `Reject` activity.  In this case, the
    // server automatically accepts the follow request:
    await ctx.sendActivity(
      { handle },
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

~~~~ typescript
federation
  .setInboxListeners("/users/{handle}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const handle = ctx.getHandleFromActorUri(follow.objectId);
    if (handle !== "me") return;
    const follower = await follow.getActor(ctx);
    await ctx.sendActivity(
      { handle },
      follower,
      new Accept({ actor: follow.objectId, object: follow }),
    );
    // Store the follower in the key-value store:
    await kv.set(["followers", follow.id.href], follow.actorId.href);
  });
~~~~

Now, we need to make the home page to show the actor's followers.  Let's modify
the script inside the callback function passed to the `Deno.serve()`:

~~~~ typescript
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
  return await federation.handle(request, { contextData: undefined });
});
~~~~

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

 -  Setting up Deno
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
    
    See also the [*Integrating with a web framework*
    section](./manual/federation.md#integrating-with-a-web-framework) in
    the manual for more details.

[Fresh]: https://fresh.deno.dev/
[JSX]: https://facebook.github.io/jsx/
