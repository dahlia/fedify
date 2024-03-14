import { toPascalCase } from "@std/text";
import { getFieldName } from "./field.ts";
import { PropertySchema, TypeSchema } from "./schema.ts";
import { areAllScalarTypes, getTypeNames } from "./type.ts";

async function* generateProperty(
  type: TypeSchema,
  property: PropertySchema,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const doc = `\n/** ${property.description.replaceAll("\n", "\n * ")}\n */\n`;
  if (areAllScalarTypes(property.range, types)) {
    if (property.functional || property.singularAccessor) {
      yield doc;
      yield `get ${property.singularName}(): (${
        getTypeNames(property.range, types)
      } | null) {
        if (this.${await getFieldName(property.uri)}.length < 1) return null;
        return this.${await getFieldName(property.uri)}[0];
      }
      `;
    }
    if (!property.functional) {
      yield doc;
      yield `get ${property.pluralName}(): ${
        getTypeNames(property.range, types, true)
      }[] {
        return this.${await getFieldName(property.uri)};
      }
      `;
    }
  } else {
    yield `
    async #fetch${toPascalCase(property.singularName)}(
      url: URL,
      options: {
        documentLoader?: (url: string) => Promise<{
          contextUrl: string | null;
          document: unknown;
          documentUrl: string;
        }>
      } = {}
    ): Promise<${getTypeNames(property.range, types)}> {
      const documentLoader = options.documentLoader ?? fetchDocumentLoader;
      const { document } = await documentLoader(url.href);
    `;
    for (const range of property.range) {
      if (!(range in types)) continue;
      const rangeType = types[range];
      yield `
      try {
        return await ${rangeType.name}.fromJsonLd(document, options);
      } catch (e) {
        if (!(e instanceof TypeError)) throw e;
      }
      `;
    }
    yield `
      throw new TypeError("Expected an object of any type of: " +
        ${JSON.stringify(property.range)}.join(", "));
    }
    `;
    if (property.functional || property.singularAccessor) {
      yield `
      /**
       * Similar to
       * {@link ${type.name}.get${toPascalCase(property.singularName)}},
       * but returns its \`@id\` URL instead of the object itself.
       */
      get ${property.singularName}Id(): URL | null {
        if (this.${await getFieldName(property.uri)}.length < 1) return null;
        const v = this.${await getFieldName(property.uri)}[0];
        if (v instanceof URL) return v;
        return v.id;
      }
      `;
      yield doc;
      yield `
      async get${toPascalCase(property.singularName)}(
        options: {
          documentLoader?: (url: string) => Promise<{
            contextUrl: string | null;
            document: unknown;
            documentUrl: string;
          }>
        } = {}
      ): Promise<${getTypeNames(property.range, types)} | null> {
        if (this.${await getFieldName(property.uri)}.length < 1) return null;
        const v = this.${await getFieldName(property.uri)}[0];
        if (v instanceof URL) {
          const fetched =
            await this.#fetch${toPascalCase(property.singularName)}(v, options);
          this.${await getFieldName(property.uri)}[0] = fetched;
          return fetched;
        }
        return v;
      }
      `;
    }
    if (!property.functional) {
      yield `
      /**
       * Similar to
       * {@link ${type.name}.get${toPascalCase(property.pluralName)}},
       * but returns their \`@id\`s instead of the objects themselves.
       */
      get ${property.singularName}Ids(): URL[] {
        return this.${await getFieldName(property.uri)}.map((v) =>
          v instanceof URL ? v : v.id!
        ).filter(id => id !== null);
      }
      `;
      yield doc;
      yield `
      async* get${toPascalCase(property.pluralName)}(
        options: {
          documentLoader?: (url: string) => Promise<{
            contextUrl: string | null;
            document: unknown;
            documentUrl: string;
          }>
        } = {}
      ): AsyncIterable<${getTypeNames(property.range, types)}> {
        const vs = this.${await getFieldName(property.uri)};
        for (let i = 0; i < vs.length; i++) {
          const v = vs[i];
          if (v instanceof URL) {
            const fetched =
              await this.#fetch${toPascalCase(property.singularName)}(
                v, options);
            vs[i] = fetched;
            yield fetched;
            continue;
          }
          yield v;
        }
      }
      `;
    }
  }
}

export async function* generateProperties(
  typeUri: string,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const type = types[typeUri];
  for (const property of type.properties) {
    yield* generateProperty(type, property, types);
  }
}
