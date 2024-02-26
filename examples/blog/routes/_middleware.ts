import { FreshContext } from "$fresh/server.ts";
import { federation } from "../federation/mod.ts";
import { openKv } from "fedify/examples/blog/models/kv.ts";

export async function handler(request: Request, context: FreshContext) {
  return await federation.handle(request, {
    contextData: await openKv(),
    onNotFound: context.next.bind(context),
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
