"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { sampleTypeLabel } from "@/lib/templates/fields";

export type SampleTypeRow = Tables<"sample_types">;
const key = ["sample_types"] as const;

/**
 * Tipos de muestra del usuario (configurables: plásmido, cepa, línea celular…), con ayudas
 * para la etiqueta, los tipos de origen y los datos sugeridos de cada uno.
 */
export function useSampleTypes() {
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("sample_types")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
  const all = query.data ?? [];
  const byKey = new Map(all.map((t) => [t.key, t]));
  return {
    ...query,
    all,
    active: all.filter((t) => !t.is_archived),
    labelOf: (k: string) => byKey.get(k)?.label ?? sampleTypeLabel(k),
    parentsOf: (k: string) => byKey.get(k)?.parent_keys ?? [],
    metadataOf: (k: string) => byKey.get(k)?.metadata_keys ?? [],
    /** Tipos que pueden venir de `k` (para "agregar derivada"). */
    childrenOf: (k: string) => all.filter((t) => !t.is_archived && t.parent_keys.includes(k)),
  };
}

/** "Línea celular" → "linea_celular". */
export function keyFromLabel(label: string) {
  const k = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(k) ? k : `tipo_${k || "nuevo"}`;
}

export type SampleTypeInput = {
  label: string;
  parent_keys: string[];
  metadata_keys: string[];
  is_archived?: boolean;
};

export function useSaveSampleType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SampleTypeInput }) => {
      const supabase = createClient();
      const { error } = id
        ? await supabase.from("sample_types").update(input).eq("id", id)
        : await supabase.from("sample_types").insert({ ...input, key: keyFromLabel(input.label) });
      if (error) {
        if (error.code === "23505") throw new Error("Ya existe un tipo con ese nombre.");
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
