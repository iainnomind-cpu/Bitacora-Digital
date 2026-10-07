import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { contextBlock, labContext } from "@/lib/ai/context";
import { FILL_INSTRUCTIONS } from "@/lib/ai/prompts";
import { fillResponseJsonSchema, fillResponseSchema } from "@/lib/ai/schemas";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import type { Json } from "@/lib/supabase/database.types";
import { parseFields, type FieldDef } from "@/lib/templates/fields";

export const maxDuration = 90;

const bodySchema = z.object({ entry_id: z.uuid() });

function describeField(f: FieldDef) {
  return {
    clave: f.key,
    etiqueta: f.label,
    tipo: f.type,
    ...("unit" in f && f.unit ? { unidad: f.unit } : {}),
    ...("options" in f ? { opciones: f.options } : {}),
    ...("expected" in f && f.expected !== undefined ? { esperado: f.expected } : {}),
    ...(f.required ? { obligatorio: true } : {}),
  };
}

/** Propone el llenado de la plantilla de una entrada en borrador (§7.2). No modifica la entrada. */
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
    if (entry.status !== "borrador") throw new AiError("La entrada ya está cerrada.", 409);

    const [{ data: template }, { data: version }, { data: attachments }, { data: profile }] =
      await Promise.all([
        supabase.from("templates").select("name, description").eq("id", entry.template_id).single(),
        supabase
          .from("template_versions")
          .select("fields, protocol_notes")
          .eq("template_id", entry.template_id)
          .eq("version", entry.template_version)
          .single(),
        supabase
          .from("attachments")
          .select("id, kind, text_content, caption, captured_at")
          .eq("entry_id", entry.id)
          .order("captured_at"),
        supabase.from("profiles").select("timezone").maybeSingle(),
      ]);
    if (!template || !version) throw new AiError("No se encontró la plantilla.", 404);
    const fields = parseFields(version.fields);
    const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;

    const audioIds = (attachments ?? []).filter((a) => a.kind === "audio").map((a) => a.id);
    const { data: transcriptions } = audioIds.length
      ? await supabase
          .from("transcriptions")
          .select("id, attachment_id, text, created_at")
          .in("attachment_id", audioIds)
          .eq("status", "lista")
          .order("created_at", { ascending: false })
      : { data: [] };
    const latest = new Map<string, { id: string; text: string | null }>();
    for (const t of transcriptions ?? [])
      if (!latest.has(t.attachment_id)) latest.set(t.attachment_id, t);

    const time = (iso: string) =>
      new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone }).format(new Date(iso));
    const sources = (attachments ?? []).flatMap((a) => {
      if (a.kind === "audio") {
        const t = latest.get(a.id);
        return t?.text ? [`[${time(a.captured_at)}] Audio dictado: ${t.text}`] : [];
      }
      if (a.kind === "texto" && a.text_content) {
        return [`[${time(a.captured_at)}] Nota escrita: ${a.text_content}`];
      }
      if (a.kind === "foto" && a.caption)
        return [`[${time(a.captured_at)}] Pie de foto: ${a.caption}`];
      return [];
    });
    if (sources.length === 0) {
      throw new AiError("No hay audios transcritos ni notas en esta entrada para usar.", 422);
    }

    await enforceDailyLimit(supabase);

    const { data: samples } = await supabase
      .from("samples")
      .select("code, sample_type")
      .order("updated_at", { ascending: false })
      .limit(300);

    const ctx = await labContext(supabase, entry.project_id);
    const input = [
      contextBlock(ctx.text),
      `Plantilla: ${template.name}${template.description ? ` — ${template.description}` : ""}`,
      version.protocol_notes ? `Protocolo estándar:\n${version.protocol_notes}` : "",
      `Campos (JSON):\n${JSON.stringify(fields.map(describeField))}`,
      `Título actual: ${entry.title}`,
      `Valores actuales (JSON, pueden estar vacíos):\n${JSON.stringify({
        fields: entry.data,
        objective: entry.objective,
        observations: entry.observations,
        results: entry.results,
        next_steps: entry.next_steps,
      })}`,
      `Muestras existentes (código: tipo):\n${
        samples?.length ? samples.map((x) => `${x.code}: ${x.sample_type}`).join("\n") : "ninguna"
      }`,
      `Fuentes en orden de captura (hora local):\n${sources.join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { model: m, json } = await structuredCall({
      kind: "llenado_plantilla",
      userId,
      name: "llenado_plantilla",
      schema: fillResponseJsonSchema(fields),
      instructions: FILL_INSTRUCTIONS,
      input,
    });

    const inputRef = {
      attachment_ids: (attachments ?? []).map((a) => a.id),
      transcription_ids: [...latest.values()].map((t) => t.id),
    };
    const parsed = fillResponseSchema(fields).safeParse(json);
    if (!parsed.success) {
      // Se guarda para trazabilidad, pero no se muestra nada roto al usuario (§7.2).
      await supabase.from("ai_suggestions").insert({
        entry_id: entry.id,
        kind: "llenado_plantilla",
        input_ref: inputRef as Json,
        output: {
          error: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`),
          raw: json as Json,
          model: m,
        },
        status: "rechazada",
      });
      throw new AiError(
        "La IA regresó datos que no coinciden con la plantilla. Intenta de nuevo.",
        502,
      );
    }

    const output = { ...parsed.data, model: m };
    const { data: suggestion, error } = await supabase
      .from("ai_suggestions")
      .insert({
        entry_id: entry.id,
        kind: "llenado_plantilla",
        input_ref: inputRef as Json,
        output: output as Json,
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ suggestion_id: suggestion.id, output });
  } catch (e) {
    return errorResponse(e);
  }
}
