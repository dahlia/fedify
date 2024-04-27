import jsonPreserveIndent from "json-preserve-indent";
import metadata from "../../deno.json" with { type: "json" };

const denoJsonPath = `${import.meta.dirname}/../deno.json`;
const denoJson = await Deno.readTextFile(denoJsonPath);
const data = jsonPreserveIndent(denoJson);
data.set("version", metadata.version);
await Deno.writeTextFile(denoJsonPath, data.format());
