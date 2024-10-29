import { highlight } from "cli-highlight";

export function printJson(json: unknown): void {
  const formatted = JSON.stringify(json, null, 2);
  console.log(highlight(formatted, { language: "json" }));
}
