"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { sampleTypeLabel } from "@/lib/templates/fields";
import { TEMPLATE_PACKS, type PackSampleType, type TemplatePack } from "@/lib/templates/packs";

const ALL_PACK_TYPES = new Map<string, PackSampleType>(
  TEMPLATE_PACKS.flatMap((p) => p.sampleTypes.map((t) => [t.key, t] as const)),
);

/**
 * Agrega un paquete: los tipos de muestra que falten (incluidos los que sus plantillas usan de
 * otros paquetes) y las plantillas que el usuario no tenga ya con el mismo nombre (versión 1).
 */
export async function installPack(pack: TemplatePack) {
  const supabase = createClient();
  const [{ data: types, error: e1 }, { data: templates, error: e2 }] = await Promise.all([
    supabase.from("sample_types").select("key"),
    supabase.from("templates").select("name"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const haveTypes = new Set((types ?? []).map((t) => t.key));
  const needed = new Set([
    ...pack.sampleTypes.map((t) => t.key),
    ...pack.templates.flatMap((t) =>
      t.fields.flatMap((f) => (f.type === "sample_ref" ? [f.sample_type] : [])),
    ),
  ]);
  const newTypes = [...needed]
    .filter((k) => !haveTypes.has(k))
    .map(
      (k) =>
        ALL_PACK_TYPES.get(k) ?? {
          key: k,
          label: sampleTypeLabel(k),
          parent_keys: [],
          metadata_keys: [],
        },
    );
  if (newTypes.length) {
    const { error } = await supabase.from("sample_types").insert(newTypes);
    if (error) throw error;
  }

  const haveNames = new Set((templates ?? []).map((t) => t.name.toLowerCase()));
  let added = 0;
  for (const t of pack.templates) {
    if (haveNames.has(t.name.toLowerCase())) continue;
    const { data: row, error } = await supabase
      .from("templates")
      .insert({
        name: t.name,
        activity_type: t.activity_type,
        description: t.description,
        icon: t.icon,
        color: t.color,
        current_version: 1,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { error: ev } = await supabase
      .from("template_versions")
      .insert({ template_id: row.id, version: 1, fields: t.fields as unknown as Json });
    if (ev) throw ev;
    added++;
  }
  return { templates: added, sampleTypes: newTypes.length, skipped: pack.templates.length - added };
}

export function useInstallPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: installPack,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      void queryClient.invalidateQueries({ queryKey: ["sample_types"] });
    },
  });
}
