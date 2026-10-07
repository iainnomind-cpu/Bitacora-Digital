import { REAGENT_PARTS, sampleTypeLabel, type FieldDef } from "./fields";

// JSON Schema de los campos de una plantilla para "structured outputs" del modelo de texto
// (§7.2). Sigue las reglas del modo estricto: todas las propiedades en `required`,
// `additionalProperties: false` y la ausencia de un dato se expresa con null.

export type JsonSchema = { [key: string]: unknown };

const nullable = (type: string) => [type, "null"];

function describe(field: FieldDef, extra?: string) {
  const parts = [field.label];
  if ("unit" in field && field.unit) parts.push(`en ${field.unit}`);
  if (extra) parts.push(extra);
  if (field.help) parts.push(field.help);
  return `${parts.join(". ")}. null si no se mencionó.`;
}

const reagentObject: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: REAGENT_PARTS.map((p) => p.key),
  properties: Object.fromEntries(
    REAGENT_PARTS.map((p) => [p.key, { type: nullable("string"), description: p.label }]),
  ),
};

const stepObject: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "planned_seconds", "actual_seconds", "note"],
  properties: {
    label: { type: "string", description: "Nombre del paso" },
    planned_seconds: { type: nullable("integer"), description: "Duración planificada en segundos" },
    actual_seconds: { type: nullable("integer"), description: "Duración real en segundos" },
    note: { type: nullable("string"), description: "Nota del paso" },
  },
};

export function fieldJsonSchema(field: FieldDef): JsonSchema {
  switch (field.type) {
    case "text":
    case "longtext":
      return { type: nullable("string"), description: describe(field) };
    case "number":
      return { type: nullable("number"), description: describe(field) };
    case "duration":
      return { type: nullable("integer"), description: describe(field, "Duración en segundos") };
    case "datetime":
      return {
        type: nullable("string"),
        description: describe(field, "Fecha y hora ISO 8601 con zona horaria"),
      };
    case "time":
      return {
        type: nullable("string"),
        pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
        description: describe(field, "Hora HH:MM (24 h)"),
      };
    case "select":
      return {
        type: nullable("string"),
        enum: [...field.options, null],
        description: describe(field),
      };
    case "multiselect":
      return {
        type: nullable("array"),
        items: { type: "string", enum: field.options },
        description: describe(field),
      };
    case "boolean":
      return { type: nullable("boolean"), description: describe(field) };
    case "rating":
      return {
        type: nullable("integer"),
        minimum: 1,
        maximum: 5,
        description: describe(field, "Calidad del 1 (mala) al 5 (excelente)"),
      };
    case "sample_ref": {
      const extra = `Código de ${sampleTypeLabel(field.sample_type).toLowerCase()} tal como se dictó`;
      return field.multiple
        ? {
            type: nullable("array"),
            items: { type: "string" },
            description: describe(field, extra),
          }
        : { type: nullable("string"), description: describe(field, extra) };
    }
    case "reagent":
      return field.multiple
        ? { type: nullable("array"), items: reagentObject, description: describe(field) }
        : { anyOf: [reagentObject, { type: "null" }], description: describe(field) };
    case "steps":
      return { type: nullable("array"), items: stepObject, description: describe(field) };
  }
}

/** Objeto `fields` que debe regresar el modelo al llenar una plantilla. */
export function fieldsToJsonSchema(fields: FieldDef[]): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: fields.map((f) => f.key),
    properties: Object.fromEntries(fields.map((f) => [f.key, fieldJsonSchema(f)])),
  };
}
