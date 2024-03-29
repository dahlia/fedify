/**
 * Fedify with Fresh
 * =================
 *
 * This module contains some utilities for integrating Fedify with [Fresh],
 * a web framework for Deno.
 *
 * [Fresh]: https://fresh.deno.dev/
 *
 * @module
 */
import type {
  Federation,
  FederationHandlerParameters,
} from "../federation/middleware.ts";

interface FreshContext {
  next(): Promise<Response>;
}

/**
 * Create options for the `federation` object to integrate with Fresh.
 *
 * @example _middleware.ts
 * ``` typescript
 * import { FreshContext } from "$fresh/server.ts";
 * import { federation } from "federation.ts"; // Import the `Federation` object
 *
 * export async function handler(request: Request, context: FreshContext) {
 *   return await federation.handle(request, {
 *     contextData: undefined,
 *     ...integrateHandlerOptions(context),
 *   })
 * }
 * ```
 *
 * @param context A Fresh context.
 * @returns Options for the {@link Federation.handle} method.
 */
export function integrateHandlerOptions(
  context: FreshContext,
): Omit<FederationHandlerParameters<void>, "contextData"> {
  return {
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
  };
}

/**
 * Create a Fresh middleware handler to integrate with the {@link Federation}
 * object.
 *
 * @example _middleware.ts
 * ``` typescript
 * import { federation } from "federation.ts"; // Import the `Federation` object
 *
 * export const handler = integrateHandler(federation, () => undefined);
 * ```
 *
 * @typeParam TContextData A type of the context data for the {@link Federation}
 *                         object.
 * @typeParam TFreshContext A type of the Fresh context.
 * @param federation A {@link Federation} object to integrate with Fresh.
 * @param createContextData A function to create a context data for the
 *                          {@link Federation} object.
 * @returns A Fresh middleware handler.
 */
export function integrateHandler<
  TContextData,
  TFreshContext extends FreshContext,
>(
  federation: Federation<TContextData>,
  createContextData: (
    req: Request,
    ctx: TFreshContext,
  ) => TContextData | Promise<TContextData>,
): (req: Request, ctx: TFreshContext) => Promise<Response> {
  return async (
    request: Request,
    context: TFreshContext,
  ): Promise<Response> => {
    let contextData = createContextData(request, context);
    if (contextData instanceof Promise) contextData = await contextData;
    return await federation.handle(request, {
      contextData,
      ...integrateHandlerOptions(context),
    });
  };
}
