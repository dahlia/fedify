// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Contains the functions {@linkcode accepts}, {@linkcode acceptsEncodings}, and
 * {@linkcode acceptsLanguages} to provide content negotiation capabilities.
 *
 * @module
 */

import { preferredMediaTypes } from "./_negotiation/media_type.ts";

/**
 * Returns an array of media types accepted by the request, in order of
 * preference. If there are no media types supplied in the request, then any
 * media type selector will be returned.
 *
 * @example Usage
 * ```ts
 * import { accepts } from "@std/http/negotiation";
 * import { assertEquals } from "@std/assert";
 *
 * const request = new Request("https://example.com/", {
 *   headers: {
 *     accept:
 *       "text/html, application/xhtml+xml, application/xml;q=0.9, image/webp, *\/*;q=0.8",
 *   },
 * });
 *
 * assertEquals(accepts(request), [
 *   "text/html",
 *   "application/xhtml+xml",
 *   "image/webp",
 *   "application/xml",
 *   "*\/*",
 * ]);
 * ```
 *
 * @param request The request to get the acceptable media types for.
 * @returns An array of acceptable media types.
 */
export function accepts(request: Pick<Request, "headers">): string[];
/**
 * For a given set of media types, return the best match accepted in the
 * request. If no media type matches, then the function returns `undefined`.
 *
 *  @example Usage
 * ```ts
 * import { accepts } from "@std/http/negotiation";
 * import { assertEquals } from "@std/assert";
 *
 * const request = new Request("https://example.com/", {
 *   headers: {
 *     accept:
 *       "text/html, application/xhtml+xml, application/xml;q=0.9, image/webp, *\/*;q=0.8",
 *   },
 * });
 *
 * assertEquals(accepts(request, "text/html", "image/webp"), "text/html");
 * ```
 *
 * @param request The request to get the acceptable media types for.
 * @param types An array of media types to find the best matching one from.
 * @returns The best matching media type, if any match.
 */
export function accepts(
  request: Pick<Request, "headers">,
  ...types: string[]
): string | undefined;
export function accepts(
  request: Pick<Request, "headers">,
  ...types: string[]
): string | string[] | undefined {
  const accept = request.headers.get("accept");
  return types.length
    ? accept ? preferredMediaTypes(accept, types)[0] : types[0]
    : accept
    ? preferredMediaTypes(accept)
    : ["*/*"];
}
