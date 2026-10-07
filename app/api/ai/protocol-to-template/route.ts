import { NextResponse, type NextRequest } from "next/server";
import type OpenAI from "openai";
import { z } from "zod";
import { TEMPLATE_COLORS, TEMPLATE_ICONS } from "@/components/templates/template-icon";
import { protocolJsonSchema, protocolResponseSchema, protocolToDraft } from "@/lib/ai/protocol";
import { PROTOCOL_INSTRUCTIONS } from "@/lib/ai/prompts";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";
import type { Json } from "@/lib/supabase/database.types";

// Leer varias páginas en alta resolución tarda.
export const maxDuration = 180;

const bodySchema = z
  .object({
    paths: z.array(z.string()).max(10).default([]),
    text: z.string().max(60_000).optional(),
  })
  .refine((b) => b.paths.length > 0 || (b.text?.trim().length ?? 0) > 20, {
    message: "Sube fotos o un PDF del protocolo, o pega su texto.",
  });

/**
 * Protocolo → propuesta de plantilla (§7.7). Lee fotos (visión, detalle alto para el texto),
 * PDF o texto pegado, y guarda la propuesta en ai_suggestions para abrirla en el editor. No crea
 * la plantilla: el usuario la revisa y la guarda.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError(body.error.issues[0]?.message ?? "Datos inválidos.");
    const { paths, text } = body.data;
    if (paths.some((p) => !p.startsWith(`${userId}/protocolos/`))) {
      throw new AiError("Archivo no válido.", 403);
    }

    await enforceDailyLimit(supabase);

    const content: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: "input_text",
        text: text?.trim() ? `Texto del protocolo:\n${text.trim()}` : "Protocolo adjunto.",
      },
    ];
    for (const path of paths) {
      if (path.endsWith(".pdf")) {
        const file = await supabase.storage.from("attachments").download(path);
        if (file.error) throw new AiError("No se pudo leer el PDF.", 502);
        const base64 = Buffer.from(await file.data.arrayBuffer()).toString("base64");
        content.push({
          type: "input_file",
          filename: "protocolo.pdf",
          file_data: `data:application/pdf;base64,${base64}`,
        });
      } else {
        const signed = await supabase.storage.from("attachments").createSignedUrl(path, 600);
        if (signed.error) throw new AiError("No se pudo leer una foto.", 502);
        content.push({ type: "input_image", image_url: signed.data.signedUrl, detail: "high" });
      }
    }

    const { data: types } = await supabase
      .from("sample_types")
      .select("key, label")
      .eq("is_archived", false);
    const sampleTypes = (types ?? []).map((t) => t.key);
    content.push({
      type: "input_text",
      text: `Tipos de muestra del usuario (clave: nombre): ${(types ?? []).map((t) => `${t.key}: ${t.label}`).join("; ")}`,
    });

    const { model: m, json } = await structuredCall({
      kind: "nueva_plantilla",
      userId,
      modelKind: paths.length ? "vision" : "text",
      name: "plantilla_desde_protocolo",
      schema: protocolJsonSchema({
        sampleTypes: sampleTypes.length ? sampleTypes : ["otro"],
        icons: Object.keys(TEMPLATE_ICONS),
        colors: Object.keys(TEMPLATE_COLORS),
      }),
      instructions: PROTOCOL_INSTRUCTIONS,
      input: [{ role: "user", content }],
    });
    const parsed = protocolResponseSchema.safeParse(json);
    if (!parsed.success)
      throw new AiError("La IA regresó una plantilla inválida. Intenta de nuevo.", 502);

    const { draft, dropped } = protocolToDraft(parsed.data, paths);
    const notes = [
      parsed.data.notes.trim(),
      dropped ? `Se omitieron ${dropped} campos incompletos.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const { data: suggestion, error } = await supabase
      .from("ai_suggestions")
      .insert({
        kind: "nueva_plantilla",
        input_ref: { paths, has_text: Boolean(text?.trim()) } as Json,
        output: { draft, notes, model: m } as unknown as Json,
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ suggestion_id: suggestion.id });
  } catch (e) {
    return errorResponse(e);
  }
}
