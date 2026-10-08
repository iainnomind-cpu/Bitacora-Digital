"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localDay, occurrenceInstants, type Repeat } from "@/lib/calendar/dates";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { planEntries } from "@/lib/calendar/start-plan";
import { parseFields } from "@/lib/templates/fields";

export type ScheduledTask = Tables<"scheduled_tasks">;
export const taskKeys = {
  all: ["scheduled_tasks"] as const,
  range: (a: string, b: string) => ["scheduled_tasks", a, b] as const,
};

/** Tareas cuyo inicio cae entre dos instantes (ISO). */
export function useTasksBetween(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: taskKeys.range(fromIso, toIso),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("scheduled_tasks")
        .select("*")
        .gte("starts_at", fromIso)
        .lt("starts_at", toIso)
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Entradas entre dos días (YYYY-MM-DD, incluidos), sin las anuladas. */
export function useEntriesBetween(fromDay: string, toDay: string) {
  return useQuery({
    queryKey: ["entries", "range", fromDay, toDay],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("entries")
        .select("id, title, status, entry_date, started_at, ended_at, template_id, project_id")
        .gte("entry_date", fromDay)
        .lte("entry_date", toDay)
        .neq("status", "anulada")
        .order("started_at", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

export type TaskInput = {
  title: string;
  notes: string | null;
  template_id: string | null;
  project_id: string | null;
  sample_codes: string[];
  day: string;
  time: string;
  duration_minutes: number | null;
  /** Minutos antes para avisar; null = sin aviso. */
  remind_before: number | null;
  repeat: Repeat;
  timeZone: string;
};

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: taskKeys.all });
  void queryClient.invalidateQueries({ queryKey: ["entries"] });
}

/** Crea la tarea (y sus repeticiones, una fila por día con el mismo series_id). */
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (t: TaskInput) => {
      const instants = occurrenceInstants(t.day, t.time, t.repeat, t.timeZone);
      const series = instants.length > 1 ? crypto.randomUUID() : null;
      const rows = instants.map((at) => ({
        series_id: series,
        title: t.title.trim(),
        notes: t.notes,
        template_id: t.template_id,
        project_id: t.project_id,
        sample_codes: t.sample_codes,
        starts_at: at.toISOString(),
        duration_minutes: t.duration_minutes,
        remind_at:
          t.remind_before == null
            ? null
            : new Date(at.getTime() - t.remind_before * 60_000).toISOString(),
      }));
      const { error } = await createClient().from("scheduled_tasks").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ScheduledTask> }) => {
      const { error } = await createClient().from("scheduled_tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Borra una tarea; con `series`, también las repeticiones pendientes desde esa fecha. */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ task, series }: { task: ScheduledTask; series: boolean }) => {
      let q = createClient().from("scheduled_tasks").delete();
      q =
        series && task.series_id
          ? q
              .eq("series_id", task.series_id)
              .gte("starts_at", task.starts_at)
              .eq("status", "pendiente")
          : q.eq("id", task.id);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/**
 * Empezar una tarea: crea la entrada con su plantilla, proyecto y título, con sus muestras en los
 * campos del tipo correspondiente (una entrada por muestra si la plantilla es de una sola, p. ej.
 * un ratón por prueba conductual). La tarea queda hecha y ligada a la primera entrada.
 */
export async function startTask(task: ScheduledTask, timeZone: string): Promise<string[]> {
  if (!task.template_id) throw new Error("Esta tarea no tiene plantilla.");
  const supabase = createClient();
  const { data: template, error: e1 } = await supabase
    .from("templates")
    .select("current_version")
    .eq("id", task.template_id)
    .single();
  if (e1) throw e1;
  const [{ data: version, error: e2 }, { data: samples }] = await Promise.all([
    supabase
      .from("template_versions")
      .select("fields")
      .eq("template_id", task.template_id)
      .eq("version", template.current_version)
      .single(),
    task.sample_codes.length
      ? supabase.from("samples").select("code, sample_type").in("code", task.sample_codes)
      : Promise.resolve({ data: [] as { code: string; sample_type: string }[] }),
  ]);
  if (e2) throw e2;

  // En el orden en que se eligieron (p. ej. el orden de los ratones en la prueba).
  const ordered = task.sample_codes.flatMap((c) => (samples ?? []).filter((s) => s.code === c));
  const plan = planEntries(parseFields(version.fields), ordered);
  const startedAt = new Date().toISOString();
  const { data: entries, error: e3 } = await supabase
    .from("entries")
    .insert(
      plan.map((p) => ({
        entry_date: localDay(task.starts_at, timeZone),
        started_at: startedAt,
        template_id: task.template_id!,
        template_version: template.current_version,
        title: p.sampleCode ? `${task.title} · ${p.sampleCode}` : task.title,
        project_id: task.project_id,
        objective: task.notes,
        data: p.data as Json,
      })),
    )
    .select("id");
  if (e3) throw e3;
  await supabase
    .from("scheduled_tasks")
    .update({ status: "hecha", entry_id: entries[0].id, completed_at: new Date().toISOString() })
    .eq("id", task.id);
  return entries.map((e) => e.id);
}

export function useStartTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, timeZone }: { task: ScheduledTask; timeZone: string }) =>
      startTask(task, timeZone),
    onSuccess: () => invalidate(queryClient),
  });
}
