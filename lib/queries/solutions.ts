"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecipeComponent } from "@/lib/chem/solutions";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import type { QuestionOutput, ReadRecipeOutput } from "@/lib/ai/recipe-read";
import { compressImage } from "@/lib/media/image";
import { postJson } from "./ai";
import { uploadToStorage } from "./attachments";

export type LibraryReagent = Tables<"reagent_library">;
export type SavedRecipe = Tables<"solution_recipes"> & { components: RecipeComponent[] };

const reagentKey = ["reagent_library"] as const;
const recipeKey = ["solution_recipes"] as const;

export function useReagentLibrary() {
  return useQuery({
    queryKey: reagentKey,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("reagent_library")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveReagent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (r: {
      id?: string;
      name: string;
      formula: string | null;
      molecular_weight: number | null;
      cas: string | null;
      notes: string | null;
    }) => {
      const { id, ...input } = r;
      const supabase = createClient();
      const { error } = id
        ? await supabase.from("reagent_library").update(input).eq("id", id)
        : await supabase.from("reagent_library").insert(input);
      if (error) {
        if (error.code === "23505") throw new Error("Ya tienes un reactivo con ese nombre.");
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reagentKey }),
  });
}

export function useDeleteReagent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("reagent_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reagentKey }),
  });
}

export function useRecipes() {
  return useQuery({
    queryKey: recipeKey,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("solution_recipes")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SavedRecipe[];
    },
  });
}

export function useSaveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (r: {
      id?: string;
      name: string;
      final_volume_ml: number;
      components: RecipeComponent[];
      ph: number | null;
      instructions: string | null;
    }) => {
      const { id, ...rest } = r;
      const input = { ...rest, components: rest.components as unknown as Json };
      const supabase = createClient();
      if (id) {
        const { error } = await supabase.from("solution_recipes").update(input).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("solution_recipes")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recipeKey }),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("solution_recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recipeKey }),
  });
}

export type AiRecipe = {
  name: string;
  final_volume_ml: number;
  ph: number | null;
  components: RecipeComponent[];
  instructions: string;
  warnings: string;
};

/** La IA propone componentes y concentraciones; las cantidades las calcula la app. */
export function useAiRecipe() {
  return useMutation({
    mutationFn: (description: string) =>
      postJson<AiRecipe>("/api/ai/solution-recipe", { description }),
  });
}

/** Sube fotos/PDF (o usa texto) y pide a la IA que lea las soluciones del protocolo. */
export function useReadRecipe() {
  return useMutation({
    mutationFn: async ({ files, text }: { files: File[]; text: string }) => {
      const paths: string[] = [];
      for (const file of files) {
        const blob = file.type === "application/pdf" ? file : await compressImage(file, 2600, 0.9);
        paths.push((await uploadToStorage(blob, "protocolos")).path);
      }
      return postJson<ReadRecipeOutput>("/api/ai/read-recipe", { paths, text });
    },
  });
}

export function useSolutionQuestion() {
  return useMutation({
    mutationFn: (input: { question: string; context?: string }) =>
      postJson<QuestionOutput>("/api/ai/solution-question", input),
  });
}
