import { assertEquals } from "jsr:@std/assert@^0.218.2";
import { dirname, join } from "jsr:@std/path@^0.218.2";
import { assertSnapshot } from "jsr:@std/testing@^0.218.2/snapshot";
import { generateClasses, sortTopologically } from "./class.ts";
import { loadSchemaFiles } from "./schema.ts";

Deno.test("sortTopologically()", () => {
  const sorted = sortTopologically({
    "https://example.com/quux": {
      uri: "https://example.com/quux",
      name: "Foo",
      extends: "https://example.com/qux",
      entity: true,
      description: "",
      properties: [],
      defaultContext: {},
    },
    "https://example.com/qux": {
      uri: "https://example.com/qux",
      name: "Foo",
      extends: "https://example.com/bar",
      entity: true,
      description: "",
      properties: [],
      defaultContext: {},
    },
    "https://example.com/baz": {
      uri: "https://example.com/baz",
      name: "Foo",
      extends: "https://example.com/foo",
      entity: true,
      description: "",
      properties: [],
      defaultContext: {},
    },
    "https://example.com/bar": {
      uri: "https://example.com/bar",
      name: "Foo",
      extends: "https://example.com/foo",
      entity: true,
      description: "",
      properties: [],
      defaultContext: {},
    },
    "https://example.com/foo": {
      uri: "https://example.com/foo",
      name: "Foo",
      entity: true,
      description: "",
      properties: [],
      defaultContext: {},
    },
  });
  assertEquals(
    sorted,
    [
      "https://example.com/foo",
      "https://example.com/bar",
      "https://example.com/qux",
      "https://example.com/quux",
      "https://example.com/baz",
    ],
  );
});

Deno.test("generateClasses()", async (t) => {
  const schemaDir = join(dirname(import.meta.dirname!), "vocab");
  const runtimePath = "../runtime/";
  const types = await loadSchemaFiles(schemaDir);
  let entireCode = "";
  for await (const code of generateClasses(types, runtimePath)) {
    entireCode += code;
  }
  await assertSnapshot(t, entireCode);
});
