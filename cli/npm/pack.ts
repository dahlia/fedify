import { which } from "jsr:@david/which@0.4.1";
import { dirname, join } from "jsr:@std/path@1.0.0";
import denoJson from "../deno.json" with { type: "json" };
import metadataTemplate from "./package.json" with { type: "json" };

async function main() {
  const metadata = {
    ...metadataTemplate,
    name: denoJson.name,
    version: Deno.args.length < 1 ? denoJson.version : Deno.args[0],
    private: false,
  };
  const tempDir = await Deno.makeTempDir();
  console.debug("Working directory:", tempDir);
  await Deno.writeTextFile(
    join(tempDir, "package.json"),
    JSON.stringify(metadata),
  );
  await Deno.copyFile(
    join(import.meta.dirname!, "install.mjs"),
    join(tempDir, "install.mjs"),
  );
  await Deno.copyFile(
    join(import.meta.dirname!, "run.mjs"),
    join(tempDir, "run.mjs"),
  );
  await Deno.copyFile(
    join(dirname(import.meta.dirname!), "README.md"),
    join(tempDir, "README.md"),
  );
  const command = new Deno.Command(await which("npm") ?? "npm", {
    args: ["pack"],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    cwd: tempDir,
  });
  const result = await command.output();
  if (!result.success) Deno.exit(result.code);
  for await (const entry of Deno.readDir(tempDir)) {
    if (entry.isFile && entry.name.endsWith(".tgz")) {
      await Deno.copyFile(join(tempDir, entry.name), entry.name);
      console.log(entry.name);
    }
  }
}

if (import.meta.main) await main();
