import { assertEquals } from "https://deno.land/std@0.217.0/assert/mod.ts";
import { LanguageString } from "./langstr.ts";

Deno.test("Deno.inspect(LanguageString)", () => {
  const langStr = new LanguageString("Hello", "en");
  assertEquals(Deno.inspect(langStr, { colors: false }), '<en> "Hello"');
});
