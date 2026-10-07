"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { compressImage } from "@/lib/media/image";
import { createClient } from "@/lib/supabase/client";
import type { TemplateDraft } from "@/lib/templates/editor";
import { postJson } from "./ai";
import { uploadToStorage } from "./attachments";

/**
 * Sube las fotos/PDF del protocolo (carpeta protocolos/) y pide a la IA la propuesta de
 * plantilla. Regresa el id de la propuesta para abrirla en el editor.
 */
export function useProtocolToTemplate() {
  return useMutation({
    mutationFn: async ({
      files,
      text,
      onProgress,
    }: {
      files: File[];
      text: string;
      onProgress?: (step: string) => void;
    }) => {
      const paths: string[] = [];
      for (const [i, file] of files.entries()) {
        onProgress?.(`Subiendo ${i + 1} de ${files.length}…`);
        // Las fotos se reducen menos que las de la bitácora: el texto debe seguir legible.
        const blob = file.type === "application/pdf" ? file : await compressImage(file, 2600, 0.9);
        const { path } = await uploadToStorage(blob, "protocolos");
        paths.push(path);
      }
      onProgress?.("Leyendo el protocolo…");
      return postJson<{ suggestion_id: string }>("/api/ai/protocol-to-template", { paths, text });
    },
  });
}

/** Propuesta guardada (ai_suggestions, kind nueva_plantilla) para abrirla en el editor. */
export function useProtocolDraft(suggestionId: string | null) {
  const query = useQuery({
    queryKey: ["ai_suggestions", "template", suggestionId],
    enabled: Boolean(suggestionId),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("ai_suggestions")
        .select("id, output")
        .eq("id", suggestionId!)
        .eq("kind", "nueva_plantilla")
        .single();
      if (error) throw error;
      const output = data.output as { draft: TemplateDraft; notes?: string };
      return { id: data.id, draft: output.draft, notes: output.notes ?? "" };
    },
  });
  return {
    ...query,
    /** Marca la propuesta como aceptada al crear la plantilla (trazabilidad, §7). */
    markAccepted: async () => {
      if (!suggestionId) return;
      await createClient()
        .from("ai_suggestions")
        .update({ status: "aceptada" })
        .eq("id", suggestionId);
    },
  };
}
