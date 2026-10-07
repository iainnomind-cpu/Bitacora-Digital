// Utilidades de búsqueda en el cliente (§6.1.12).

/**
 * Minúsculas y sin acentos, carácter por carácter (misma longitud que el original), igual que
 * unaccent() en el índice: "Tinción" → "tincion".
 */
export function fold(text: string) {
  let out = "";
  for (const ch of text) {
    const base = ch
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    out += base.length === ch.length ? base : ch.toLowerCase();
  }
  return out;
}

// Mismo criterio que la pre-agrupación de la bandeja: B-014-A, 3xTg-M-014, N-061026-01…
const CODE_LIKE = /^[A-Za-z0-9]{1,6}(?:-[A-Za-z0-9]{1,8}){1,4}$/;

/** ¿La consulta parece un código de muestra? (se busca también en los vínculos). */
export function looksLikeCode(q: string) {
  const t = q.trim();
  return CODE_LIKE.test(t) && /\d/.test(t);
}

/** Valores de texto y número dentro de `data`, a cualquier profundidad. */
export function flattenData(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenData);
  if (typeof value === "object") return Object.values(value).flatMap(flattenData);
  return [];
}

/**
 * Fragmento de ~`width` caracteres alrededor del primer término encontrado, con sus posiciones
 * para resaltarlo. null si ningún término aparece literalmente (p. ej. coincidió por raíz).
 */
export function snippet(texts: (string | null | undefined)[], query: string, width = 140) {
  const terms = fold(query)
    .split(/[\s"]+/)
    .map((t) => t.replace(/^-/, ""))
    .filter((t) => t.length >= 2 && t !== "or");
  if (!terms.length) return null;

  for (const text of texts) {
    if (!text) continue;
    const folded = fold(text);
    let best: { at: number; len: number } | null = null;
    for (const term of terms) {
      const at = folded.indexOf(term);
      if (at >= 0 && (!best || at < best.at)) best = { at, len: term.length };
    }
    if (!best) continue;
    const start = Math.max(0, best.at - Math.floor((width - best.len) / 2));
    const end = Math.min(text.length, start + width);
    return {
      before: (start > 0 ? "…" : "") + text.slice(start, best.at),
      match: text.slice(best.at, best.at + best.len),
      after: text.slice(best.at + best.len, end) + (end < text.length ? "…" : ""),
    };
  }
  return null;
}
