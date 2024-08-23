import { build, emptyDir } from "@deno/dnt";
import { copy } from "@std/fs";
import { join } from "@std/path";

await emptyDir("./npm");
await emptyDir("./npm/esm/codegen");

const denoJson = join(import.meta.dirname!, "deno.json");
const metadata = JSON.parse(await Deno.readTextFile(denoJson));

const excludedExports = ["./x/denokv", "./x/fresh"];

const entryPoints = Object.entries(metadata.exports as Record<string, string>)
  .map(([name, path]) => ({ name, path }))
  .filter(({ name }) => !excludedExports.includes(name));

const testExports = [];
for (const { name } of entryPoints) {
  const match = name.match(/^\.\/([^/]+)/);
  if (match && match[1] != "x") testExports.push(match[1]);
}

const importMap = ".dnt-import-map.json";
await Deno.writeTextFile(
  importMap,
  JSON.stringify({
    imports: {
      ...metadata.imports,
      "@logtape/logtape": metadata.imports["@logtape/logtape"]
        .replace(/^jsr:/, "npm:"),
      "@hugoalh/http-header-link": metadata.imports["@hugoalh/http-header-link"]
        .replace(/^jsr:/, "npm:"),
    },
  }),
);

await build({
  package: {
    // package.json properties
    name: "@fedify/fedify",
    version: Deno.args[0] ?? metadata.version,
    description: "An ActivityPub server framework",
    keywords: ["ActivityPub", "fediverse"],
    license: "MIT",
    author: {
      name: "Hong Minhee",
      email: "hong@minhee.org",
      url: "https://hongminhee.org/",
    },
    homepage: "https://fedify.dev/",
    repository: {
      type: "git",
      url: "git+https://github.com/dahlia/fedify.git",
    },
    bugs: {
      url: "https://github.com/dahlia/fedify/issues",
    },
    funding: [
      "https://github.com/sponsors/dahlia",
    ],
  },
  outDir: "./npm",
  entryPoints,
  importMap,
  scriptModule: false,
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
      {
        package: {
          name: "@js-temporal/polyfill",
          version: "^0.4.4",
        },
        globalNames: [
          {
            name: "Temporal",
            exportName: "Temporal",
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
  declaration: "separate",
  declarationMap: true,
  test: Deno.env.get("DNT_SKIP_TEST") !== "true",
  compilerOptions: {
    target: "ES2022",
  },
  // deno-lint-ignore no-explicit-any
  filterDiagnostic(diagnostic: any) {
    if (
      diagnostic.file?.fileName.endsWith("2KNRVU.ts")
    ) {
      return false; // ignore all diagnostics in this file
    }
    // etc... more checks here
    return true;
  },
  testPattern: `{${testExports.join(",")}}/**/*.test.ts`,
  async postBuild() {
    await copy(
      "testing/fixtures",
      "npm/esm/testing/fixtures",
      { overwrite: true },
    );
    for await (const entry of Deno.readDir("vocab")) {
      if (!entry.isFile || !entry.name.endsWith(".yaml")) continue;
      await Deno.copyFile(`vocab/${entry.name}`, `npm/esm/vocab/${entry.name}`);
    }
    await Deno.copyFile("codegen/schema.yaml", "npm/esm/codegen/schema.yaml");
    await Deno.copyFile("../CHANGES.md", "npm/CHANGES.md");
    await Deno.copyFile("../FEDERATION.md", "npm/FEDERATION.md");
    await Deno.copyFile("../LICENSE", "npm/LICENSE");
    await Deno.copyFile("../logo.svg", "npm/logo.svg");
    await Deno.copyFile("../README.md", "npm/README.md");
  },
});

await Deno.remove(importMap);

// cSpell: ignore Minhee 2KNRVU
