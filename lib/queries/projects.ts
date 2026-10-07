"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { useProfile } from "./profile";

export type Project = Tables<"projects">;
const key = ["projects"] as const;

export function useProjects() {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await createClient().from("projects").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Proyecto activo del perfil (null = sin proyecto / todos). */
export function useActiveProject() {
  const profile = useProfile();
  const projects = useProjects();
  const id = profile.data?.active_project_id ?? null;
  return {
    id,
    project: projects.data?.find((p) => p.id === id) ?? null,
    isPending: profile.isPending,
  };
}

export type ProjectInput = {
  name: string;
  description: string | null;
  ai_context: string | null;
  vocabulary: string[];
  color?: string | null;
  status?: "activo" | "archivado";
};

export function useSaveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ProjectInput }) => {
      const supabase = createClient();
      if (id) {
        const { error } = await supabase.from("projects").update(input).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from("projects").insert(input).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Cambia el perfil (proyecto activo, contexto del laboratorio, vocabulario, zona horaria). */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      active_project_id?: string | null;
      ai_context?: string | null;
      vocabulary?: string[];
      timezone?: string;
      lab_name?: string | null;
    }) => {
      const { data: session } = await createClient().auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("La sesión expiró.");
      const { error } = await createClient().from("profiles").update(patch).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

/** "IBA1, DAB\n3xTg" → ["IBA1", "DAB", "3xTg"] */
export const parseVocabulary = (text: string) => [
  ...new Set(
    text
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter((t) => t && !/[<>]/.test(t)),
  ),
];
