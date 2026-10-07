// Pre-agrupación determinista de la bandeja (§7.6, paso 1), antes de llamar al modelo:
// capturas separadas por menos de `gapMinutes` van juntas, y se unen los grupos que comparten
// un código de muestra.

export const DEFAULT_GAP_MINUTES = 20;

// Códigos tipo B-014-A, 3xTg-M-014, N-061026-01, R-014-A-03: bloques alfanuméricos con guiones.
const CODE_PATTERN = /\b[A-Za-z0-9]{1,6}(?:-[A-Za-z0-9]{1,8}){1,4}\b/g;

/** Códigos de muestra escritos en un texto (en mayúsculas, sin repetir). */
export function extractCodes(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = text.match(CODE_PATTERN) ?? [];
  // Al menos un dígito: descarta palabras compuestas como "post-fijación".
  return [...new Set(found.filter((c) => /\d/.test(c)).map((c) => c.toUpperCase()))];
}

export type GroupItem = { id: string; capturedAt: string; codes: string[] };

export function pregroup(items: GroupItem[], gapMinutes = DEFAULT_GAP_MINUTES): string[][] {
  const sorted = [...items].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  // Union-find sobre los índices.
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  for (let i = 1; i < sorted.length; i++) {
    const gap = Date.parse(sorted[i].capturedAt) - Date.parse(sorted[i - 1].capturedAt);
    if (gap < gapMinutes * 60_000) union(i, i - 1);
  }
  const byCode = new Map<string, number>();
  sorted.forEach((item, i) => {
    for (const code of item.codes) {
      const first = byCode.get(code);
      if (first === undefined) byCode.set(code, i);
      else union(i, first);
    }
  });

  const groups = new Map<number, string[]>();
  sorted.forEach((item, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), item.id]);
  });
  return [...groups.values()];
}
