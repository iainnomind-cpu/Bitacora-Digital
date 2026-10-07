"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import type { FieldDef, SampleType } from "@/lib/templates/fields";
import type { EntryData } from "@/lib/templates/values";

export type Sample = Tables<"samples">;
export type SampleStatus = "activa" | "agotada" | "descartada";
export type SampleRole = "usada" | "producida";

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  activa: "Activa",
  agotada: "Agotada",
  descartada: "Descartada",
};

export const sampleKeys = {
  all: ["samples"] as const,
  list: ["samples", "list"] as const,
  entries: (id: string) => ["samples", "entries", id] as const,
  entryLinks: (entryId: string) => ["samples", "entry-links", entryId] as const,
};

/**
 * Todas las muestras del usuario (son pocos cientos): la lista, la búsqueda y la cadena
 * padre → hijos se calculan en el cliente.
 */
export function useSamples() {
  return useQuery({
    queryKey: sampleKeys.list,
    queryFn: async () => {
      const { data, error } = await createClient().from("samples").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });
}

/** Códigos de muestras activas de un tipo, para autocompletar campos sample_ref. */
export function useSampleCodes(sampleType: SampleType) {
  const { data, ...rest } = useSamples();
  return {
    ...rest,
    data: data
      ?.filter((s) => s.sample_type === sampleType && s.status === "activa")
      .map((s) => s.code),
  };
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === "23505") return new Error("Ya existe una muestra con ese código.");
  return new Error(error.message);
}

export type SampleInput = {
  code: string;
  sample_type: SampleType;
  parent_id: string | null;
  status: SampleStatus;
  storage_location: string | null;
  metadata: Record<string, string>;
};

export async function createSample(input: SampleInput) {
  const { data, error } = await createClient()
    .from("samples")
    .insert({ ...input, code: input.code.trim(), metadata: input.metadata as Json })
    .select("*")
    .single();
  if (error) throw friendly(error);
  return data;
}

export function useCreateSample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSample,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sampleKeys.all }),
  });
}

export function useUpdateSample(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SampleInput>) => {
      const { error } = await createClient()
        .from("samples")
        .update({
          ...input,
          ...(input.code ? { code: input.code.trim() } : {}),
          ...(input.metadata ? { metadata: input.metadata as Json } : {}),
        })
        .eq("id", id);
      if (error) throw friendly(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sampleKeys.all }),
  });
}

/** Entradas donde se usó o se produjo una muestra. */
export function useSampleEntries(sampleId: string) {
  return useQuery({
    queryKey: sampleKeys.entries(sampleId),
    queryFn: async () => {
      const supabase = createClient();
      const { data: links, error } = await supabase
        .from("entry_samples")
        .select("entry_id, role")
        .eq("sample_id", sampleId);
      if (error) throw error;
      if (!links.length) return [];
      const { data: entries, error: e2 } = await supabase
        .from("entries")
        .select("id, title, entry_date, status, template_id")
        .in("id", [...new Set(links.map((l) => l.entry_id))])
        .order("entry_date", { ascending: false });
      if (e2) throw e2;
      return entries.map((e) => ({
        ...e,
        roles: links.filter((l) => l.entry_id === e.id).map((l) => l.role as SampleRole),
      }));
    },
  });
}

/** Muestras vinculadas a una entrada (para la vista de una entrada cerrada). */
export function useEntrySampleLinks(entryId: string) {
  return useQuery({
    queryKey: sampleKeys.entryLinks(entryId),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("entry_samples")
        .select("sample_id, role")
        .eq("entry_id", entryId);
      if (error) throw error;
      return data;
    },
  });
}

/** Códigos escritos en los campos sample_ref de una entrada, con su tipo y rol. */
export function sampleRefsOf(fields: FieldDef[], data: EntryData) {
  const refs: { code: string; sampleType: SampleType; role: SampleRole }[] = [];
  for (const f of fields) {
    if (f.type !== "sample_ref") continue;
    const raw = data[f.key];
    const codes = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const c of codes) {
      if (typeof c === "string" && c.trim()) {
        refs.push({ code: c.trim(), sampleType: f.sample_type, role: f.role });
      }
    }
  }
  return refs;
}

/**
 * Deja entry_samples igual a lo que dicen los campos sample_ref del borrador: vincula las
 * muestras registradas y quita los vínculos que ya no aparecen. Las políticas solo permiten
 * cambiar vínculos mientras la entrada es borrador.
 */
export async function syncEntrySamples(entryId: string, fields: FieldDef[], data: EntryData) {
  if (!fields.some((f) => f.type === "sample_ref")) return;
  const supabase = createClient();
  const refs = sampleRefsOf(fields, data);

  const [{ data: samples, error: e1 }, { data: current, error: e2 }] = await Promise.all([
    refs.length
      ? supabase
          .from("samples")
          .select("id, code")
          .in("code", [...new Set(refs.map((r) => r.code))])
      : Promise.resolve({ data: [] as { id: string; code: string }[], error: null }),
    supabase.from("entry_samples").select("sample_id, role").eq("entry_id", entryId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const idByCode = new Map((samples ?? []).map((s) => [s.code, s.id]));
  const key = (sampleId: string, role: string) => `${sampleId}|${role}`;
  const desired = new Map<string, { sample_id: string; role: SampleRole }>();
  for (const r of refs) {
    const id = idByCode.get(r.code);
    if (id) desired.set(key(id, r.role), { sample_id: id, role: r.role });
  }
  const existing = new Set((current ?? []).map((l) => key(l.sample_id, l.role)));

  const toAdd = [...desired].filter(([k]) => !existing.has(k)).map(([, v]) => v);
  const toRemove = (current ?? []).filter((l) => !desired.has(key(l.sample_id, l.role)));

  if (toAdd.length) {
    const { error } = await supabase
      .from("entry_samples")
      .insert(toAdd.map((l) => ({ ...l, entry_id: entryId })));
    if (error) throw error;
  }
  for (const l of toRemove) {
    const { error } = await supabase
      .from("entry_samples")
      .delete()
      .eq("entry_id", entryId)
      .eq("sample_id", l.sample_id)
      .eq("role", l.role);
    if (error) throw error;
  }
}
