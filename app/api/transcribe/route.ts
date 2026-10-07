import { NextResponse, type NextRequest } from "next/server";
import { toFile } from "openai";
import { z } from "zod";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  logUsage,
  model,
  openai,
  requireUser,
} from "@/lib/ai/server";
import { LAB_VOCABULARY, TRANSCRIBE_PROMPT } from "@/lib/ai/vocabulary";
import { extensionFor } from "@/lib/media/audio";

// Una nota de voz de 10 min tarda decenas de segundos en transcribirse (§7.1).
export const maxDuration = 120;

const bodySchema = z.object({ attachment_id: z.uuid() });

/** Transcribe un audio de Storage y guarda el texto en `transcriptions` (§7.1). */
export async function POST(request: NextRequest) {
  let transcriptionId: string | null = null;
  const ctx = await requireUser().catch((e) => e as AiError);
  if (ctx instanceof AiError) return errorResponse(ctx);
  const { supabase, userId } = ctx;

  try {
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError("Falta attachment_id.");

    const { data: attachment } = await supabase
      .from("attachments")
      .select("*")
      .eq("id", body.data.attachment_id)
      .maybeSingle();
    if (!attachment || attachment.kind !== "audio" || !attachment.storage_path) {
      throw new AiError("No se encontró el audio.", 404);
    }

    await enforceDailyLimit(supabase);
    const m = model("transcribe");

    const { data: row, error: insertError } = await supabase
      .from("transcriptions")
      .insert({ attachment_id: attachment.id, status: "procesando", model: m, language: "es" })
      .select("id")
      .single();
    if (insertError) throw insertError;
    transcriptionId = row.id;

    const download = await supabase.storage.from("attachments").download(attachment.storage_path);
    if (download.error) throw new AiError("No se pudo leer el audio de Storage.", 502);
    const mime = attachment.mime_type ?? download.data.type ?? "audio/webm";
    const file = await toFile(download.data, `audio.${extensionFor(mime)}`, { type: mime });

    // Códigos de muestras recientes: el modelo los escribe tal cual en vez de "corregirlos".
    const { data: samples } = await supabase
      .from("samples")
      .select("code")
      .order("updated_at", { ascending: false })
      .limit(40);
    const keywords = [...LAB_VOCABULARY, ...(samples ?? []).map((s) => s.code)].filter(
      (k) => !/[<>\r\n]/.test(k),
    );

    const result = await openai().audio.transcriptions.create({
      model: m,
      file,
      languages: ["es"],
      prompt: TRANSCRIBE_PROMPT,
      keywords,
    });
    logUsage({
      kind: "transcripcion",
      model: m,
      userId,
      audioSeconds: attachment.duration_seconds,
    });

    const { data: saved, error: updateError } = await supabase
      .from("transcriptions")
      .update({ status: "lista", text: result.text, error_message: null })
      .eq("id", transcriptionId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return NextResponse.json({ transcription: saved });
  } catch (e) {
    if (transcriptionId) {
      await supabase
        .from("transcriptions")
        .update({
          status: "error",
          error_message: e instanceof Error ? e.message.slice(0, 500) : "Error",
        })
        .eq("id", transcriptionId);
    }
    return errorResponse(e);
  }
}
