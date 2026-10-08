"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Plus } from "lucide-react";
import { StatusBadge } from "@/components/entry/status-badge";
import { TemplateIcon } from "@/components/templates/template-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { localDay, monthGrid } from "@/lib/calendar/dates";
import { dateInTimeZone, formatLongDate, formatTime } from "@/lib/datetime";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useTimeZone } from "@/lib/queries/profile";
import { zonedToUtc } from "@/lib/push/schedule";
import { useEntriesBetween, useTasksBetween } from "@/lib/queries/tasks";
import { useTemplates } from "@/lib/queries/templates";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";
import { TaskForm } from "./task-form";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Calendario: mes con lo hecho (entradas) y lo programado (tareas); al tocar un día se ve su
 * lista con horas. `?dia=YYYY-MM-DD` abre un día (lo usan las notificaciones).
 */
export function CalendarView() {
  const mounted = useMounted();
  const timeZone = useTimeZone();
  if (!mounted) return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  return <Calendar today={dateInTimeZone(new Date(), timeZone)} timeZone={timeZone} />;
}

function Calendar({ today, timeZone }: { today: string; timeZone: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(params.get("dia") ?? "") ? params.get("dia")! : today;
  const [view, setView] = useState(() => ({
    y: Number(selected.slice(0, 4)),
    m: Number(selected.slice(5, 7)),
  }));
  const [creating, setCreating] = useState(false);
  const templates = useTemplates();

  const { weeks, start, end } = monthGrid(view.y, view.m);
  const fromIso = zonedToUtc(start, "00:00", timeZone).toISOString();
  const toIso = zonedToUtc(end, "23:59", timeZone).toISOString();
  const entries = useEntriesBetween(start, end);
  const tasks = useTasksBetween(fromIso, toIso);
  const byTemplate = new Map(templates.data?.map((t) => [t.id, t]));

  const entriesOn = (day: string) => (entries.data ?? []).filter((e) => e.entry_date === day);
  const tasksOn = (day: string) =>
    (tasks.data ?? []).filter((t) => localDay(t.starts_at, timeZone) === day);

  const select = (day: string) => {
    setCreating(false);
    router.replace(`${pathname}?dia=${day}`, { scroll: false });
  };
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(view.y, view.m - 1 + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  };

  const dayEntries = entriesOn(selected);
  const dayTasks = tasksOn(selected).filter((t) => t.status !== "hecha" || !t.entry_id);
  const [sy, sm, sd] = selected.split("-").map(Number);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label="Mes anterior"
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <h2 className="font-heading text-lg font-semibold first-letter:uppercase">
          {MONTHS[view.m - 1]} {view.y}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label="Mes siguiente"
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>

      <div role="grid" aria-label="Calendario" className="flex flex-col gap-1">
        <div
          className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground"
          role="row"
        >
          {WEEKDAYS.map((d, i) => (
            <span key={i} role="columnheader">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w[0].day} className="grid grid-cols-7 gap-1" role="row">
            {w.map(({ day, inMonth }) => {
              const nEntries = entriesOn(day).length;
              const dayT = tasksOn(day);
              const nPending = dayT.filter((t) => t.status === "pendiente").length;
              const isSel = day === selected;
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-label={`${day}: ${nEntries} entradas, ${nPending} tareas pendientes`}
                  onClick={() => select(day)}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors",
                    inMonth ? "" : "text-muted-foreground/50",
                    isSel ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    day === today && !isSel && "ring-2 ring-primary/40",
                  )}
                >
                  <span className="font-medium tabular-nums">{Number(day.slice(8))}</span>
                  <span className="flex h-1.5 gap-0.5">
                    {nEntries > 0 && (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          isSel ? "bg-primary-foreground" : "bg-emerald-500",
                        )}
                      />
                    )}
                    {nPending > 0 && (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          isSel ? "bg-primary-foreground/70" : "bg-sky-500",
                        )}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" /> Registrado
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-sky-500" /> Programado
          </span>
          {selected !== today && (
            <button
              type="button"
              className="ml-auto font-medium text-primary"
              onClick={() => {
                setView({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
                select(today);
              }}
            >
              Ir a hoy
            </button>
          )}
        </div>
      </div>

      <section aria-labelledby="dia-elegido" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="dia-elegido"
            className="font-heading text-lg font-semibold first-letter:uppercase"
          >
            {formatLongDate(new Date(Date.UTC(sy, sm - 1, sd, 12)), "UTC")}
          </h2>
          {dayEntries.length > 0 && (
            <Link
              href={`/imprimir?desde=${selected}&hasta=${selected}`}
              className={cn(buttonVariants({ variant: "ghost" }), "h-12 gap-1.5")}
            >
              <FileDown className="size-4" aria-hidden />
              PDF
            </Link>
          )}
        </div>

        {creating ? (
          <TaskForm day={selected} onDone={() => setCreating(false)} />
        ) : (
          <Button variant="outline" className="h-12" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            Programar tarea este día
          </Button>
        )}

        {dayTasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Programado</h3>
            {dayTasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Registrado</h3>
          {entries.isPending ? (
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
          ) : dayEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada registrado este día.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {dayEntries.map((e) => {
                const t = byTemplate.get(e.template_id);
                return (
                  <li key={e.id}>
                    <Link
                      href={`/entrada/${e.id}`}
                      className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/50"
                    >
                      <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                        {formatTime(e.started_at, timeZone)}
                        {e.ended_at && `–${formatTime(e.ended_at, timeZone)}`}
                      </span>
                      <TemplateIcon
                        icon={t?.icon ?? null}
                        color={t?.color ?? null}
                        className="size-9"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title || t?.name}</span>
                        <StatusBadge status={e.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
