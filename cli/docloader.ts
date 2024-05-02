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
    loader: fetchDocumentLoader,
  });
}

export function getContextLoader(): Promise<DocumentLoader> {
  return getDocumentLoader();
}
