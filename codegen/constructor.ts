import { getFieldName } from "./field.ts";
import { PropertySchema, TypeSchema } from "./schema.ts";
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
      code.push(`{
        ${property.singularName}?: ${getTypeNames(range, types)} | null 
      }`);
    } else {
      code.push(`{
        ${property.singularName}?: ${getTypeNames(range, types)} | URL | null 
      }`);
    }
  }
  if (!property.functional) {
    if (scalar) {
      code.push(`{
        ${property.singularName}?: undefined;
        ${property.pluralName}?: ${getTypeNames(range, types, true)}[]
      }`);
    } else {
      code.push(`{
        ${property.singularName}?: undefined;
        ${property.pluralName}?: (${getTypeNames(range, types)} | URL)[]
      }`);
    }
  }
  return code.join(" | ");
}

async function* generateParametersType(
  typeUri: string,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const type = types[typeUri];
  if (type.extends == null) {
    yield `{ id?: URL | null }`;
  } else {
    for await (const code of generateParametersType(type.extends, types)) {
      yield code;
    }
  }
  for (const property of type.properties) {
    yield " & (";
    yield generateParameterType(property, types);
    yield ")";
  }
}

export async function* generateConstructor(
  typeUri: string,
  types: Record<string, TypeSchema>,
): AsyncIterable<string> {
  const type = types[typeUri];
  yield `constructor(values: `;
  for await (const code of generateParametersType(typeUri, types)) yield code;
  yield ") {\n";
  if (type.extends == null) {
    yield "this.id = values.id ?? null;";
  } else {
    yield "super(values);";
  }
  for (const property of type.properties) {
    if (property.functional || property.singularAccessor) {
      yield `
        if ("${property.singularName}" in values && \
            values.${property.singularName} != null) {
          this.${await getFieldName(property.uri)} =
            [values.${property.singularName}];
        }
      `;
    }
    if (!property.functional) {
      yield `
        if ("${property.pluralName}" in values && \
            values.${property.pluralName} != null) {
          this.${await getFieldName(property.uri)} =
            values.${property.pluralName};
        }
      `;
    }
  }
  yield "}\n";
}
