import { z } from "zod";
import type { FieldDef } from "@/lib/templates/fields";
import { fieldsToJsonSchema, type JsonSchema } from "@/lib/templates/json-schema";
import { fieldsToZod } from "@/lib/templates/values";

// Salidas estructuradas de la IA (§7.2 y §7.5). El JSON Schema va al modelo (modo estricto) y
// el esquema Zod valida la respuesta antes de guardarla o mostrarla.

const nullableText = (description: string) => ({ type: ["string", "null"], description });

const keyReason = {
  type: "object",
  additionalProperties: false,
  required: ["key", "reason"],
  properties: {
    key: { type: "string", description: "Clave del campo" },
    reason: { type: "string", description: "Por qué es dudoso, en una línea" },
  },
};

const deviation = {
  type: "object",
  additionalProperties: false,
  required: ["key", "expected", "actual"],
  properties: {
    key: { type: "string" },
    expected: { type: "string", description: "Valor del protocolo" },
    actual: { type: "string", description: "Valor registrado" },
  },
};

/** Respuesta de "llenar plantilla" (§7.2). */
export function fillResponseJsonSchema(fields: FieldDef[]): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "fields",
      "objective",
      "observations",
      "results",
      "next_steps",
      "samples_mentioned",
      "uncertain",
      "deviations",
    ],
    properties: {
      fields: fieldsToJsonSchema(fields),
      objective: nullableText("Objetivo de la actividad, si se dijo"),
      observations: nullableText("Observaciones durante la actividad"),
      results: nullableText("Resultados"),
      next_steps: nullableText("Siguiente paso"),
      samples_mentioned: {
        type: "array",
        items: { type: "string" },
        description: "Códigos de muestra mencionados, tal como se dijeron",
      },
      uncertain: { type: "array", items: keyReason },
      deviations: { type: "array", items: deviation },
    },
  };
}

export function fillResponseSchema(fields: FieldDef[]) {
  return z.object({
    fields: fieldsToZod(fields),
    objective: z.string().nullable(),
    observations: z.string().nullable(),
    results: z.string().nullable(),
    next_steps: z.string().nullable(),
    samples_mentioned: z.array(z.string()),
    uncertain: z.array(z.object({ key: z.string(), reason: z.string() })),
    deviations: z.array(z.object({ key: z.string(), expected: z.string(), actual: z.string() })),
  });
}

export type FillOutput = {
  fields: Record<string, unknown>;
  objective: string | null;
  observations: string | null;
  results: string | null;
  next_steps: string | null;
  samples_mentioned: string[];
  uncertain: { key: string; reason: string }[];
  deviations: { key: string; expected: string; actual: string }[];
};

/** Respuesta de "sugerir plantilla" (§7.5). `templateIds` limita las opciones a las del usuario. */
export function suggestResponseJsonSchema(templateIds: string[]): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["suggestions", "no_good_match", "proposed_title"],
    properties: {
      suggestions: {
        type: "array",
        description: "Hasta 3 plantillas, de la más a la menos probable",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["template_id", "confidence", "reason"],
          properties: {
            template_id: { type: "string", enum: templateIds },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string", description: "Razón corta en español (una línea)" },
          },
        },
      },
      no_good_match: { type: "boolean", description: "true si ninguna plantilla encaja bien" },
      proposed_title: { type: "string", description: "Título corto para la entrada" },
    },
  };
}

export const suggestResponseSchema = z.object({
  suggestions: z.array(
    z.object({ template_id: z.string(), confidence: z.number().min(0).max(1), reason: z.string() }),
  ),
  no_good_match: z.boolean(),
  proposed_title: z.string(),
});

export type SuggestOutput = z.infer<typeof suggestResponseSchema> & { method: "reglas" | "ia" };
