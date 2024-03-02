import { join } from "jsr:@std/path@^0.218.2";
import { assertEquals } from "jsr:@std/assert@^0.218.2";
import { toSet } from "https://deno.land/x/aitertools@0.5.0/mod.ts";
import { readDirRecursive } from "./fs.ts";

Deno.test("readDirRecursive()", async () => {
  // Create a temporary directory that has fixtures in it:
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(join(dir, "a"));
  await Deno.writeTextFile(join(dir, "a", "aa.txt"), "aa");
  await Deno.writeTextFile(join(dir, "a", "ab.txt"), "aa");
  await Deno.mkdir(join(dir, "a", "aa"));
  await Deno.writeTextFile(join(dir, "a", "aa", "aaa.txt"), "aaa");
  await Deno.mkdir(join(dir, "b"));
  await Deno.writeTextFile(join(dir, "b", "ba.txt"), "ba");
  await Deno.writeTextFile(join(dir, "b", "bb.txt"), "bb");

  // Read the directory recursively:
  assertEquals(
    await toSet(readDirRecursive(dir)),
    new Set([
      join("a", "aa", "aaa.txt"),
      join("a", "aa.txt"),
      join("a", "ab.txt"),
      join("b", "ba.txt"),
      join("b", "bb.txt"),
    ]),
  );
});
