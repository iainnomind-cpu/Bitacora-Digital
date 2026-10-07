"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { parseFields, type FieldDef } from "@/lib/templates/fields";

export type Template = Tables<"templates">;
export type TemplateWithFields = Template & { fields: FieldDef[]; protocolNotes: string | null };

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
          .select("fields, protocol_notes")
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
        .select("*, template_versions(version, fields, protocol_notes)")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data.map(({ template_versions, ...t }) => {
        const v = template_versions.find((x) => x.version === t.current_version);
        return {
          ...t,
          fields: parseFields(v?.fields ?? []),
          protocolNotes: v?.protocol_notes ?? null,
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
        .select("fields, protocol_notes")
        .eq("template_id", id)
        .eq("version", t.current_version)
        .single();
      if (vError) throw vError;
      return { ...t, fields: parseFields(v.fields), protocolNotes: v.protocol_notes };
    },
  });
}
