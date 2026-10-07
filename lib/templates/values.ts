import { z } from "zod";
import {
  emptyStep,
  reagentSchema,
  stepSchema,
  TIME_PATTERN,
  type FieldDef,
  type Reagent,
} from "./fields";

export type EntryData = Record<string, unknown>;

/**
 * Modo de validación:
 * - "borrador": todo es opcional; solo se revisa que cada valor tenga el tipo correcto.
 * - "cierre": además, los campos `required` no pueden quedar vacíos.
 */
export type ValidationMode = "borrador" | "cierre";

const sampleCode = z.string().trim().min(1, "Escribe un código.");

/** Esquema Zod del valor de un campo (siempre admite null = "no se registró"). */
export function fieldValueSchema(field: FieldDef): z.ZodType {
  switch (field.type) {
    case "text":
    case "longtext":
      return z.string().nullable();
    case "number":
      return z.number({ error: "Debe ser un número." }).finite().nullable();
    case "duration":
      return z.number().int().nonnegative("La duración no puede ser negativa.").nullable();
    case "datetime":
      return z.iso.datetime({ offset: true, error: "Fecha y hora no válidas." }).nullable();
    case "time":
      return z.string().regex(TIME_PATTERN, "Hora no válida (HH:MM).").nullable();
    case "select":
      return z
        .enum(field.options as [string, ...string[]], { error: "Opción no válida." })
        .nullable();
    case "multiselect":
      return z
        .array(z.enum(field.options as [string, ...string[]], { error: "Opción no válida." }))
        .nullable();
    case "boolean":
      return z.boolean().nullable();
    case "rating":
      return z.number().int().min(1, "De 1 a 5.").max(5, "De 1 a 5.").nullable();
    case "sample_ref":
      return field.multiple ? z.array(sampleCode).nullable() : sampleCode.nullable();
    case "reagent":
      return field.multiple ? z.array(reagentSchema).nullable() : reagentSchema.nullable();
    case "steps":
      return z.array(stepSchema).nullable();
  }
}

const isBlankString = (v: unknown) => typeof v === "string" && v.trim() === "";
const isBlankReagent = (r: Reagent) => Object.values(r).every((v) => v == null || isBlankString(v));

/** ¿El valor cuenta como vacío para un campo obligatorio? */
export function isEmptyValue(field: FieldDef, value: unknown): boolean {
  if (value == null || isBlankString(value)) return true;
  if (Array.isArray(value)) {
    if (field.type === "reagent") return value.every((r) => isBlankReagent(r as Reagent));
    if (field.type === "steps") {
      return value.every(
        (s) => s.actual_seconds == null && (s.note == null || isBlankString(s.note)),
      );
    }
    return value.length === 0;
  }
  if (field.type === "reagent") return isBlankReagent(value as Reagent);
  return false;
}

/** Esquema Zod de `entries.data` para una versión de plantilla. */
export function fieldsToZod(fields: FieldDef[], mode: ValidationMode = "borrador") {
  const shape = Object.fromEntries(fields.map((f) => [f.key, fieldValueSchema(f).optional()]));
  return z.object(shape).superRefine((data, ctx) => {
    if (mode !== "cierre") return;
    for (const f of fields) {
      if (f.required && isEmptyValue(f, data[f.key])) {
        ctx.addIssue({ code: "custom", path: [f.key], message: "Este campo es obligatorio." });
      }
    }
  });
}

/** Valida `data` y regresa los errores por clave de campo (vacío si todo está bien). */
export function validateEntryData(
  fields: FieldDef[],
  data: EntryData,
  mode: ValidationMode = "borrador",
): Record<string, string> {
  const result = fieldsToZod(fields, mode).safeParse(data);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Valores iniciales de una entrada nueva: defaults de la plantilla y pasos del protocolo. */
export function initialValues(fields: FieldDef[]): EntryData {
  const data: EntryData = {};
  for (const f of fields) {
    switch (f.type) {
      case "steps":
        data[f.key] = (f.expected ?? []).map((s) => emptyStep(s.label, s.planned_seconds ?? null));
        break;
      case "sample_ref":
      case "reagent":
        data[f.key] = f.multiple ? [] : null;
        break;
      case "multiselect":
        data[f.key] = f.default ?? [];
        break;
      default:
        data[f.key] = "default" in f && f.default !== undefined ? f.default : null;
    }
  }
  return data;
}
