---
description: >-
  Fedify is designed to be used together with web frameworks.  This document
  explains how to integrate Fedify with web frameworks.
prev:
  text: Pragmatics
  link: ./pragmatics.md
next:
  text: Testing
  link: ./test.md
---

Integration
===========

Fedify is designed to be used together with web frameworks.  This document
explains how to integrate Fedify with web frameworks.


Hono
----

*This API is available since Fedify 0.6.0.*

[Hono] is a fast, lightweight, and Web standard-compliant server framework for
TypeScript.  Fedify has the `@fedify/fedify/x/hono` module that provides
a middleware to integrate Fedify with Hono:

~~~~ typescript
import { Federation } from "@fedify/fedify";
import { federation } from "@fedify/fedify/x/hono";
import { Hono } from "hono";

const fedi = new Federation<string>({
  // Omitted for brevity; see the related section for details.
});

const app = new Hono();
app.use(federation(fedi, (ctx) => "context data"));  // [!code highlight]
~~~~

[Hono]: https://hono.dev/


Fresh
-----

*This API is available since Fedify 0.4.0.*

[Fresh] is a full stack modern web framework for Deno.  Fedify has the
`@fedify/fedify/x/fresh` module that provides a middleware to integrate Fedify
with Fresh.  Put the following code in your *routes/_middleware.ts* file:

~~~~ typescript{8-12}
import { Federation } from "@fedify/fedify";
import { integrateHandler } from "@fedify/fedify/x/fresh";

const federation = new Federation<string>({
  // Omitted for brevity; see the related section for details.
});

// This is the entry point to the Fedify middleware from the Fresh framework:
export const handler = integrateHandler(
  federation,
  (req, ctx) => "context data",
);

~~~~

[Fresh]: https://fresh.deno.dev/


Custom middleware
-----------------

Even if you are using a web framework that is not officially supported by
Fedify, you can still integrate Fedify with the framework by creating a custom
middleware (unless the framework does not support middleware).

Web frameworks usually provide a way to intercept incoming requests and outgoing
responses in the middle, which is so-called <dfn>middleware</dfn>.  If your
web framework has a middleware feature, you can use it to intercept
federation-related requests and handle them with the `Federation` object.

The key is to create a middleware that calls the `Federation.fetch()` method
with the incoming request and context data, and then sends the response from
Fedify to the client.  At this point, you can use `onNotFound` and
`onNotAcceptable` callbacks to forward the request to the next middleware.

The following is an example of a custom middleware for a hypothetical web
framework:

~~~~ typescript
import { Federation } from "@fedify/fedify";

export type Middleware = (
  request: Request,
  next: (request: Request) => Promise<Response>
) => Promise<Response>;

export function createFedifyMiddleware<TContextData>(
  federation: Federation<TContextData>,
  contextDataFactory: (request: Request) => TContextData,
): Middleware {
  return async (request, next) => {
    return await federation.fetch(request, {
      contextData: contextDataFactory(request),

      // If the `federation` object finds a `request` not responsible for it
      // (i.e., not a federation-related request), it will call the `next`
      // provided by the web framework to continue the request handling by
      // the web framework:
      onNotFound: async (request) => await next(request),

      // Similar to `onNotFound`, but slightly more tickly one.
      // When the `federation` object finds a `request` not acceptable type-wise
      // (i.e., a user-agent doesn't want JSON-LD), it will call the `next`
      // provided by the web framework so that it renders HTML if there's some
      // page.  Otherwise, it will simply respond with `406 Not Acceptable`.
      // This trick enables the Fedify and the web framework to share the same
      // routes and they do content negotiation depending on `Accept` header:
      onNotAcceptable: async (request) => {
        const response = await next(request);
        if (response.status !== 404) return response;
        return new Response("Not Acceptable", {
          status: 406,
          headers: {
            "Content-Type": "text/plain",
            Vary: "Accept"
          },
        })
      }
    });
  };
}
~~~~

In some cases, your web framework may not represent requests and responses
as [`Request`] and [`Response`] objects.  In that case, you need to convert
the request and response objects to the appropriate types that the `Federation`
object can handle.

[`Request`]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[`Response`]: https://developer.mozilla.org/en-US/docs/Web/API/Response
