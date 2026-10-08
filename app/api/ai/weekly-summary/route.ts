import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { contextBlock, labContext } from "@/lib/ai/context";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";
import { addDays } from "@/lib/calendar/dates";
import type { Json } from "@/lib/supabase/database.types";
import { parseFields } from "@/lib/templates/fields";
import { formatFieldValue } from "@/lib/templates/format";

export const maxDuration = 90;

const bodySchema = z.object({ week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

const INSTRUCTIONS = `Escribes la revisión semanal de una bitácora de laboratorio. Responde en
español, concreto y breve, solo con lo registrado (no inventes).
- overview: 2–4 frases con lo principal de la semana.
- by_activity: por actividad o plantilla, qué se hizo (muestras, resultados).
- problems: problemas, fallas o desviaciones registradas.
- next_steps: siguientes pasos y pendientes (incluye tareas programadas no hechas y borradores
  sin cerrar).`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "by_activity", "problems", "next_steps"],
  properties: {
    overview: { type: "string" },
    by_activity: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["activity", "summary"],
        properties: { activity: { type: "string" }, summary: { type: "string" } },
      },
    },
    problems: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
  },
};
const responseSchema = z.object({
  overview: z.string(),
  by_activity: z.array(z.object({ activity: z.string(), summary: z.string() })),
  problems: z.array(z.string()),
  next_steps: z.array(z.string()),
});

/** Resumen semanal (§7.4): se guarda en weekly_reviews como texto editable. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError("Falta la semana.");
    const from = body.data.week_start;
    const to = addDays(from, 6);

    const { data: entries } = await supabase
      .from("entries")
      .select(
        "id, title, status, entry_date, template_id, template_version, data, objective, observations, results, next_steps",
      )
      .gte("entry_date", from)
      .lte("entry_date", to)
      .neq("status", "anulada")
      .order("entry_date");
    const { data: tasks } = await supabase
      .from("scheduled_tasks")
      .select("title, starts_at, status")
      .gte("starts_at", `${from}T00:00:00Z`)
      .lte("starts_at", `${addDays(to, 1)}T12:00:00Z`);
    if (!entries?.length && !tasks?.length)
      throw new AiError("No hay nada registrado esta semana.", 422);
    await enforceDailyLimit(supabase);

    const templateIds = [...new Set((entries ?? []).map((e) => e.template_id))];
    const [{ data: templates }, { data: versions }, { data: addenda }] = await Promise.all([
      supabase.from("templates").select("id, name").in("id", templateIds),
      supabase
        .from("template_versions")
        .select("template_id, version, fields")
        .in("template_id", templateIds),
      supabase
        .from("entry_addenda")
        .select("entry_id, content")
        .in(
          "entry_id",
          (entries ?? []).map((e) => e.id),
        ),
    ]);
    const name = new Map((templates ?? []).map((t) => [t.id, t.name]));

    const lines = (entries ?? []).map((e) => {
      const v = versions?.find(
        (x) => x.template_id === e.template_id && x.version === e.template_version,
      );
      const fields = v ? parseFields(v.fields) : [];
      const data = (e.data ?? {}) as Record<string, unknown>;
      const values = fields
        .map((f) => `${f.label}: ${formatFieldValue(f, data[f.key])}`)
        .filter((l) => !l.endsWith(": —"))
        .join("; ");
      const extra = (addenda ?? [])
        .filter((a) => a.entry_id === e.id)
        .map((a) => `Adenda: ${a.content}`);
      return [
        `- ${e.entry_date} · ${name.get(e.template_id) ?? "?"} · ${e.title} (${e.status})`,
        values && `  Datos: ${values}`,
        e.objective && `  Objetivo: ${e.objective}`,
        e.observations && `  Observaciones: ${e.observations}`,
        e.results && `  Resultados: ${e.results}`,
        e.next_steps && `  Siguiente paso: ${e.next_steps}`,
        ...extra.map((x) => `  ${x}`),
      ]
        .filter(Boolean)
        .join("\n");
    });
    const taskLines = (tasks ?? []).map(
      (t) => `- ${t.starts_at.slice(0, 10)} ${t.title} (${t.status})`,
    );

    const ctx = await labContext(supabase);
    const { json } = await structuredCall({
      kind: "resumen_semanal",
      userId,
      name: "resumen_semanal",
      schema,
      instructions: INSTRUCTIONS,
      input: [
        contextBlock(ctx.text),
        `Semana del ${from} al ${to}.`,
        `Entradas:\n${lines.join("\n") || "ninguna"}`,
        `Tareas programadas:\n${taskLines.join("\n") || "ninguna"}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    const r = responseSchema.safeParse(json);
    if (!r.success) throw new AiError("La IA regresó un resumen inválido.", 502);

    const summary = [
      r.data.overview,
      r.data.by_activity.length
        ? `\nPor actividad\n${r.data.by_activity.map((a) => `• ${a.activity}: ${a.summary}`).join("\n")}`
        : "",
      r.data.problems.length
        ? `\nProblemas y desviaciones\n${r.data.problems.map((p) => `• ${p}`).join("\n")}`
        : "",
      r.data.next_steps.length
        ? `\nSiguientes pasos\n${r.data.next_steps.map((p) => `• ${p}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase
      .from("weekly_reviews")
      .upsert({ week_start: from, summary }, { onConflict: "user_id,week_start" });
    if (error) throw error;
    await supabase.from("ai_suggestions").insert({
      kind: "resumen_semanal",
      input_ref: { week_start: from } as Json,
      output: r.data as unknown as Json,
      status: "aceptada",
    });
    return NextResponse.json({ summary });
  } catch (e) {
    return errorResponse(e);
  }
}
