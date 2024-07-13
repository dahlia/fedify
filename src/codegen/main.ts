import { loadSchemaFiles } from "./schema.ts";
import { generateClasses } from "./class.ts";

export async function main() {
  if (Deno.args.length != 2) {
    if (Deno.args.length < 2) {
      console.error("error: too few arguments");
    } else {
      console.error("error: too many arguments");
    }
    console.error(
      "usage: deno run",
      Deno.mainModule,
      "SCHEMA_DIR RUNTIME_PATH",
    );
    Deno.exit(1);
  }
  const schemaDir = Deno.args[0];
  const runtimePath = Deno.args[1];
  if (!(await Deno.stat(schemaDir)).isDirectory) {
    console.error("error:", schemaDir, "is not a directory");
    Deno.exit(1);
  }
  const types = await loadSchemaFiles(schemaDir);
  const encoder = new TextEncoder();
  for await (const code of generateClasses(types, runtimePath)) {
    await Deno.stdout.write(encoder.encode(code));
  }
}

if (import.meta.main) {
  await main();
}
