// Mientras no exista `profiles.timezone` (etapa 2), se usa la zona por defecto del diseño.
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
