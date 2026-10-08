// Esquemas para leer soluciones de un protocolo (la IA transcribe; lib/chem/scale.ts calcula)
// y para responder dudas de cálculo.
import { z } from "zod";
import { AMOUNT_UNITS } from "@/lib/chem/scale";
import { CONC_UNITS, VOLUME } from "@/lib/chem/units";
import type { JsonSchema } from "@/lib/templates/json-schema";

const VOLUME_UNITS = Object.keys(VOLUME);
const n = (type: string) => [type, "null"];

export const readRecipeJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["solutions", "general_notes"],
  properties: {
    solutions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "original_volume",
          "original_volume_unit",
          "components",
          "instructions",
          "notes",
        ],
        properties: {
          name: { type: "string" },
          original_volume: { type: n("number") },
          original_volume_unit: { type: n("string"), enum: [...VOLUME_UNITS, null] },
          components: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "name",
                "amount",
                "unit",
                "concentration",
                "concentration_unit",
                "mw",
                "is_solvent",
                "as_written",
              ],
              properties: {
                name: { type: "string" },
                amount: { type: n("number") },
                unit: { type: n("string"), enum: [...AMOUNT_UNITS, null] },
                concentration: { type: n("number") },
                concentration_unit: { type: n("string"), enum: [...CONC_UNITS, null] },
                mw: { type: n("number") },
                is_solvent: { type: "boolean" },
                as_written: { type: "string" },
              },
            },
          },
          instructions: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    general_notes: { type: "string" },
  },
};

const volumeUnit = z.enum(VOLUME_UNITS as [string, ...string[]]);
export const readRecipeSchema = z.object({
  solutions: z.array(
    z.object({
      name: z.string(),
      original_volume: z.number().positive().nullable(),
      original_volume_unit: volumeUnit.nullable(),
      components: z.array(
        z.object({
          name: z.string(),
          amount: z.number().nonnegative().nullable(),
          unit: z.enum(AMOUNT_UNITS as unknown as [string, ...string[]]).nullable(),
          concentration: z.number().nonnegative().nullable(),
          concentration_unit: z.enum(CONC_UNITS as [string, ...string[]]).nullable(),
          mw: z.number().positive().nullable(),
          is_solvent: z.boolean(),
          as_written: z.string(),
        }),
      ),
      instructions: z.string(),
      notes: z.string(),
    }),
  ),
  general_notes: z.string(),
});
export type ReadRecipeOutput = z.infer<typeof readRecipeSchema>;

export const CALC_TOOLS = [
  "molaridad",
  "dilucion",
  "factor",
  "porcentaje",
  "seriada",
  "receta",
  "mezcla",
  "convertir",
] as const;

export const questionJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "steps", "suggested_tool"],
  properties: {
    answer: {
      type: "string",
      description: "Respuesta corta y directa (la cantidad o el resultado)",
    },
    steps: {
      type: "array",
      items: { type: "string" },
      description: "Pasos del cálculo con fórmulas y números",
    },
    suggested_tool: { type: n("string"), enum: [...CALC_TOOLS, null] },
  },
};

export const questionSchema = z.object({
  answer: z.string(),
  steps: z.array(z.string()),
  suggested_tool: z.enum(CALC_TOOLS).nullable(),
});
export type QuestionOutput = z.infer<typeof questionSchema>;
