import { parseLanguageTag } from "@phensley/language-tag";
import { assertEquals } from "@std/assert";
import { test } from "../testing/mod.ts";
import { LanguageString } from "./langstr.ts";

test("new LanguageString()", () => {
  const langStr = new LanguageString("Hello", "en");
  assertEquals(langStr.toString(), "Hello");
  assertEquals(langStr.language, parseLanguageTag("en"));

  assertEquals(new LanguageString("Hello", parseLanguageTag("en")), langStr);
});

test("Deno.inspect(LanguageString)", () => {
  const langStr = new LanguageString("Hello, 'world'", "en");
  assertEquals(
    Deno.inspect(langStr, { colors: false }),
    "<en> \"Hello, 'world'\"",
  );
});
