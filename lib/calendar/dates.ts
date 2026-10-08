// Fechas del calendario: días calendario "YYYY-MM-DD" (sin hora) y repeticiones de tareas
// en la zona horaria del usuario. Funciones puras.
import { localDayAndWeekday, zonedToUtc } from "@/lib/push/schedule";

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Suma días a un día calendario (en UTC, sin efectos de horario de verano). */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return dayKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 1 = lunes … 7 = domingo */
export function isoWeekday(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Semanas (lunes a domingo) que cubren el mes; `inMonth` marca los días del mes. */
export function monthGrid(year: number, month: number) {
  const first = dayKey(year, month, 1);
  const start = addDays(first, 1 - isoWeekday(first));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = dayKey(year, month, daysInMonth);
  const end = addDays(last, 7 - isoWeekday(last));
  const weeks: { day: string; inMonth: boolean }[][] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isoWeekday(d) === 1) weeks.push([]);
    weeks[weeks.length - 1].push({ day: d, inMonth: d.slice(0, 7) === first.slice(0, 7) });
  }
  return { weeks, start, end };
}

export type Repeat =
  | { kind: "no" }
  | { kind: "cada_dias"; every: number; until: string }
  | { kind: "semanal"; weekdays: number[]; until: string };

export const MAX_OCCURRENCES = 60;

/**
 * Días en que ocurre una tarea a partir de `startDay` (incluido), hasta `until` (incluido) y
 * como máximo MAX_OCCURRENCES.
 */
export function occurrenceDays(startDay: string, repeat: Repeat): string[] {
  if (repeat.kind === "no") return [startDay];
  const days: string[] = [];
  if (repeat.kind === "cada_dias") {
    const step = Math.max(1, Math.floor(repeat.every));
    for (let d = startDay; d <= repeat.until && days.length < MAX_OCCURRENCES; d = addDays(d, step))
      days.push(d);
    return days;
  }
  const wanted = new Set(repeat.weekdays.length ? repeat.weekdays : [isoWeekday(startDay)]);
  for (let d = startDay; d <= repeat.until && days.length < MAX_OCCURRENCES; d = addDays(d, 1)) {
    if (wanted.has(isoWeekday(d))) days.push(d);
  }
  return days;
}

/** Instantes UTC de cada ocurrencia a la hora local `time` (HH:MM) en la zona del usuario. */
export function occurrenceInstants(
  startDay: string,
  time: string,
  repeat: Repeat,
  timeZone: string,
) {
  return occurrenceDays(startDay, repeat).map((d) => zonedToUtc(d, time, timeZone));
}

/** Día calendario local de un instante. */
export const localDay = (iso: string, timeZone: string) =>
  localDayAndWeekday(new Date(iso), timeZone).day;
