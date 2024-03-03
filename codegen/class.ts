import { generateDecoder, generateEncoder } from "./codec.ts";
import { generateCloner, generateConstructor } from "./constructor.ts";
import { generateFields } from "./field.ts";
import { generateInspector } from "./inspector.ts";
import { generateProperties } from "./property.ts";
import { TypeSchema } from "./schema.ts";

/**
 * Sorts the given types topologically so that the base types come before the
 * extended types.
 * @param types The types to sort.
 * @returns The sorted type URIs.
 */
export function sortTopologically(types: Record<string, TypeSchema>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  for (const node of Object.values(types)) {
    visit(node);
  }
  return sorted;

  function visit(node: TypeSchema) {
    if (visited.has(node.uri)) return;
    if (visiting.has(node.uri)) {
      throw new Error(`Detected cyclic inheritance: ${node.uri}`);
    }
    visiting.add(node.uri);
    if (node.extends) visit(types[node.extends]);
    visiting.delete(node.uri);
    visited.add(node.uri);
    sorted.push(node.uri);
  }
}

async function* generateClass(
  typeUri: string,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const type = types[typeUri];
  yield `/** ${type.description.replaceAll("\n", "\n * ")}\n */\n`;
  if (type.extends) {
    const baseType = types[type.extends];
    yield `export class ${type.name} extends ${baseType.name} {\n`;
  } else {
    yield `export class ${type.name} {\n`;
  }
  if (type.extends == null) {
    yield "readonly id: URL | null;\n";
  }
  for await (const code of generateFields(typeUri, types)) yield code;
  for await (const code of generateConstructor(typeUri, types)) yield code;
  for await (const code of generateCloner(typeUri, types)) yield code;
  for await (const code of generateProperties(typeUri, types)) yield code;
  for await (const code of generateEncoder(typeUri, types)) yield code;
  for await (const code of generateDecoder(typeUri, types)) yield code;
  for await (const code of generateInspector(typeUri, types)) yield code;
  yield "}\n\n";
}

/**
 * Generates the TypeScript classes from the given types.
 * @param types The types to generate classes from.
 * @returns The source code of the generated classes.
 */
export async function* generateClasses(
  types: Record<string, TypeSchema>,
  runtimePath: string,
): AsyncIterable<string> {
  runtimePath = runtimePath.replace(/\/+$/, "");
  yield "// deno-lint-ignore-file ban-unused-ignore\n";
  yield 'import { Temporal } from "npm:@js-temporal/polyfill@^0.4.4";\n';
  yield 'import jsonld from "npm:jsonld@8.3.2";\n';
  yield `import { LanguageTag, parseLanguageTag }
    from "npm:@phensley/language-tag@1.8.0";\n`;
  yield `import { exportSPKI, importSPKI } from "npm:jose@5.2.2";\n`;
  yield `import { DocumentLoader, fetchDocumentLoader }
    from "${runtimePath}/docloader.ts";\n`;
  yield `import { LanguageString } from "${runtimePath}/langstr.ts";\n`;
  yield "\n\n";
  const sorted = sortTopologically(types);
  for (const typeUri of sorted) {
    for await (const code of generateClass(typeUri, types)) yield code;
  }
}
