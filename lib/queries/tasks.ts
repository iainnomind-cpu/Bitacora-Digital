"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localDay, occurrenceInstants, type Repeat } from "@/lib/calendar/dates";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { parseFields } from "@/lib/templates/fields";
import { initialValues, type EntryData } from "@/lib/templates/values";

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
 * Empezar una tarea: crea la entrada con su plantilla, proyecto y título, y coloca sus muestras
 * en los campos de muestra del tipo correspondiente. La tarea queda hecha y ligada a la entrada.
 */
export async function startTask(task: ScheduledTask, timeZone: string): Promise<string> {
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

  const fields = parseFields(version.fields);
  const data: EntryData = initialValues(fields);
  for (const s of samples ?? []) {
    const f =
      fields.find(
        (x) => x.type === "sample_ref" && x.sample_type === s.sample_type && x.role === "usada",
      ) ?? fields.find((x) => x.type === "sample_ref" && x.sample_type === s.sample_type);
    if (!f || f.type !== "sample_ref") continue;
    if (f.multiple) data[f.key] = [...((data[f.key] as string[]) ?? []), s.code];
    else if (!data[f.key]) data[f.key] = s.code;
  }

  const { data: entry, error: e3 } = await supabase
    .from("entries")
    .insert({
      entry_date: localDay(task.starts_at, timeZone),
      started_at: new Date().toISOString(),
      template_id: task.template_id,
      template_version: template.current_version,
      title: task.title,
      project_id: task.project_id,
      objective: task.notes,
      data: data as Json,
    })
    .select("id")
    .single();
  if (e3) throw e3;
  await supabase
    .from("scheduled_tasks")
    .update({ status: "hecha", entry_id: entry.id, completed_at: new Date().toISOString() })
    .eq("id", task.id);
  return entry.id;
}

export function useStartTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, timeZone }: { task: ScheduledTask; timeZone: string }) =>
      startTask(task, timeZone),
    onSuccess: () => invalidate(queryClient),
  });
}
