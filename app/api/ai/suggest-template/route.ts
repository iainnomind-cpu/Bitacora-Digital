import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SUGGEST_INSTRUCTIONS } from "@/lib/ai/prompts";
import {
  suggestResponseJsonSchema,
  suggestResponseSchema,
  type SuggestOutput,
} from "@/lib/ai/schemas";
import {
  AiError,
  enforceDailyLimit,
  errorResponse,
  requireUser,
  structuredCall,
} from "@/lib/ai/server";
import { contextBlock, labContext } from "@/lib/ai/context";
import { matchActivities } from "@/lib/ai/template-rules";
import { dateInTimeZone, DEFAULT_TIMEZONE } from "@/lib/datetime";
import type { Json } from "@/lib/supabase/database.types";
import { parseFields } from "@/lib/templates/fields";

export const maxDuration = 60;

const bodySchema = z.object({ text: z.string().trim().min(3).max(4000) });

/** Sugiere plantilla a partir de una descripción (§7.5). */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError("Escribe al menos unas palabras sobre la actividad.");
    const text = body.data.text;

    const { data: templates, error } = await supabase
      .from("templates")
      .select(
        "id, name, activity_type, description, current_version, template_versions(version, fields)",
      )
      .eq("is_archived", false);
    if (error) throw error;
    if (!templates.length) throw new AiError("No tienes plantillas.", 404);

    // 1) Reglas: si apuntan a una sola actividad y hay una sola plantilla de ese tipo, listo.
    const matches = matchActivities(text);
    if (matches.length === 1) {
      const candidates = templates.filter((t) => t.activity_type === matches[0].activity);
      if (candidates.length === 1) {
        const result: SuggestOutput = {
          method: "reglas",
          suggestions: [
            {
              template_id: candidates[0].id,
              confidence: 0.9,
              reason: `Menciona «${matches[0].hint}».`,
            },
          ],
          no_good_match: false,
          proposed_title: text.length <= 60 ? text : candidates[0].name,
        };
        return NextResponse.json(result);
      }
    }

    // 2) IA, con las plantillas (sin versiones completas) y el contexto del día.
    await enforceDailyLimit(supabase);
    const { data: profile } = await supabase.from("profiles").select("timezone").maybeSingle();
    const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
    const today = dateInTimeZone(new Date(), timeZone);
    const { data: todays } = await supabase
      .from("entries")
      .select("title, template_id, started_at")
      .eq("entry_date", today)
      .neq("status", "anulada")
      .order("started_at");

    const catalog = templates.map((t) => {
      const v = t.template_versions.find((x) => x.version === t.current_version);
      const fields = v ? parseFields(v.fields) : [];
      return {
        id: t.id,
        nombre: t.name,
        actividad: t.activity_type,
        descripcion: t.description,
        campos: fields.map((f) => f.label),
      };
    });
    const names = new Map(templates.map((t) => [t.id, t.name]));
    const now = new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone }).format(
      new Date(),
    );
    const ctx = await labContext(supabase);
    const input = [
      contextBlock(ctx.text),
      `Lo que dijo el usuario:\n"""${text}"""`,
      `Hora local: ${now}`,
      `Entradas de hoy: ${
        todays?.length
          ? todays.map((e) => `${e.title} (${names.get(e.template_id) ?? "?"})`).join("; ")
          : "ninguna"
      }`,
      matches.length ? `Palabras clave detectadas: ${matches.map((m) => m.hint).join(", ")}` : "",
      `Plantillas del usuario (JSON):\n${JSON.stringify(catalog)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { model: m, json } = await structuredCall({
      kind: "sugerencia_plantilla",
      userId,
      name: "sugerencia_plantilla",
      schema: suggestResponseJsonSchema(templates.map((t) => t.id)),
      instructions: SUGGEST_INSTRUCTIONS,
      input,
    });
    const parsed = suggestResponseSchema.safeParse(json);
    if (!parsed.success) throw new AiError("La IA regresó una sugerencia inválida.", 502);

    const result: SuggestOutput = {
      method: "ia",
      ...parsed.data,
      suggestions: parsed.data.suggestions
        .filter((s) => names.has(s.template_id))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3),
    };
    await supabase.from("ai_suggestions").insert({
      kind: "sugerencia_plantilla",
      input_ref: { text } as Json,
      output: { ...result, model: m } as Json,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
