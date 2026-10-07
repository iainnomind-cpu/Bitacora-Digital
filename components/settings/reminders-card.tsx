"use client";

import { Input } from "@/components/ui/input";
import { parseSchedule } from "@/lib/push/schedule";
import { useReminders, useUpdateReminder, type Reminder } from "@/lib/queries/reminders";
import { cn } from "@/lib/utils";

const DAYS = [
  { n: 1, label: "L" },
  { n: 2, label: "M" },
  { n: 3, label: "M" },
  { n: 4, label: "J" },
  { n: 5, label: "V" },
  { n: 6, label: "S" },
  { n: 7, label: "D" },
];
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Recordatorios por defecto, editables (§8): inicio del día, cierre y revisión semanal. */
export function RemindersCard() {
  const reminders = useReminders();
  if (reminders.isPending) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (reminders.error) {
    return (
      <p className="text-sm text-destructive">No se pudieron cargar: {reminders.error.message}</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {reminders.data.map((r) => (
        <ReminderRow key={r.id} reminder={r} />
      ))}
    </ul>
  );
}

function ReminderRow({ reminder }: { reminder: Reminder }) {
  const update = useUpdateReminder();
  const schedule = parseSchedule(reminder.schedule) ?? { time: "09:00", days: [] };
  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate({ id: reminder.id, patch });

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        !reminder.enabled && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{reminder.title}</p>
          {reminder.body && <p className="text-sm text-muted-foreground">{reminder.body}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reminder.enabled}
          aria-label={`${reminder.title}: ${reminder.enabled ? "activado" : "desactivado"}`}
          onClick={() => save({ enabled: !reminder.enabled })}
          className="flex h-12 shrink-0 items-center"
        >
          <span
            className={cn(
              "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors",
              reminder.enabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "size-6 rounded-full bg-background shadow transition-transform",
                reminder.enabled && "translate-x-5",
              )}
            />
          </span>
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <Input
          type="time"
          value={schedule.time}
          onChange={(e) =>
            e.target.value && save({ schedule: { ...schedule, time: e.target.value } })
          }
          aria-label={`${reminder.title}: hora`}
          className="h-12 w-32 text-base"
        />
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={`${reminder.title}: días`}>
          {DAYS.map((d) => {
            const on = schedule.days.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                aria-pressed={on}
                aria-label={DAY_NAMES[d.n - 1]}
                onClick={() =>
                  save({
                    schedule: {
                      ...schedule,
                      days: on
                        ? schedule.days.filter((x) => x !== d.n)
                        : [...schedule.days, d.n].sort(),
                    },
                  })
                }
                className={cn(
                  "flex h-12 items-center justify-center rounded-xl border text-sm font-medium",
                  on && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>
      {update.error && (
        <p role="alert" className="text-sm text-destructive">
          {update.error.message}
        </p>
      )}
    </li>
  );
}
