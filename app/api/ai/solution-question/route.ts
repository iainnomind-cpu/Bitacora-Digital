import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { contextBlock, labContext } from "@/lib/ai/context";
import { SOLUTION_QUESTION_INSTRUCTIONS } from "@/lib/ai/prompts";
import { questionJsonSchema, questionSchema } from "@/lib/ai/recipe-read";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";

export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().trim().min(3).max(2000),
  /** Receta leída del protocolo (texto), para que la respuesta se base en ella. */
  context: z.string().max(20_000).optional(),
});

/** Dudas sobre cómo calcular o preparar una solución, explicadas paso a paso. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError("Escribe tu pregunta.");
    await enforceDailyLimit(supabase);

    const ctx = await labContext(supabase);
    const { json } = await structuredCall({
      kind: "duda_soluciones",
      userId,
      name: "duda_soluciones",
      schema: questionJsonSchema,
      instructions: SOLUTION_QUESTION_INSTRUCTIONS,
      input: [
        contextBlock(ctx.text),
        body.data.context ? `Receta leída del protocolo:\n${body.data.context}` : "",
        `Pregunta: ${body.data.question}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    const parsed = questionSchema.safeParse(json);
    if (!parsed.success) throw new AiError("La IA regresó una respuesta inválida.", 502);
    return NextResponse.json(parsed.data);
  } catch (e) {
    return errorResponse(e);
  }
}
