import { getFieldName } from "./field.ts";
import type { PropertySchema, TypeSchema } from "./schema.ts";
import { areAllScalarTypes, getTypeNames } from "./type.ts";

function generateParameterType(
  property: PropertySchema,
  types: Record<string, TypeSchema>,
): string {
  const range = property.range;
  const scalar = areAllScalarTypes(range, types);
  const code: string[] = [];
  if (property.functional || property.singularAccessor) {
    if (scalar) {
      code.push(
        `${property.singularName}?: ${getTypeNames(range, types)} | null;`,
      );
    } else {
      code.push(
        `${property.singularName}?: ${
          getTypeNames(range, types)
        } | URL | null;`,
      );
    }
  }
  if (!property.functional) {
    if (scalar) {
      code.push(
        `${property.pluralName}?: ${getTypeNames(range, types, true)}[];`,
      );
    } else {
      code.push(
        `${property.pluralName}?: (${getTypeNames(range, types)} | URL)[];`,
      );
    }
  }
  return code.join("\n");
}

async function* generateParametersType(
  typeUri: string,
  types: Record<string, TypeSchema>,
  parentheses = true,
): AsyncIterable<string> {
  const type = types[typeUri];
  if (parentheses) yield "{\n";
  if (type.extends == null) {
    yield `id?: URL | null;\n`;
  } else {
    for await (
      const code of generateParametersType(type.extends, types, false)
    ) {
      yield code;
    }
  }
  for (const property of type.properties) {
    yield generateParameterType(property, types);
  }
  if (parentheses) yield "}\n";
}

export async function* generateConstructor(
  typeUri: string,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const type = types[typeUri];
  yield `
  /**
   * Constructs a new instance of ${type.name} with the given values.
   * @param values The values to initialize the instance with.
   * @param options The options to use for initialization.
   */
  constructor(
    values:
  `;
  for await (const code of generateParametersType(typeUri, types)) yield code;
  yield `,
    {
      documentLoader,
      contextLoader,
    }: {
      documentLoader?: DocumentLoader,
      contextLoader?: DocumentLoader,
    } = {},
  ) {
  `;
  if (type.extends == null) {
    yield `
    this.#documentLoader = documentLoader;
    this.#contextLoader = contextLoader;
    this.id = values.id ?? null;
    `;
  } else {
    yield "super(values, { documentLoader, contextLoader });";
  }
  for (const property of type.properties) {
    const fieldName = await getFieldName(property.uri);
    if (property.functional || property.singularAccessor) {
      yield `
        if ("${property.singularName}" in values && \
            values.${property.singularName} != null) {
          this.${fieldName} = [values.${property.singularName}];
        }
      `;
    }
    if (!property.functional) {
      yield `
        if ("${property.pluralName}" in values && \
            values.${property.pluralName} != null) {
      `;
      if (property.singularAccessor) {
        yield `
          if ("${property.singularName}" in values &&
              values.${property.singularName} != null) {
            throw new TypeError(
              "Cannot initialize both ${property.singularName} and " +
                "${property.pluralName} at the same time.",
            );
          }
        `;
      }
      yield `
          this.${fieldName} = values.${property.pluralName};
        }
      `;
    }
  }
  yield "}\n";
}

export async function* generateCloner(
  typeUri: string,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const type = types[typeUri];
  yield `
  /**
   * Clones this instance, optionally updating it with the given values.
   * @param values The values to update the clone with.
   * @options The options to use for cloning.
   * @returns The cloned instance.
   */
  clone(
    values:
  `;
  for await (const code of generateParametersType(typeUri, types)) yield code;
  yield `
    = {},
    options: {
      documentLoader?: DocumentLoader,
      contextLoader?: DocumentLoader,
    } = {}
  ): ${type.name} {
  `;
  if (type.extends == null) {
    yield `
    // @ts-ignore: this.constructor is not recognized as a constructor, but it is.
    const clone: ${type.name} = new this.constructor({ id: values.id }, options);
    `;
  } else {
    yield `const clone = super.clone(values, options) as unknown as ${type.name};`;
  }
  for (const property of type.properties) {
    const fieldName = await getFieldName(property.uri);
    yield `clone.${fieldName} = this.${fieldName};`;
    if (property.functional || property.singularAccessor) {
      yield `
        if ("${property.singularName}" in values && \
            values.${property.singularName} != null) {
          clone.${fieldName} = [values.${property.singularName}];
        }
      `;
    }
    if (!property.functional) {
      yield `
        if ("${property.pluralName}" in values && \
            values.${property.pluralName} != null) {
      `;
      if (property.singularAccessor) {
        yield `
          if ("${property.singularName}" in values &&
              values.${property.singularName} != null) {
            throw new TypeError(
              "Cannot update both ${property.singularName} and " +
                "${property.pluralName} at the same time.",
            );
          }
        `;
      }
      yield `
          clone.${fieldName} = values.${property.pluralName};
        }
      `;
    }
  }
  yield `
    return clone;
  }
  `;
}
