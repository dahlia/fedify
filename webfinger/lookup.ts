import { getLogger } from "@logtape/logtape";
import type { ResourceDescriptor } from "./jrd.ts";

const logger = getLogger(["fedify", "webfinger", "lookup"]);

/**
 * Looks up a WebFinger resource.
 * @param resource The resource URL to look up.
 * @returns The resource descriptor, or `null` if not found.
 * @since 0.2.0
 */
export async function lookupWebFinger(
  resource: URL | string,
): Promise<ResourceDescriptor | null> {
  if (typeof resource === "string") resource = new URL(resource);
  let server: string;
  if (resource.protocol === "acct:") {
    const atPos = resource.pathname.lastIndexOf("@");
    if (atPos < 0) return null;
    server = resource.pathname.substring(atPos + 1);
    if (server === "") return null;
  } else {
    server = resource.hostname;
  }
  let url = new URL(`https://${server}/.well-known/webfinger`);
  url.searchParams.set("resource", resource.href);
  while (true) {
    logger.debug(
      "Fetching WebFinger resource descriptor from {url}...",
      { url: url.href },
    );
    const response = await fetch(url, {
      headers: { Accept: "application/jrd+json" },
      redirect: "manual",
    });
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
