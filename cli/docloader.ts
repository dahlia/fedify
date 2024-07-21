import {
  type DocumentLoader,
  fetchDocumentLoader,
  kvCache,
} from "@fedify/fedify";
import { DenoKvStore } from "@fedify/fedify/x/denokv";
import { join } from "@std/path";
import { getCacheDir } from "./cache.ts";

let documentLoader: DocumentLoader | undefined = undefined;

export async function getDocumentLoader(): Promise<DocumentLoader> {
  if (documentLoader) return documentLoader;
  const path = join(await getCacheDir(), "kv");
  const kv = new DenoKvStore(await Deno.openKv(path));
  return documentLoader = kvCache({
    kv,
    rules: [
      [
        new URLPattern({
          protocol: "http{s}?",
          hostname: "localhost",
          port: "*",
          pathname: "/*",
          search: "*",
          hash: "*",
        }),
        Temporal.Duration.from({ seconds: 0 }),
      ],
      [
        new URLPattern({
          protocol: "http{s}?",
          hostname: "127.0.0.1",
          port: "*",
          pathname: "/*",
          search: "*",
          hash: "*",
        }),
        Temporal.Duration.from({ seconds: 0 }),
      ],
      [
        new URLPattern({
          protocol: "http{s}?",
          hostname: "\\[\\:\\:1\\]",
          port: "*",
          pathname: "/*",
          search: "*",
          hash: "*",
        }),
        Temporal.Duration.from({ seconds: 0 }),
      ],
    ],
    loader(url) {
      return fetchDocumentLoader(url, true);
    },
  });
}

export function getContextLoader(): Promise<DocumentLoader> {
  return getDocumentLoader();
}
