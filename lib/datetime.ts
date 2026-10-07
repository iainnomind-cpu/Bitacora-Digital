// Fechas y horas siempre en la zona horaria del usuario (profiles.timezone); se guardan en UTC.
export const DEFAULT_TIMEZONE = "America/Mexico_City";

export function formatLongDate(date: Date, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** Día calendario (YYYY-MM-DD) de un instante en la zona dada. */
export function dateInTimeZone(date: Date, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

export function formatTime(iso: string | null, timeZone = DEFAULT_TIMEZONE) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string | null, timeZone = DEFAULT_TIMEZONE) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** "7 oct 2026" a partir de un día calendario YYYY-MM-DD (sin desplazar por zona horaria). */
export function formatEntryDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
