"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dateInTimeZone } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { initialValues } from "@/lib/templates/values";
import { postJson } from "./ai";
import { assignAttachments, attachmentKeys, type Attachment } from "./attachments";
import { entryKeys } from "./entries";
import type { TemplateWithFields } from "./templates";

export type CaptureGroup = Tables<"capture_groups">;

export const groupKeys = { pending: ["capture_groups", "pending"] as const };

/** Tarjetas de agrupación pendientes de revisar (§7.6). */
export function useCaptureGroups() {
  return useQuery({
    queryKey: groupKeys.pending,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("capture_groups")
        .select("*")
        .eq("status", "pendiente_revision")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useOrganizeInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ groups: CaptureGroup[] }>("/api/ai/organize-inbox", {}),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.pending });
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.all });
    },
  });
}

export async function updateGroup(id: string, patch: Partial<CaptureGroup>) {
  const { error } = await createClient().from("capture_groups").update(patch).eq("id", id);
  if (error) throw error;
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CaptureGroup> }) =>
      updateGroup(id, patch),
    onSettled: () => queryClient.invalidateQueries({ queryKey: groupKeys.pending }),
  });
}

export type GroupDecision = {
  group: CaptureGroup;
  attachments: Attachment[];
  template: TemplateWithFields | null;
  targetEntryId: string | null;
  title: string;
  /** El usuario cambió plantilla, destino, título o adjuntos respecto a la propuesta. */
  modified: boolean;
  timeZone: string;
  projectId?: string | null;
};

/**
 * Aceptar una tarjeta: crea la entrada (o usa el borrador elegido), mueve los adjuntos y lanza
 * el llenado de la plantilla con IA, que queda pendiente de revisión dentro de la entrada.
 * Regresa el id de la entrada.
 */
export async function acceptGroup(d: GroupDecision): Promise<string> {
  const ids = d.attachments.map((a) => a.id);
  let entryId = d.targetEntryId;

  if (!entryId) {
    if (!d.template) throw new Error("Elige una plantilla.");
    const times = d.attachments.map((a) => a.captured_at).sort();
    const first = times[0] ?? new Date().toISOString();
    const last = times.at(-1) ?? first;
    const { data, error } = await createClient()
      .from("entries")
      .insert({
        entry_date: dateInTimeZone(new Date(first), d.timeZone),
        started_at: first,
        ended_at: last !== first ? last : null,
        template_id: d.template.id,
        template_version: d.template.current_version,
        title: d.title.trim() || d.template.name,
        data: initialValues(d.template.fields) as Json,
        project_id: d.projectId ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    entryId = data.id;
  }

  await assignAttachments(ids, entryId);
  await updateGroup(d.group.id, {
    status: d.modified ? "modificado" : "aceptado",
    attachment_ids: ids,
    target_entry_id: entryId,
    suggested_template_id: d.template?.id ?? d.group.suggested_template_id,
  });

  // Si no hay audios transcritos ni notas, el llenado no tiene de dónde leer: no es un error.
  await postJson("/api/ai/fill-template", { entry_id: entryId }).catch(() => {});
  return entryId;
}

export function useAcceptGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptGroup,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.pending });
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: entryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["ai_suggestions"] });
    },
  });
}
