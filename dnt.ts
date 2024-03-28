import { build, emptyDir } from "@deno/dnt";
import { join } from "@std/path";

await emptyDir("./npm");

const denoJson = join(import.meta.dirname!, "deno.json");
const metadata = JSON.parse(await Deno.readTextFile(denoJson));

await build({
  package: {
    // package.json properties
    name: "@fedify/fedify",
    version: Deno.args[0] ?? metadata.version,
    description: "An ActivityPub server framework",
    license: "AGPL-3.0",
    repository: {
      type: "git",
      url: "git+https://github.com/dahlia/fedify.git",
    },
    bugs: {
      url: "https://github.com/dahlia/fedify/issues",
    },
  },
  outDir: "./npm",
  entryPoints: ["./mod.ts"],
  importMap: denoJson,
  shims: {
    deno: true,
    crypto: true,
    custom: [
      {
        package: {
          name: "urlpattern-polyfill",
          version: "~10.0.0",
        },
        globalNames: [
          {
            name: "URLPattern",
            exportName: "URLPattern",
          },
        ],
      },
    ],
    customDev: [
      {
        module: "./shim/event.ts",
        globalNames: ["addEventListener"],
      },
    ],
  },
  typeCheck: "both",
  filterDiagnostic(diagnostic) {
    if (
      diagnostic.file?.fileName.endsWith("2KNRVU.ts")
    ) {
      return false; // ignore all diagnostics in this file
    }
    // etc... more checks here
    return true;
  },
  postBuild() {
    Deno.copyFileSync("CHANGES.md", "npm/CHANGES.md");
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("logo.svg", "npm/logo.svg");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});

// cSpell: ignore 2KNRVU
