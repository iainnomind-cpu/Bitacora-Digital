// Cálculo de recordatorios en la zona horaria de cada usuario (§8 "Envío programado").
// Funciones puras: se prueban sin red.

/** Partes de la fecha/hora local de un instante en una zona IANA. */
function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    isoWeekday: weekdays.indexOf(get("weekday")) + 1, // 1 = lunes … 7 = domingo
  };
}

/** Diferencia (ms) entre la hora local de la zona y UTC en ese instante. */
function offsetMs(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante UTC de "YYYY-MM-DD HH:MM" en la zona dada (maneja cambios de horario). */
export function zonedToUtc(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - offsetMs(new Date(guess), timeZone);
  t = guess - offsetMs(new Date(t), timeZone); // segunda pasada por si el offset cambió
  return new Date(t);
}

export function localDayAndWeekday(now: Date, timeZone: string) {
  const p = partsIn(now, timeZone);
  const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { day, isoWeekday: p.isoWeekday };
}

export type Schedule = { time: string; days: number[] };

export function parseSchedule(value: unknown): Schedule | null {
  if (!value || typeof value !== "object") return null;
  const { time, days } = value as { time?: unknown; days?: unknown };
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  if (!Array.isArray(days) || !days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7))
    return null;
  return { time, days: days as number[] };
}

/**
 * ¿Toca enviar este recordatorio ahora? Sí si hoy (en la zona del usuario) es uno de sus días,
 * ya pasó la hora programada, no han pasado más de `graceMinutes` y no se envió desde
 * entonces. Así funciona con cron cada 5, 10 o 15 minutos sin duplicar envíos.
 */
export function isDue(opts: {
  now: Date;
  timeZone: string;
  schedule: Schedule | null;
  fireAt: string | null;
  lastSentAt: string | null;
  graceMinutes?: number;
}): boolean {
  const grace = (opts.graceMinutes ?? 30) * 60_000;
  const last = opts.lastSentAt ? Date.parse(opts.lastSentAt) : null;
  const now = opts.now.getTime();

  if (opts.fireAt) {
    const at = Date.parse(opts.fireAt);
    return now >= at && now - at <= grace && (last == null || last < at);
  }
  if (!opts.schedule) return false;
  const { day, isoWeekday } = localDayAndWeekday(opts.now, opts.timeZone);
  if (!opts.schedule.days.includes(isoWeekday)) return false;
  const at = zonedToUtc(day, opts.schedule.time, opts.timeZone).getTime();
  return now >= at && now - at <= grace && (last == null || last < at);
}

/**
 * ¿El borrador ya venció? Se cierra `autoCloseHours` después del inicio del día de la entrada
 * (48 h = a las 23:59 del día siguiente, §3).
 */
export function isExpiredDraft(
  entryDate: string,
  autoCloseHours: number,
  timeZone: string,
  now: Date,
) {
  const start = zonedToUtc(entryDate, "00:00", timeZone).getTime();
  return now.getTime() >= start + autoCloseHours * 3600_000;
}
