import { NextResponse } from "next/server";
import { DEFAULT_GAP_MINUTES, extractCodes, pregroup } from "@/lib/ai/grouping";
import { contextBlock, labContext } from "@/lib/ai/context";
import { analyzePhoto, photoContext } from "@/lib/ai/photo";
import { ORGANIZE_INSTRUCTIONS } from "@/lib/ai/prompts";
import { organizeResponseJsonSchema, organizeResponseSchema } from "@/lib/ai/schemas";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import type { Json } from "@/lib/supabase/database.types";

export const maxDuration = 120;

const MAX_ITEMS = 60;
const MAX_PHOTO_ANALYSES = 8;

/**
 * Organiza la bandeja de entrada (§7.6): pre-agrupa por hora y códigos, le pide al modelo los
 * grupos finales con plantilla y destino, y los guarda como capture_groups pendientes de
 * revisión. Nada se mueve hasta que el usuario acepta una tarjeta.
 */
export async function POST() {
  try {
    const { supabase, userId } = await requireUser();

    const { data: inbox, error } = await supabase
      .from("attachments")
      .select("*")
      .is("entry_id", null)
      .order("captured_at", { ascending: false })
      .limit(MAX_ITEMS);
    if (error) throw error;
    if (!inbox.length) return NextResponse.json({ groups: [] });

    await enforceDailyLimit(supabase);

    // Fotos aún sin analizar: se analizan primero (mejoran la agrupación).
    const pendingPhotos = inbox
      .filter((a) => a.kind === "foto" && a.ai_status === "pendiente")
      .slice(0, MAX_PHOTO_ANALYSES);
    const pContext = pendingPhotos.length ? await photoContext(supabase) : null;
    const analyzed = await Promise.allSettled(
      pendingPhotos.map((a) => analyzePhoto(supabase, userId, a, pContext!)),
    );
    analyzed.forEach((r, i) => {
      if (r.status === "fulfilled") Object.assign(pendingPhotos[i], r.value);
    });

    const audioIds = inbox.filter((a) => a.kind === "audio").map((a) => a.id);
    const [{ data: transcriptions }, { data: templates }, { data: drafts }, { data: profile }] =
      await Promise.all([
        audioIds.length
          ? supabase
              .from("transcriptions")
              .select("attachment_id, text, created_at")
              .in("attachment_id", audioIds)
              .eq("status", "lista")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as { attachment_id: string; text: string | null }[] }),
        supabase
          .from("templates")
          .select("id, name, activity_type, description")
          .eq("is_archived", false),
        supabase
          .from("entries")
          .select("id, title, entry_date, started_at, template_id")
          .eq("status", "borrador")
          .order("entry_date", { ascending: false })
          .limit(15),
        supabase.from("profiles").select("timezone").maybeSingle(),
      ]);
    if (!templates?.length) throw new AiError("No tienes plantillas.", 404);
    const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
    const transcript = new Map<string, string>();
    for (const t of transcriptions ?? []) {
      if (t.text && !transcript.has(t.attachment_id)) transcript.set(t.attachment_id, t.text);
    }

    const contentOf = (a: (typeof inbox)[number]) =>
      [
        a.kind === "audio" ? transcript.get(a.id) : null,
        a.text_content,
        a.caption,
        a.ai_description,
        a.ai_extracted_text,
      ]
        .filter(Boolean)
        .join(" · ");
    const codesOf = (a: (typeof inbox)[number]) => [
      ...extractCodes(contentOf(a)),
      ...a.ai_tags.filter((t) => t.startsWith("muestra:")).map((t) => t.slice(8).toUpperCase()),
    ];

    const candidates = pregroup(
      inbox.map((a) => ({ id: a.id, capturedAt: a.captured_at, codes: codesOf(a) })),
      DEFAULT_GAP_MINUTES,
    );
    const byId = new Map(inbox.map((a) => [a.id, a]));
    const fmt = (iso: string) =>
      new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short", timeZone }).format(
        new Date(iso),
      );
    const templateName = new Map(templates.map((t) => [t.id, t.name]));

    const ctx = await labContext(supabase);
    const input = [
      contextBlock(ctx.text),
      `Grupos candidatos (JSON):\n${JSON.stringify(
        candidates.map((ids, i) => ({
          grupo: i + 1,
          adjuntos: ids.map((id) => {
            const a = byId.get(id)!;
            return {
              id,
              tipo: a.kind,
              hora: fmt(a.captured_at),
              contenido: contentOf(a) || "(sin texto)",
              etiquetas: a.ai_tags,
            };
          }),
        })),
      )}`,
      `Plantillas del usuario (JSON):\n${JSON.stringify(
        templates.map((t) => ({ id: t.id, nombre: t.name, actividad: t.activity_type })),
      )}`,
      `Entradas en borrador (JSON):\n${JSON.stringify(
        (drafts ?? []).map((d) => ({
          id: d.id,
          titulo: d.title,
          plantilla: templateName.get(d.template_id),
          fecha: d.entry_date,
          inicio: d.started_at ? fmt(d.started_at) : null,
        })),
      )}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { model: m, json } = await structuredCall({
      kind: "agrupacion_bandeja",
      userId,
      name: "agrupacion_bandeja",
      schema: organizeResponseJsonSchema(
        inbox.map((a) => a.id),
        templates.map((t) => t.id),
        (drafts ?? []).map((d) => d.id),
      ),
      instructions: ORGANIZE_INSTRUCTIONS,
      input,
    });
    const parsed = organizeResponseSchema.safeParse(json);
    if (!parsed.success) throw new AiError("La IA regresó una agrupación inválida.", 502);

    // Cada adjunto en un solo grupo; destino existente solo si el borrador es válido.
    const used = new Set<string>();
    const draftIds = new Set((drafts ?? []).map((d) => d.id));
    const activity = new Map(templates.map((t) => [t.id, t.activity_type]));
    const rows = parsed.data.groups.flatMap((g) => {
      const ids = g.attachment_ids.filter((id) => byId.has(id) && !used.has(id));
      ids.forEach((id) => used.add(id));
      if (!ids.length) return [];
      const existing =
        g.target === "entrada_existente" && g.target_entry_id && draftIds.has(g.target_entry_id);
      return [
        {
          attachment_ids: ids,
          suggested_template_id:
            g.template_id && activity.has(g.template_id) ? g.template_id : null,
          suggested_activity_type: g.template_id ? (activity.get(g.template_id) ?? null) : null,
          suggested_target: existing ? "entrada_existente" : "nueva_entrada",
          target_entry_id: existing ? g.target_entry_id : null,
          suggested_title: g.title.slice(0, 120),
          confidence: g.confidence,
          reasoning: g.reasoning,
        },
      ];
    });

    // Las propuestas pendientes anteriores quedan reemplazadas (no se borran).
    await supabase
      .from("capture_groups")
      .update({ status: "reemplazado" })
      .eq("status", "pendiente_revision");
    const { data: groups, error: insertError } = rows.length
      ? await supabase.from("capture_groups").insert(rows).select("*")
      : { data: [], error: null };
    if (insertError) throw insertError;

    await supabase.from("ai_suggestions").insert({
      kind: "agrupacion_bandeja",
      input_ref: { attachment_ids: inbox.map((a) => a.id) } as Json,
      output: { groups: parsed.data.groups, model: m } as Json,
    });
    return NextResponse.json({ groups });
  } catch (e) {
    return errorResponse(e);
  }
}
