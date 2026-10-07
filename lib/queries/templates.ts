"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { activityKey, type TemplateDraft } from "@/lib/templates/editor";
import { parseFields, type FieldDef } from "@/lib/templates/fields";

export type Template = Tables<"templates">;
export type TemplateWithFields = Template & {
  fields: FieldDef[];
  protocolNotes: string | null;
  protocolSources: string[];
};

export const templateKeys = {
  all: ["templates"] as const,
  detail: (id: string) => ["templates", id] as const,
  version: (id: string, version: number) => ["templates", id, "v", version] as const,
};

/**
 * Una versión concreta de plantilla (la que usó una entrada). Las versiones son inmutables,
 * así que nunca se vuelven a pedir.
 */
export function useTemplateVersion(templateId: string | undefined, version: number | undefined) {
  return useQuery({
    queryKey: templateKeys.version(templateId ?? "", version ?? 0),
    enabled: Boolean(templateId && version),
    staleTime: Infinity,
    queryFn: async () => {
      const supabase = createClient();
      const [t, v] = await Promise.all([
        supabase.from("templates").select("*").eq("id", templateId!).single(),
        supabase
          .from("template_versions")
          .select("fields, protocol_notes, protocol_sources")
          .eq("template_id", templateId!)
          .eq("version", version!)
          .single(),
      ]);
      if (t.error) throw t.error;
      if (v.error) throw v.error;
      return {
        ...t.data,
        fields: parseFields(v.data.fields),
        protocolNotes: v.data.protocol_notes,
        protocolSources: v.data.protocol_sources,
      };
    },
  });
}

/** Plantillas activas con los campos de su versión vigente. */
export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: async (): Promise<TemplateWithFields[]> => {
      const { data, error } = await createClient()
        .from("templates")
        .select("*, template_versions(version, fields, protocol_notes, protocol_sources)")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data.map(({ template_versions, ...t }) => {
        const v = template_versions.find((x) => x.version === t.current_version);
        return {
          ...t,
          fields: parseFields(v?.fields ?? []),
          protocolNotes: v?.protocol_notes ?? null,
          protocolSources: v?.protocol_sources ?? [],
        };
      });
    },
  });
}

/** Una plantilla con su versión vigente; null si no existe o no es del usuario. */
export function useTemplate(id: string) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: async (): Promise<TemplateWithFields | null> => {
      if (!z.uuid().safeParse(id).success) return null;
      const supabase = createClient();
      const { data: t, error } = await supabase
        .from("templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!t) return null;
      const { data: v, error: vError } = await supabase
        .from("template_versions")
        .select("fields, protocol_notes, protocol_sources")
        .eq("template_id", id)
        .eq("version", t.current_version)
        .single();
      if (vError) throw vError;
      return {
        ...t,
        fields: parseFields(v.fields),
        protocolNotes: v.protocol_notes,
        protocolSources: v.protocol_sources,
      };
    },
  });
}

/**
 * Guarda una plantilla (§5): si es nueva crea la versión 1; si existe y cambiaron los campos o
 * el protocolo, crea una versión nueva (las entradas anteriores conservan la suya); el nombre,
 * ícono y color se actualizan sin versión.
 */
export function useSaveTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      draft,
      existing,
    }: {
      draft: TemplateDraft;
      existing?: TemplateWithFields;
    }): Promise<string> => {
      const supabase = createClient();
      const meta = {
        name: draft.name.trim(),
        activity_type: draft.activity_type || activityKey(draft.name),
        description: draft.description.trim() || null,
        icon: draft.icon,
        color: draft.color,
      };
      const version = {
        fields: draft.fields as unknown as Json,
        protocol_notes: draft.protocol_notes.trim() || null,
        protocol_sources: draft.protocol_sources,
      };

      if (!existing) {
        const { data: t, error } = await supabase
          .from("templates")
          .insert({ ...meta, current_version: 1 })
          .select("id")
          .single();
        if (error) throw error;
        const { error: e2 } = await supabase
          .from("template_versions")
          .insert({ template_id: t.id, version: 1, ...version });
        if (e2) throw e2;
        return t.id;
      }

      const changed =
        JSON.stringify(draft.fields) !== JSON.stringify(existing.fields) ||
        (draft.protocol_notes.trim() || null) !== existing.protocolNotes ||
        JSON.stringify(draft.protocol_sources) !== JSON.stringify(existing.protocolSources);
      let currentVersion = existing.current_version;
      if (changed) {
        currentVersion += 1;
        const { error } = await supabase
          .from("template_versions")
          .insert({ template_id: existing.id, version: currentVersion, ...version });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("templates")
        .update({ ...meta, current_version: currentVersion })
        .eq("id", existing.id);
      if (error) throw error;
      return existing.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
  });
}

export function useArchiveTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await createClient()
        .from("templates")
        .update({ is_archived: archived })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
  });
}
