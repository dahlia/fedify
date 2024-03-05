import { assertEquals } from "jsr:@std/assert@^0.218.2";
import { parseLanguageTag } from "npm:@phensley/language-tag@1.8.0";
import { LanguageString } from "./langstr.ts";

Deno.test("new LanguageString()", () => {
  const langStr = new LanguageString("Hello", "en");
  assertEquals(langStr.toString(), "Hello");
  assertEquals(langStr.language, parseLanguageTag("en"));

  assertEquals(new LanguageString("Hello", parseLanguageTag("en")), langStr);
});

Deno.test("Deno.inspect(LanguageString)", () => {
  const langStr = new LanguageString("Hello", "en");
  assertEquals(Deno.inspect(langStr, { colors: false }), '<en> "Hello"');
});
