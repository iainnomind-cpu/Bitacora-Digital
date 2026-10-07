"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";

export type Reminder = Tables<"reminders">;
const key = ["reminders"] as const;

const ORDER = ["inicio_dia", "cierre_dia", "revision_semanal", "personalizado", "temporizador"];

/** Recordatorios con horario (los temporizadores únicos son de la fase 2). */
export function useReminders() {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("reminders")
        .select("*")
        .not("schedule", "is", null);
      if (error) throw error;
      return data.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { enabled?: boolean; schedule?: { time: string; days: number[] } };
    }) => {
      const { error } = await createClient()
        .from("reminders")
        .update({ ...patch, ...(patch.schedule ? { schedule: patch.schedule as Json } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Reminder[]>(key);
      queryClient.setQueryData<Reminder[]>(key, (list) =>
        list?.map((r) => (r.id === id ? ({ ...r, ...patch } as Reminder) : r)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(key, ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
