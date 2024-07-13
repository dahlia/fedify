import fedifyMetadata from "../../src/deno.json" with { type: "json" };
import cliImportMap from "../import_map.json" with { type: "json" };

const release = Deno.args[0] == "--release";

const fedifyImports = Object.fromEntries(
  Object.entries(fedifyMetadata.exports)
    .map(([k, v]) => [
      k.replace(/^\./, "@fedify/fedify"),
      release
        ? `jsr:${k.replace(/^\./, `@fedify/fedify@^${fedifyMetadata.version}`)}`
        : "../src/" + v,
    ]),
);

const importMap = {
  ...fedifyMetadata.imports,
  ...fedifyImports,
  ...cliImportMap.imports,
};

await Deno.writeTextFile(
  `${import.meta.dirname}/../import_map.g.json`,
  JSON.stringify({ imports: importMap }, null, 2) + "\n",
);
