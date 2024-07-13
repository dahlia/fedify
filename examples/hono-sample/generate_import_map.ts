import fedifyManifest from "../../src/deno.json" with { type: "json" };

const fedifyImportMap = fedifyManifest.imports;

const blogImportMap = JSON.parse(
  await Deno.readTextFile(`${import.meta.dirname}/import_map.json`),
).imports;

const importMap = { ...fedifyImportMap, ...blogImportMap };

await Deno.writeTextFile(
  `${import.meta.dirname}/import_map.g.json`,
  JSON.stringify({ imports: importMap }, null, 2) + "\n",
);
