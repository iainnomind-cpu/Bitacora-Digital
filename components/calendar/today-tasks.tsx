"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { dateInTimeZone } from "@/lib/datetime";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useTimeZone } from "@/lib/queries/profile";
import { zonedToUtc } from "@/lib/push/schedule";
import { useTasksBetween } from "@/lib/queries/tasks";
import { TaskCard } from "./task-card";

/** "Programado para hoy" en la vista Hoy (tareas pendientes del día). */
export function TodayTasks() {
  const mounted = useMounted();
  const timeZone = useTimeZone();
  if (!mounted) return null;
  return <List today={dateInTimeZone(new Date(), timeZone)} timeZone={timeZone} />;
}

function List({ today, timeZone }: { today: string; timeZone: string }) {
  const tasks = useTasksBetween(
    zonedToUtc(today, "00:00", timeZone).toISOString(),
    zonedToUtc(today, "23:59", timeZone).toISOString(),
  );
  const pending = (tasks.data ?? []).filter((t) => t.status === "pendiente");
  if (!pending.length) return null;
  return (
    <section aria-labelledby="programado-hoy" className="mt-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="programado-hoy" className="font-heading text-lg font-semibold">
          Programado para hoy
        </h2>
        <Link
          href={`/calendario?dia=${today}`}
          className="flex min-h-12 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <CalendarDays className="size-4" aria-hidden />
          Calendario
        </Link>
      </div>
      {pending.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </section>
  );
}
