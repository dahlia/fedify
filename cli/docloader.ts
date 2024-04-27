import {
  type DocumentLoader,
  fetchDocumentLoader,
  kvCache,
} from "@fedify/fedify";
import { DenoKvStore } from "@fedify/fedify/x/denokv";
import { join } from "@std/path";
import { getCacheDir } from "./cache.ts";

export async function getDocumentLoader(): Promise<DocumentLoader> {
  const path = join(await getCacheDir(), "kv");
  const kv = new DenoKvStore(await Deno.openKv(path));
  return kvCache({
    kv,
    loader: fetchDocumentLoader,
  });
}
