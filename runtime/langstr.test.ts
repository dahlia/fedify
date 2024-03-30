import { parseLanguageTag } from "@phensley/language-tag";
import { assertEquals } from "@std/assert";
import { LanguageString } from "./langstr.ts";

Deno.test("new LanguageString()", () => {
  const langStr = new LanguageString("Hello", "en");
  assertEquals(langStr.toString(), "Hello");
  assertEquals(langStr.language, parseLanguageTag("en"));

  assertEquals(new LanguageString("Hello", parseLanguageTag("en")), langStr);
});

Deno.test("Deno.inspect(LanguageString)", () => {
  const langStr = new LanguageString("Hello, 'world'", "en");
  assertEquals(
    Deno.inspect(langStr, { colors: false }),
    "<en> \"Hello, 'world'\"",
  );
});
