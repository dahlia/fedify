import type { ResourceDescriptor } from "./jrd.ts";

/**
 * Looks up a WebFinger resource.
 * @param resource The resource URL to look up.
 * @returns The resource descriptor, or `null` if not found.
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
    if (!response.ok) return null;
    try {
      return await response.json();
    } catch (e) {
      if (e instanceof SyntaxError) return null;
      throw e;
    }
  }
}
