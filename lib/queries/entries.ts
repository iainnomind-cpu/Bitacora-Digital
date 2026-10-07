"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import type { EntryData } from "@/lib/templates/values";

export type Entry = Tables<"entries">;
export type EntryStatus = "borrador" | "cerrada" | "anulada";
export type EntryRevision = Tables<"entry_revisions">;
export type EntryAddendum = Tables<"entry_addenda">;

/** Lo que el usuario edita de una entrada en borrador (lo que manda el autoguardado). */
export type EntryDraft = Pick<
  Entry,
  | "title"
  | "objective"
  | "observations"
  | "results"
  | "next_steps"
  | "data_location"
  | "started_at"
  | "ended_at"
> & { data: EntryData };

export const entryKeys = {
  all: ["entries"] as const,
  detail: (id: string) => ["entries", "detail", id] as const,
  day: (date: string) => ["entries", "day", date] as const,
  pendingDrafts: (before: string) => ["entries", "pending", before] as const,
  templateUsage: ["entries", "template-usage"] as const,
  recentDrafts: ["entries", "recent-drafts"] as const,
  revisions: (id: string) => ["entries", "revisions", id] as const,
  addenda: (id: string) => ["entries", "addenda", id] as const,
};

const SUMMARY_COLUMNS = "id, title, status, entry_date, started_at, ended_at, template_id";

export function useEntry(id: string) {
  return useQuery({
    queryKey: entryKeys.detail(id),
    queryFn: async () => {
      if (!z.uuid().safeParse(id).success) return null;
      const { data, error } = await createClient()
        .from("entries")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Entradas de un día (sin las anuladas), en orden de inicio. */
export function useEntriesOfDay(date: string) {
  return useQuery({
    queryKey: entryKeys.day(date),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("entries")
        .select(SUMMARY_COLUMNS)
        .eq("entry_date", date)
        .neq("status", "anulada")
        .order("started_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Borradores de días anteriores que siguen sin cerrar. */
export function usePendingDrafts(before: string) {
  return useQuery({
    queryKey: entryKeys.pendingDrafts(before),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("entries")
        .select(SUMMARY_COLUMNS)
        .eq("status", "borrador")
        .lt("entry_date", before)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Borradores más recientes (destinos posibles para los adjuntos de la bandeja). */
export function useRecentDrafts() {
  return useQuery({
    queryKey: entryKeys.recentDrafts,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("entries")
        .select(SUMMARY_COLUMNS)
        .eq("status", "borrador")
        .order("entry_date", { ascending: false })
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

/** Cuántas veces se usó cada plantilla en las últimas 100 entradas (para ordenar el selector). */
export function useTemplateUsage() {
  return useQuery({
    queryKey: entryKeys.templateUsage,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("entries")
        .select("template_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const usage = new Map<string, number>();
      for (const e of data) usage.set(e.template_id, (usage.get(e.template_id) ?? 0) + 1);
      return usage;
    },
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entryDate: string;
      templateId: string;
      templateVersion: number;
      title: string;
      data: EntryData;
    }) => {
      const { data, error } = await createClient()
        .from("entries")
        .insert({
          entry_date: input.entryDate,
          started_at: new Date().toISOString(),
          template_id: input.templateId,
          template_version: input.templateVersion,
          title: input.title,
          data: input.data as Json,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (entry) => {
      queryClient.setQueryData(entryKeys.detail(entry.id), entry);
      queryClient.invalidateQueries({ queryKey: entryKeys.all });
    },
  });
}

/**
 * Guarda un borrador (lo usa el autoguardado). Cada guardado con cambios crea una revisión;
 * `changeSource` queda en esa revisión (p. ej. "ia_aceptada" al aplicar una sugerencia).
 */
export async function saveEntryDraft(
  id: string,
  draft: EntryDraft,
  changeSource: "usuario" | "ia_aceptada" = "usuario",
) {
  const { data, error } = await createClient()
    .from("entries")
    .update({ ...draft, data: draft.data as Json, change_source: changeSource })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function useSetEntryStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { status: "cerrada" } | { status: "anulada"; voidReason: string },
    ) => {
      const { data, error } = await createClient()
        .from("entries")
        .update(
          input.status === "anulada"
            ? { status: "anulada", void_reason: input.voidReason }
            : { status: "cerrada" },
        )
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (entry) => {
      queryClient.setQueryData(entryKeys.detail(id), entry);
      queryClient.invalidateQueries({ queryKey: entryKeys.all });
    },
  });
}

export function useEntryRevisions(id: string) {
  return useQuery({
    queryKey: entryKeys.revisions(id),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("entry_revisions")
        .select("*")
        .eq("entry_id", id)
        .order("revision", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useEntryAddenda(id: string) {
  return useQuery({
    queryKey: entryKeys.addenda(id),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("entry_addenda")
        .select("*")
        .eq("entry_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddAddendum(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { error } = await createClient()
        .from("entry_addenda")
        .insert({ entry_id: entryId, content });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entryKeys.addenda(entryId) }),
  });
}

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  borrador: "Borrador",
  cerrada: "Cerrada",
  anulada: "Anulada",
};
