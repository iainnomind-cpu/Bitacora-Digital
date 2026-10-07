import "server-only";
import type { requireUser } from "./server";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Contexto del laboratorio y del proyecto para la IA: lo que el usuario escribió en Ajustes →
 * Mi laboratorio y en el proyecto (de la entrada o el activo). Reemplaza el texto fijo de
 * una sola disciplina.
 */
export async function labContext(supabase: Supabase, projectId?: string | null) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_context, vocabulary, active_project_id, timezone")
    .maybeSingle();
  const pid = projectId === undefined ? profile?.active_project_id : projectId;
  const { data: project } = pid
    ? await supabase
        .from("projects")
        .select("name, description, ai_context, vocabulary")
        .eq("id", pid)
        .maybeSingle()
    : { data: null };

  const vocabulary = [...new Set([...(profile?.vocabulary ?? []), ...(project?.vocabulary ?? [])])];
  const text = [
    profile?.ai_context?.trim() && `Laboratorio: ${profile.ai_context.trim()}`,
    project &&
      `Proyecto: ${project.name}${project.description ? ` — ${project.description}` : ""}${
        project.ai_context ? `. ${project.ai_context}` : ""
      }`,
    vocabulary.length > 0 && `Vocabulario: ${vocabulary.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { text, vocabulary, timezone: profile?.timezone ?? null };
}

/** Bloque para agregar al mensaje del modelo (vacío si el usuario no configuró nada). */
export const contextBlock = (text: string) =>
  text ? `Contexto del usuario (úsalo para interpretar términos y abreviaturas):\n${text}` : "";
