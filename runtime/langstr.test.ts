import { assertEquals } from "jsr:@std/assert@^0.218.2";
import { LanguageString } from "./langstr.ts";

Deno.test("Deno.inspect(LanguageString)", () => {
  const langStr = new LanguageString("Hello", "en");
  assertEquals(Deno.inspect(langStr, { colors: false }), '<en> "Hello"');
});
