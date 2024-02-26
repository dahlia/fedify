import { generateField, getFieldName } from "./field.ts";
import { TypeSchema } from "./schema.ts";
import {
  areAllScalarTypes,
  getDecoder,
  getDecoders,
  getEncoders,
  getSubtypes,
} from "./type.ts";

export async function* generateEncoder(
  typeUri: string,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const type = types[typeUri];
  yield `
  /**
   * Converts this object to a JSON-LD structure.
   * @returns The JSON-LD representation of this object.
   */
  async toJsonLd(options: {
    expand?: boolean,
    documentLoader?: DocumentLoader
  } = {}): Promise<unknown> {
    options = {
      ...options,
      documentLoader: options.documentLoader ?? fetchDocumentLoader,
    };
    let array: unknown[];
  `;
  if (type.extends == null) {
    yield "const values: Record<string, unknown[] | string> = {};";
  } else {
    yield `
    const baseValues = await super.toJsonLd({
      ...options,
      expand: true,
    }) as unknown[];
    const values = baseValues[0] as Record<string, unknown[] | string>;
    `;
  }
  for (const property of type.properties) {
    yield `
    array = [];
    for (const v of this.${await getFieldName(property.uri)}) {
      array.push(
    `;
    if (!areAllScalarTypes(property.range, types)) {
      yield 'v instanceof URL ? { "@id": v.href } : ';
    }
    for (const code of getEncoders(property.range, types, "v")) yield code;
    yield `
      );
    }
    if (array.length > 0) values[${JSON.stringify(property.uri)}] = array;
    `;
  }
  yield `
    values["@type"] = [${JSON.stringify(type.uri)}];
    if (this.id) values["@id"] = this.id.href;
    if (options.expand) {
      return await jsonld.expand(values, options);
    }
    return await jsonld.compact(
      values,
      ${JSON.stringify(type.defaultContext)},
      options
    );
  }
  `;
}

export async function* generateDecoder(
  typeUri: string,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const type = types[typeUri];
  yield `
  /**
   * Converts a JSON-LD structure to an object of this type.
   * @param json The JSON-LD structure to convert.
   * @returns The object of this type.
   */
  static async fromJsonLd(
    json: unknown,
    options: { documentLoader?: DocumentLoader } = {}
  ): Promise<${type.name}> {
    options = {
      ...options,
      documentLoader: options.documentLoader ?? fetchDocumentLoader,
    };
    const expanded = await jsonld.expand(json, options);
    const values = expanded[0] as (Record<string, any[]> & { "@id"?: string });
  `;
  const subtypes = getSubtypes(typeUri, types, true);
  if (subtypes.length > 0) {
    yield 'if ("@type" in values) {\n';
    for (const subtypeUri of subtypes) {
      yield `
      if (values["@type"].includes(${JSON.stringify(subtypeUri)})) {
        delete values["@type"];
        return await ${types[subtypeUri].name}.fromJsonLd(values, options);
      }
      `;
    }
    yield `
      if (!values["@type"].includes(${JSON.stringify(typeUri)})) {
        throw new TypeError("Invalid type: " + values["@type"]);
      }
    }
    `;
  }
  if (type.extends == null) {
    yield `
    const instance = new this({
      id: "@id" in values ? new URL(values["@id"] as string) : undefined,
    });
    `;
  } else {
    yield `
    const instance = await super.fromJsonLd(values, options);
    if (!(instance instanceof ${type.name})) {
      throw new TypeError("Unexpected type: " + instance.constructor.name);
    }
    `;
  }
  for (const property of type.properties) {
    const variable = await getFieldName(property.uri, "");
    yield await generateField(property, types, "const ");
    yield `
    for (const v of values[${JSON.stringify(property.uri)}] ?? []) {
      if (v == null) continue;
    `;
    if (!areAllScalarTypes(property.range, types)) {
      yield `
      if (typeof v === "object" && "@id" in v && !("@type" in v)
          && globalThis.Object.keys(v).length === 1) {
        ${variable}.push(new URL(v["@id"]));
        continue;
      }
      `;
    }
    if (property.range.length == 1) {
      yield `${variable}.push(${getDecoder(property.range[0], types, "v")})`;
    } else {
      yield `
      const decoded =
      `;
      for (const code of getDecoders(property.range, types, "v")) yield code;
      yield `
      ;
      if (typeof decoded === "undefined") continue;
      ${variable}.push(decoded);
      `;
    }
    yield `
    }
    instance.${await getFieldName(property.uri)} = ${variable};
    `;
  }
  yield `
    return instance;
  }
  `;
}
