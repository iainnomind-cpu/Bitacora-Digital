import "server-only";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

// Todo lo de IA corre solo en el servidor (OPENAI_API_KEY nunca llega al cliente).
// Los nombres de modelo vienen de variables de entorno (docs/design.md §2).

let client: OpenAI | null = null;
export function openai() {
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

type ModelKind = "transcribe" | "text" | "vision";
const MODEL_ENV: Record<ModelKind, string> = {
  transcribe: "OPENAI_TRANSCRIBE_MODEL",
  text: "OPENAI_TEXT_MODEL",
  vision: "OPENAI_VISION_MODEL",
};

export function model(kind: ModelKind) {
  const value = process.env[MODEL_ENV[kind]];
  if (!value) throw new AiError(`Falta configurar ${MODEL_ENV[kind]}.`, 500);
  return value;
}

/** Error con mensaje para el usuario y código HTTP. */
export class AiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof OpenAI.APIError) {
    console.error("[ai] OpenAI", e.status, e.message);
    return NextResponse.json(
      { error: "El servicio de IA no respondió bien. Intenta de nuevo en un momento." },
      { status: 502 },
    );
  }
  console.error("[ai]", e);
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}

/** Cliente de Supabase con la sesión del usuario (RLS aplica); lanza 401 sin sesión. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) throw new AiError("La sesión expiró. Vuelve a entrar.", 401);
  return { supabase, userId };
}

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Límite diario de llamadas a la IA por usuario (AI_DAILY_CALL_LIMIT, §7 "Costos y control").
 * Cada llamada deja rastro (fila en transcriptions o ai_suggestions, o foto analizada); se
 * cuentan las de las últimas 24 h.
 */
export async function enforceDailyLimit(supabase: Supabase) {
  const limit = Number(process.env.AI_DAILY_CALL_LIMIT ?? 100);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [t, s, p] = await Promise.all([
    supabase
      .from("transcriptions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("ai_suggestions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("attachments")
      .select("id", { count: "exact", head: true })
      .eq("kind", "foto")
      .neq("ai_status", "pendiente")
      .gte("updated_at", since),
  ]);
  if ((t.count ?? 0) + (s.count ?? 0) + (p.count ?? 0) >= limit) {
    throw new AiError(`Llegaste al límite de ${limit} usos de IA en 24 horas.`, 429);
  }
}

/** Registro de uso por llamada (aparece en los logs de Vercel). */
export function logUsage(entry: {
  kind: string;
  model: string;
  userId: string;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number | null;
}) {
  console.info("[ai:uso]", JSON.stringify(entry));
}

/**
 * Llama al modelo con salida estructurada (JSON Schema estricto) y regresa el JSON. `input`
 * puede ser texto o contenido con imágenes (modelo de visión).
 */
export async function structuredCall(opts: {
  kind: string;
  userId: string;
  name: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string | OpenAI.Responses.ResponseInput;
  modelKind?: "text" | "vision";
}) {
  const m = model(opts.modelKind ?? "text");
  const response = await openai().responses.create({
    model: m,
    instructions: opts.instructions,
    input: opts.input,
    text: { format: { type: "json_schema", name: opts.name, schema: opts.schema, strict: true } },
  });
  logUsage({
    kind: opts.kind,
    model: m,
    userId: opts.userId,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
  });
  try {
    return { model: m, json: JSON.parse(response.output_text) as unknown };
  } catch {
    throw new AiError("La IA regresó una respuesta incompleta. Intenta de nuevo.", 502);
  }
}
