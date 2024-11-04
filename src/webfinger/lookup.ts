import { getLogger } from "@logtape/logtape";
import {
  getUserAgent,
  type GetUserAgentOptions,
} from "../runtime/docloader.ts";
import type { ResourceDescriptor } from "./jrd.ts";

const logger = getLogger(["fedify", "webfinger", "lookup"]);

/**
 * Options for {@link lookupWebFinger}.
 * @since 1.3.0
 */
export interface LookupWebFingerOptions {
  /**
   * The options for making `User-Agent` header.
   * If a string is given, it is used as the `User-Agent` header value.
   * If an object is given, it is passed to {@link getUserAgent} to generate
   * the `User-Agent` header value.
   */
  userAgent?: GetUserAgentOptions | string;
}

/**
 * Looks up a WebFinger resource.
 * @param resource The resource URL to look up.
 * @param options Extra options for looking up the resource.
 * @returns The resource descriptor, or `null` if not found.
 * @since 0.2.0
 */
export async function lookupWebFinger(
  resource: URL | string,
  options: LookupWebFingerOptions = {},
): Promise<ResourceDescriptor | null> {
  if (typeof resource === "string") resource = new URL(resource);
  let protocol = "https:";
  let server: string;
  if (resource.protocol === "acct:") {
    const atPos = resource.pathname.lastIndexOf("@");
    if (atPos < 0) return null;
    server = resource.pathname.substring(atPos + 1);
    if (server === "") return null;
  } else {
    protocol = resource.protocol;
    server = resource.host;
  }
  let url = new URL(`${protocol}//${server}/.well-known/webfinger`);
  url.searchParams.set("resource", resource.href);
  while (true) {
    logger.debug(
      "Fetching WebFinger resource descriptor from {url}...",
      { url: url.href },
    );
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/jrd+json",
          "User-Agent": typeof options.userAgent === "string"
            ? options.userAgent
            : getUserAgent(options.userAgent),
        },
        redirect: "manual",
      });
    } catch (error) {
      logger.debug(
        "Failed to fetch WebFinger resource descriptor: {error}",
        { url: url.href, error },
      );
      return null;
    }
    if (
      response.status >= 300 && response.status < 400 &&
      response.headers.has("Location")
    ) {
      url = new URL(response.headers.get("Location")!);
      continue;
    }
    if (!response.ok) {
      logger.debug(
        "Failed to fetch WebFinger resource descriptor: {status} {statusText}.",
        {
          url: url.href,
          status: response.status,
          statusText: response.statusText,
        },
      );
      return null;
    }
    try {
      return await response.json() as ResourceDescriptor;
    } catch (e) {
      if (e instanceof SyntaxError) {
        logger.debug(
          "Failed to parse WebFinger resource descriptor as JSON: {error}",
          { error: e },
        );
        return null;
      }
      throw e;
    }
  }
}
