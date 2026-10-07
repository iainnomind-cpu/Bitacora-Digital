import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { contextBlock, labContext } from "@/lib/ai/context";
import { CHECK_INSTRUCTIONS } from "@/lib/ai/prompts";
import { checkResponseJsonSchema, checkResponseSchema } from "@/lib/ai/schemas";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";
import type { Json } from "@/lib/supabase/database.types";
import { parseFields } from "@/lib/templates/fields";
import { formatFieldValue } from "@/lib/templates/format";

export const maxDuration = 60;

const bodySchema = z.object({ entry_id: z.uuid() });

/**
 * Revisa una entrada contra el protocolo de su plantilla (§7.3): datos que faltan y
 * desviaciones. Se guarda en ai_suggestions (kind campos_faltantes); no modifica la entrada.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError("Falta entry_id.");

    const { data: entry } = await supabase
      .from("entries")
      .select("*")
      .eq("id", body.data.entry_id)
      .maybeSingle();
    if (!entry) throw new AiError("No se encontró la entrada.", 404);
    const { data: version } = await supabase
      .from("template_versions")
      .select("fields, protocol_notes")
      .eq("template_id", entry.template_id)
      .eq("version", entry.template_version)
      .single();
    if (!version?.protocol_notes?.trim()) {
      throw new AiError(
        "Esta plantilla no tiene el texto del protocolo; agrégalo en el editor de plantillas.",
        422,
      );
    }
    await enforceDailyLimit(supabase);

    const fields = parseFields(version.fields);
    const data = (entry.data ?? {}) as Record<string, unknown>;
    const registered = [
      `Título: ${entry.title}`,
      ...fields.map((f) => `${f.label}: ${formatFieldValue(f, data[f.key])}`),
      `Objetivo: ${entry.objective ?? "—"}`,
      `Observaciones: ${entry.observations ?? "—"}`,
      `Resultados: ${entry.results ?? "—"}`,
    ].join("\n");

    const { model: m, json } = await structuredCall({
      kind: "revision_protocolo",
      userId,
      name: "revision_protocolo",
      schema: checkResponseJsonSchema,
      instructions: CHECK_INSTRUCTIONS,
      input: [
        contextBlock((await labContext(supabase, entry.project_id)).text),
        `Protocolo estándar:\n${version.protocol_notes}`,
        `Lo registrado en la entrada:\n${registered}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    const parsed = checkResponseSchema.safeParse(json);
    if (!parsed.success) throw new AiError("La IA regresó una revisión inválida.", 502);

    await supabase.from("ai_suggestions").insert({
      entry_id: entry.id,
      kind: "campos_faltantes",
      input_ref: { entry_updated_at: entry.updated_at } as Json,
      output: { ...parsed.data, model: m } as Json,
    });
    return NextResponse.json(parsed.data);
  } catch (e) {
    return errorResponse(e);
  }
}
