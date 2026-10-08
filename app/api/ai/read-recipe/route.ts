import { NextResponse, type NextRequest } from "next/server";
import type OpenAI from "openai";
import { z } from "zod";
import { contextBlock, labContext } from "@/lib/ai/context";
import { protocolFilesContent } from "@/lib/ai/files";
import { READ_RECIPE_INSTRUCTIONS } from "@/lib/ai/prompts";
import { readRecipeJsonSchema, readRecipeSchema } from "@/lib/ai/recipe-read";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";

export const maxDuration = 180;

const bodySchema = z
  .object({
    paths: z.array(z.string()).max(10).default([]),
    text: z.string().max(60_000).optional(),
  })
  .refine((b) => b.paths.length > 0 || (b.text?.trim().length ?? 0) > 10, {
    message: "Sube una foto o PDF del protocolo, o pega el texto.",
  });

/**
 * Lee las soluciones de un protocolo o receta (fotos, PDF o texto): componentes, cantidades y
 * volumen original, tal como vienen. El escalado lo calcula la app (lib/chem/scale.ts).
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError(body.error.issues[0]?.message ?? "Datos inválidos.");
    await enforceDailyLimit(supabase);

    const content: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: "input_text",
        text: body.data.text?.trim() ? `Texto:\n${body.data.text.trim()}` : "Protocolo adjunto.",
      },
      ...(await protocolFilesContent(supabase, userId, body.data.paths)),
    ];
    const ctx = await labContext(supabase);
    if (ctx.text) content.push({ type: "input_text", text: contextBlock(ctx.text) });

    const { json } = await structuredCall({
      kind: "leer_receta",
      userId,
      modelKind: body.data.paths.length ? "vision" : "text",
      name: "leer_receta",
      schema: readRecipeJsonSchema,
      instructions: READ_RECIPE_INSTRUCTIONS,
      input: [{ role: "user", content }],
    });
    const parsed = readRecipeSchema.safeParse(json);
    if (!parsed.success) {
      throw new AiError(
        "No se pudo interpretar el protocolo. Intenta con una foto más nítida.",
        502,
      );
    }
    return NextResponse.json(parsed.data);
  } catch (e) {
    return errorResponse(e);
  }
}
