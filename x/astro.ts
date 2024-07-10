/**
 * Fedify with Astro
 * =================
 *
 * This module contains some utilities for integrating Fedify with
 * the [Astro] framework.
 *
 * [Astro]: https://astro.build/
 *
 * @module
 * @since 0.12.0
 */
import type {
  Federation,
  FederationFetchOptions,
} from "../federation/middleware.ts";

interface AstroContext {
  request: Request;
}
type RewritePayload = string | URL | Request;
type MiddlewareNext = (
  rewritePayload?: RewritePayload,
) => Promise<Response>;
type MiddlewareHandler<TAstroContext extends AstroContext> = (
  context: TAstroContext,
  next: MiddlewareNext,
) => Promise<Response> | Response | Promise<void> | void;

/**
 * Create options for the {@link Federation.fetch} method to integrate with
 * Astro.
 *
 * @example src/middleware.ts
 * ``` typescript
 * import { defineMiddleware } from "astro:middleware";
 * import { federation } from "./federation";  // Import the `Federation` object
 *
 * export const onRequest = defineMiddleware((context, next) => {
 *   return federation.fetch(context.request, {
 *     contextData: undefined,
 *     ...createFetchOptions(context, next),
 *   });
 * });
 * ```
 *
 * @typeParam TAstroContext A type of the Astro context.
 * @param context An Astro context.
 * @param next A function to call the next middleware.
 * @returns Options for the {@link Federation.fetch} method.
 * @since 0.12.0
 */
export function createFetchOptions<TAstroContext extends AstroContext>(
  _context: TAstroContext,
  next: MiddlewareNext,
): Omit<FederationFetchOptions<void>, "contextData"> {
  return {
    // If the `federation` object finds a request not responsible for it
    // (i.e., not a federation-related request), it will call the `next`
    // provided by the Astro framework to continue the request handling
    // by Astro:
    onNotFound: next,

    // Similar to `onNotFound`, but slightly more tricky one.
    // When the `federation` object finds a request not acceptable type-wise
    // (i.e., a user-agent doesn't want JSON-LD), it will call the `next`
    // provided by the Astro framework so that it renders HTML if there's some
    // page.  Otherwise, it will simply return a 406 Not Acceptable response.
    // This kind of trick enables the Fedify and Astro to share the same routes
    // and they do content negotiation depending on `Accept` header:
    async onNotAcceptable(_request: Request) {
      const response = await next();
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
 * The factory function to create a context data for
 * the {@link Federation.fetch}.
 *
 * @typeParam TContextData A type of the context data.
 * @typeParam TAstroContext A type of the Astro context.
 * @param context An Astro context.
 * @returns The context data for the {@link Federation.fetch}.
 * @since 0.12.0
 */
export type ContextDataFactory<
  TContextData,
  TAstroContext extends AstroContext,
> = (
  context: TAstroContext,
) => TContextData | Promise<TContextData>;

/**
 * Create an Astro middleware handler to integrate with the {@link Federation}
 * object.
 *
 * @example src/middleware.ts
 * ``` typescript
 * import type { MiddlewareHandler } from "astro";
 * import { federation } from "./federation";  // Import the `Federation` object
 *
 * export const onRequest: MiddlewareHandler = createMiddleware(
 *   federation,
 *   (astroContext) => "context data",
 * );
 * ```
 *
 * @typeParam TContextData A type of the context data for the {@link Federation}
 *                         object.
 * @typeParam TAstroContext A type of the Astro context.
 * @param federation A {@link Federation} object to integrate with Astro.
 * @param contextDataFactory A factory function to create a context data for the
 *                           {@link Federation} object.
 * @returns An Astro middleware handler.
 * @since 0.12.0
 */
export function createMiddleware<
  TContextData,
  TAstroContext extends AstroContext,
>(
  federation: Federation<TContextData>,
  contextDataFactory: ContextDataFactory<TContextData, TAstroContext>,
): MiddlewareHandler<TAstroContext> {
  return async (context, next) => {
    const contextData = await contextDataFactory(context);
    return await federation.fetch(context.request, {
      contextData,
      ...createFetchOptions(context, next),
    });
  };
}
