"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FillOutput, SuggestOutput } from "@/lib/ai/schemas";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export type Transcription = Tables<"transcriptions">;

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
  return json as T;
}

export const transcriptionKeys = {
  all: ["transcriptions"] as const,
  for: (ids: string[]) => ["transcriptions", ...ids] as const,
};

/** Última transcripción de cada audio. Se actualiza sola mientras alguna está en proceso. */
export function useTranscriptions(attachmentIds: string[]) {
  return useQuery({
    queryKey: transcriptionKeys.for(attachmentIds),
    enabled: attachmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("transcriptions")
        .select("*")
        .in("attachment_id", attachmentIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const latest = new Map<string, Transcription>();
      for (const t of data) if (!latest.has(t.attachment_id)) latest.set(t.attachment_id, t);
      return latest;
    },
    refetchInterval: (query) =>
      [...(query.state.data?.values() ?? [])].some((t) => t.status === "procesando") ? 3000 : false,
  });
}

export function useTranscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      postJson<{ transcription: Transcription }>("/api/transcribe", {
        attachment_id: attachmentId,
      }),
    onMutate: () => queryClient.invalidateQueries({ queryKey: transcriptionKeys.all }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: transcriptionKeys.all }),
  });
}

export function useSuggestTemplate() {
  return useMutation({
    mutationFn: (text: string) => postJson<SuggestOutput>("/api/ai/suggest-template", { text }),
  });
}

export function useFillTemplate(entryId: string) {
  return useMutation({
    mutationFn: () =>
      postJson<{ suggestion_id: string; output: FillOutput }>("/api/ai/fill-template", {
        entry_id: entryId,
      }),
  });
}

/** Marca qué hizo el usuario con una sugerencia (se guarda aunque la rechace, §7). */
export async function resolveSuggestion(
  id: string,
  status: "aceptada" | "aceptada_parcial" | "rechazada",
) {
  const { error } = await createClient().from("ai_suggestions").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Describe una foto con IA al subirla (§7.6); el resultado se guarda en el adjunto. */
export function useAnalyzePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      postJson("/api/ai/analyze-photo", { attachment_id: attachmentId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["attachments"] }),
  });
}

/**
 * Última sugerencia de llenado pendiente de revisar de una entrada (p. ej. la que se lanzó al
 * aceptar una tarjeta de la bandeja). Se muestra al abrir la entrada.
 */
export function usePendingFill(entryId: string) {
  return useQuery({
    queryKey: ["ai_suggestions", "fill", entryId],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("ai_suggestions")
        .select("id, output")
        .eq("entry_id", entryId)
        .eq("kind", "llenado_plantilla")
        .eq("status", "pendiente_revision")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
