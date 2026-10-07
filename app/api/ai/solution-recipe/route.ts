import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CONC_UNITS } from "@/lib/chem/units";
import { contextBlock, labContext } from "@/lib/ai/context";
import { RECIPE_INSTRUCTIONS } from "@/lib/ai/prompts";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";

export const maxDuration = 60;

const bodySchema = z.object({ description: z.string().trim().min(3).max(500) });

const component = {
  type: "object",
  additionalProperties: false,
  required: ["name", "final", "finalUnit", "source", "mw", "stock", "stockUnit", "note"],
  properties: {
    name: { type: "string" },
    final: { type: "number", description: "Concentración final en la solución" },
    finalUnit: { type: "string", enum: CONC_UNITS },
    source: { type: "string", enum: ["solido", "stock"] },
    mw: { type: ["number", "null"], description: "Peso molecular g/mol de la forma indicada" },
    stock: { type: ["number", "null"] },
    stockUnit: { type: ["string", "null"], enum: [...CONC_UNITS, null] },
    note: { type: ["string", "null"] },
  },
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "final_volume_ml", "ph", "components", "instructions", "warnings"],
  properties: {
    name: { type: "string" },
    final_volume_ml: { type: "number" },
    ph: { type: ["number", "null"] },
    components: { type: "array", items: component },
    instructions: { type: "string" },
    warnings: { type: "string" },
  },
};

const units = z.enum(CONC_UNITS as [string, ...string[]]);
const responseSchema = z.object({
  name: z.string(),
  final_volume_ml: z.number().positive(),
  ph: z.number().nullable(),
  components: z.array(
    z.object({
      name: z.string(),
      final: z.number().nonnegative(),
      finalUnit: units,
      source: z.enum(["solido", "stock"]),
      mw: z.number().positive().nullable(),
      stock: z.number().positive().nullable(),
      stockUnit: units.nullable(),
      note: z.string().nullable(),
    }),
  ),
  instructions: z.string(),
  warnings: z.string(),
});

/**
 * Propone la composición de una solución ("RIPA 100 mL", "PBS 10X 1 L"). Solo concentraciones
 * y pesos moleculares: las cantidades las calcula la app con funciones verificadas.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError("Describe la solución, p. ej. “PBS 10X, 1 L”.");
    await enforceDailyLimit(supabase);

    const ctx = await labContext(supabase);
    const { json } = await structuredCall({
      kind: "receta_solucion",
      userId,
      name: "receta_solucion",
      schema,
      instructions: RECIPE_INSTRUCTIONS,
      input: [contextBlock(ctx.text), `Solución a preparar: ${body.data.description}`]
        .filter(Boolean)
        .join("\n\n"),
    });
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success)
      throw new AiError("La IA regresó una receta inválida. Intenta de nuevo.", 502);

    return NextResponse.json(parsed.data);
  } catch (e) {
    return errorResponse(e);
  }
}
