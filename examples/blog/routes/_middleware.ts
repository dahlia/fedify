import { FreshContext } from "$fresh/server.ts";
import { federation } from "../federation/mod.ts";

// This is the entry point to the Fedify middleware from the Fresh framework:
export async function handler(request: Request, context: FreshContext) {
  // The `federation` object purposes to handle federation-related requests.
  // It is responsible for handling, for example, WebFinger queries, actor
  // dispatching, and incoming activities to the inbox.  The definition of
  // the object is in the federation/mod.ts file.
  return await federation.handle(request, {
    // The context data is not used in this example, but it can be used to
    // store data (e.g., database connections) that is shared between
    // the different federation-related callbacks:
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
    // and they do content negotiation depending on `Accept` header.
    // For instance, in this example, `/users/{handle}` can return JSON-LD
    // by the Fedify and redirects to the home page by the Fresh:
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
