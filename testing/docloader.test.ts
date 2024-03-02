import { assertEquals } from "jsr:@std/assert@^0.218.2";
import { mockDocumentLoader } from "./docloader.ts";

Deno.test("mockDocumentLoader()", async () => {
  const response = await mockDocumentLoader("https://example.com/test");
  assertEquals(await response.document, {
    "https://example.com/prop/test": {
      "@value": "foo",
    },
  });
});
