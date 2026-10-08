"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Check, Clock, Loader2, Play, Repeat, Trash2 } from "lucide-react";
import { TemplateIcon } from "@/components/templates/template-icon";
import { Button } from "@/components/ui/button";
import { localDay } from "@/lib/calendar/dates";
import { formatTime } from "@/lib/datetime";
import { useNow } from "@/lib/hooks/use-now";
import { useTimeZone } from "@/lib/queries/profile";
import {
  useDeleteTask,
  useStartTask,
  useUpdateTask,
  type ScheduledTask,
} from "@/lib/queries/tasks";
import { useTemplates } from "@/lib/queries/templates";
import { cn } from "@/lib/utils";

/** Una tarea programada con sus acciones: empezar (crea la entrada), hecha, cancelar, borrar. */
export function TaskCard({ task }: { task: ScheduledTask }) {
  const router = useRouter();
  const timeZone = useTimeZone();
  const templates = useTemplates();
  const start = useStartTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const template = templates.data?.find((t) => t.id === task.template_id);
  const pending = task.status === "pendiente";
  const now = useNow();
  const overdue = pending && now > 0 && Date.parse(task.starts_at) < now - 60 * 60_000;
  const busy = start.isPending || update.isPending || remove.isPending;

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3",
        !pending && "opacity-70",
        overdue && "border-amber-500/60",
      )}
    >
      <div className="flex items-start gap-3">
        <TemplateIcon
          icon={template?.icon ?? "clipboard-list"}
          color={template?.color ?? null}
          className="size-10"
        />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", task.status === "cancelada" && "line-through")}>
            {task.title}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {formatTime(task.starts_at, timeZone)}
              {task.duration_minutes ? ` · ${task.duration_minutes} min` : ""}
            </span>
            {task.series_id && <Repeat className="size-3.5" aria-label="Se repite" />}
            {template && <span>{template.name}</span>}
            {task.status === "hecha" && (
              <span className="text-emerald-700 dark:text-emerald-400">Hecha</span>
            )}
            {task.status === "cancelada" && <span>Cancelada</span>}
            {overdue && <span className="text-amber-700 dark:text-amber-400">Atrasada</span>}
          </p>
          {task.sample_codes.length > 0 && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {task.sample_codes.join(", ")}
            </p>
          )}
          {task.notes && <p className="mt-1 text-sm">{task.notes}</p>}
        </div>
      </div>

      {task.entry_id && (
        <Link
          href={`/entrada/${task.entry_id}`}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Ver la entrada →
        </Link>
      )}
      {(start.error || update.error || remove.error) && (
        <p role="alert" className="text-sm text-destructive">
          {(start.error ?? update.error ?? remove.error)?.message}
        </p>
      )}

      {pending && !confirmDelete && (
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
          {task.template_id ? (
            <Button
              className="h-12"
              disabled={busy}
              onClick={() =>
                start.mutate(
                  { task, timeZone },
                  {
                    onSuccess: (ids) =>
                      router.push(
                        ids.length === 1
                          ? `/entrada/${ids[0]}`
                          : `/calendario?dia=${localDay(task.starts_at, timeZone)}`,
                      ),
                  },
                )
              }
            >
              {start.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
              Empezar
            </Button>
          ) : (
            <Button
              className="h-12"
              disabled={busy}
              onClick={() =>
                update.mutate({
                  id: task.id,
                  patch: { status: "hecha", completed_at: new Date().toISOString() },
                })
              }
            >
              <Check className="size-4" aria-hidden />
              Marcar hecha
            </Button>
          )}
          {task.template_id && (
            <Button
              variant="outline"
              size="icon"
              className="size-12"
              aria-label="Marcar hecha sin entrada"
              disabled={busy}
              onClick={() =>
                update.mutate({
                  id: task.id,
                  patch: { status: "hecha", completed_at: new Date().toISOString() },
                })
              }
            >
              <Check className="size-4" aria-hidden />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="size-12"
            aria-label="Cancelar tarea"
            disabled={busy}
            onClick={() => update.mutate({ id: task.id, patch: { status: "cancelada" } })}
          >
            <Ban className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-12"
            aria-label="Borrar tarea"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      )}
      {!pending && !task.entry_id && (
        <Button
          variant="ghost"
          className="h-12"
          disabled={busy}
          onClick={() =>
            update.mutate({ id: task.id, patch: { status: "pendiente", completed_at: null } })
          }
        >
          Volver a pendiente
        </Button>
      )}
      {confirmDelete && (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-2">
          <p className="text-sm">¿Borrar esta tarea?</p>
          <div className={cn("grid gap-2", task.series_id ? "grid-cols-3" : "grid-cols-2")}>
            <Button variant="outline" className="h-12" onClick={() => setConfirmDelete(false)}>
              No
            </Button>
            <Button
              variant="destructive"
              className="h-12"
              disabled={busy}
              onClick={() => remove.mutate({ task, series: false })}
            >
              {task.series_id ? "Solo esta" : "Borrar"}
            </Button>
            {task.series_id && (
              <Button
                variant="destructive"
                className="h-12"
                disabled={busy}
                onClick={() => remove.mutate({ task, series: true })}
              >
                Esta y siguientes
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
