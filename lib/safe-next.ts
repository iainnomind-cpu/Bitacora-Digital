/** Acepta solo rutas internas para el parámetro `next` (evita redirecciones abiertas). */
export function safeNext(value: string | null | undefined, fallback = "/hoy") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
