import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { mockDocumentLoader } from "./docloader.ts";

Deno.test("mockDocumentLoader()", async () => {
  const response = await mockDocumentLoader("https://example.com/test");
  assertEquals(await response.document, {
    "https://example.com/prop/test": {
      "@value": "foo",
    },
  });
});
