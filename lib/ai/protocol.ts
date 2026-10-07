// Protocolo (foto, PDF o texto) → propuesta de plantilla (§7.7 "a partir de este protocolo").
// El modelo llena un esquema plano (fácil de cumplir en modo estricto) que aquí se convierte a
// definiciones de campo y se valida con el mismo esquema que usa el editor.
import { z } from "zod";
import { FIELD_TYPES, fieldKey, type TemplateDraft } from "@/lib/templates/editor";
import { fieldDefSchema, type FieldDef } from "@/lib/templates/fields";
import type { JsonSchema } from "@/lib/templates/json-schema";

const nullable = (type: string) => [type, "null"];

export function protocolJsonSchema(opts: {
  sampleTypes: string[];
  icons: string[];
  colors: string[];
}): JsonSchema {
  const field = {
    type: "object",
    additionalProperties: false,
    required: [
      "label",
      "type",
      "required",
      "unit",
      "options",
      "expected_number",
      "expected_text",
      "expected_seconds",
      "sample_type",
      "multiple",
      "role",
      "steps",
      "help",
    ],
    properties: {
      label: { type: "string", description: "Nombre del campo en español" },
      type: { type: "string", enum: FIELD_TYPES },
      required: { type: "boolean" },
      unit: { type: nullable("string"), description: "Unidad, para campos number" },
      options: {
        type: "array",
        items: { type: "string" },
        description: "Opciones para select/multiselect; vacío en los demás",
      },
      expected_number: { type: nullable("number"), description: "Valor del protocolo (number)" },
      expected_text: { type: nullable("string"), description: "Valor del protocolo (text/select)" },
      expected_seconds: {
        type: nullable("integer"),
        description: "Duración del protocolo en segundos (duration)",
      },
      sample_type: { type: nullable("string"), enum: [...opts.sampleTypes, null] },
      multiple: { type: "boolean" },
      role: { type: "string", enum: ["usada", "producida"] },
      steps: {
        type: "array",
        description: "Para type=steps: los pasos en orden con su duración planificada",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "planned_seconds"],
          properties: {
            label: { type: "string" },
            planned_seconds: { type: nullable("integer") },
          },
        },
      },
      help: { type: nullable("string") },
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "name",
      "activity_type",
      "description",
      "icon",
      "color",
      "fields",
      "protocol_text",
      "notes",
    ],
    properties: {
      name: { type: "string", description: "Nombre corto de la plantilla" },
      activity_type: {
        type: "string",
        description: "Clave en minúsculas con guion bajo, p. ej. western_blot",
      },
      description: { type: "string" },
      icon: { type: "string", enum: opts.icons },
      color: { type: "string", enum: opts.colors },
      fields: { type: "array", items: field },
      protocol_text: {
        type: "string",
        description: "Texto completo del protocolo, transcrito y ordenado (con pasos numerados)",
      },
      notes: {
        type: "string",
        description: "Una o dos líneas para el usuario: partes ilegibles, supuestos, qué revisar",
      },
    },
  };
}

const flatField = z.object({
  label: z.string(),
  type: z.enum(FIELD_TYPES as [string, ...string[]]),
  required: z.boolean(),
  unit: z.string().nullable(),
  options: z.array(z.string()),
  expected_number: z.number().nullable(),
  expected_text: z.string().nullable(),
  expected_seconds: z.number().int().nullable(),
  sample_type: z.string().nullable(),
  multiple: z.boolean(),
  role: z.enum(["usada", "producida"]),
  steps: z.array(z.object({ label: z.string(), planned_seconds: z.number().int().nullable() })),
  help: z.string().nullable(),
});

export const protocolResponseSchema = z.object({
  name: z.string(),
  activity_type: z.string(),
  description: z.string(),
  icon: z.string(),
  color: z.string(),
  fields: z.array(flatField),
  protocol_text: z.string(),
  notes: z.string(),
});
export type ProtocolResponse = z.infer<typeof protocolResponseSchema>;

/** Convierte un campo plano a FieldDef; null si no se puede (se descarta y se avisa). */
function toFieldDef(f: z.infer<typeof flatField>, key: string): FieldDef | null {
  const base = {
    key,
    label: f.label.trim(),
    required: f.required,
    ...(f.help?.trim() ? { help: f.help.trim() } : {}),
  };
  const options = [...new Set(f.options.map((o) => o.trim()).filter(Boolean))];
  let def: unknown;
  switch (f.type) {
    case "number":
      def = {
        ...base,
        type: "number",
        ...(f.unit ? { unit: f.unit } : {}),
        ...(f.expected_number != null ? { expected: f.expected_number } : {}),
      };
      break;
    case "duration":
      def = {
        ...base,
        type: "duration",
        ...(f.expected_seconds != null ? { expected: Math.max(0, f.expected_seconds) } : {}),
      };
      break;
    case "text":
      def = { ...base, type: "text", ...(f.expected_text ? { expected: f.expected_text } : {}) };
      break;
    case "select":
      if (!options.length) return null;
      def = {
        ...base,
        type: "select",
        options,
        ...(f.expected_text && options.includes(f.expected_text)
          ? { expected: f.expected_text }
          : {}),
      };
      break;
    case "multiselect":
      if (!options.length) return null;
      def = { ...base, type: "multiselect", options };
      break;
    case "sample_ref":
      def = {
        ...base,
        type: "sample_ref",
        sample_type: f.sample_type ?? "otro",
        multiple: f.multiple,
        role: f.role,
      };
      break;
    case "reagent":
      def = { ...base, type: "reagent", multiple: f.multiple };
      break;
    case "steps": {
      const steps = f.steps
        .filter((s) => s.label.trim())
        .map((s) => ({
          label: s.label.trim(),
          ...(s.planned_seconds != null ? { planned_seconds: Math.max(0, s.planned_seconds) } : {}),
        }));
      def = { ...base, type: "steps", expected: steps };
      break;
    }
    default:
      def = { ...base, type: f.type };
  }
  const parsed = fieldDefSchema.safeParse(def);
  return parsed.success ? parsed.data : null;
}

/** Respuesta del modelo → borrador para el editor (+ cuántos campos se descartaron). */
export function protocolToDraft(
  r: ProtocolResponse,
  sources: string[],
): { draft: TemplateDraft; dropped: number } {
  const keys: string[] = [];
  let dropped = 0;
  const fields: FieldDef[] = [];
  for (const f of r.fields) {
    if (!f.label.trim()) {
      dropped++;
      continue;
    }
    const key = fieldKey(f.label, keys);
    const def = toFieldDef(f, key);
    if (def) {
      keys.push(key);
      fields.push(def);
    } else dropped++;
  }
  return {
    draft: {
      name: r.name.trim(),
      activity_type: fieldKey(r.activity_type || r.name, []),
      description: r.description.trim(),
      icon: r.icon,
      color: r.color,
      fields,
      protocol_notes: r.protocol_text.trim(),
      protocol_sources: sources,
    },
    dropped,
  };
}
