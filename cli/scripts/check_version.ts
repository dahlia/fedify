import parentMetadata from "../../deno.json" with { type: "json" };
import metadata from "../deno.json" with { type: "json" };

if (metadata.version !== parentMetadata.version) {
  console.error(
    `Version mismatch: parent version ${parentMetadata.version} ` +
      `does not match child version ${metadata.version}`,
  );
  Deno.exit(1);
}
