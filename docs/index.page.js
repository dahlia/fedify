import { join } from "jsr:@std/path@^0.218.2";

export const title = "Fedify";
export const doc_title = "Fedify: a fediverse server framework";
export const nav_order = 1;

export default function (_, filters) {
  const readme = Deno.readTextFileSync(
    join(import.meta.dirname, "..", "README.md")
  );
  return filters.md(readme);
}
