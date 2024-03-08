import { join } from "jsr:@std/path@^0.218.2";

export const title = "Changelog";
export const doc_title = "Fedify changelog";
export const nav_order = 9;

export default function (_, filters) {
  const changelog = Deno.readTextFileSync(
    join(import.meta.dirname, "..", "CHANGES.md")
  );
  return filters.md(changelog);
}
