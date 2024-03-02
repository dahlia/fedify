import { dirname, fromFileUrl, join } from "jsr:@std/path@^0.218.2";
import { RemoteDocument } from "../runtime/docloader.ts";

/**
 * A mock of the document loader.  This does not make any actual HTTP requests
 * towards the remote server, but looks up the local fixture files instead.
 *
 * For instance, `mockDocumentLoader("http://example.com/foo/bar")` will look up
 * the file `testing/fixtures/http/example.com/foo/bar` (no suffix) and return
 * its content as the response.
 */
export async function mockDocumentLoader(
  resource: string,
): Promise<RemoteDocument> {
  const url = new URL(resource);
  const path = (url.host + url.pathname).split("/");
  if (url.search) path.push(url.search);
  const filePath = join(
    dirname(fromFileUrl(import.meta.url)),
    "fixtures",
    ...path,
  );

  const content = await Deno.readTextFile(filePath);
  return {
    contextUrl: null,
    document: JSON.parse(content),
    documentUrl: resource,
  };
}
