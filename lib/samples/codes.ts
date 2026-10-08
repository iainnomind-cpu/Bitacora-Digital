// Códigos sugeridos para muestras nuevas, para no tener que inventarlos en la mesa.
//   con origen:  3xTg-M-001 → 3xTg-M-001-T1, -T2… (inicial del tipo + número)
//   sin origen:  Animal → A-001, A-002… (siguiente número libre de ese prefijo)

function initial(typeLabel: string) {
  const word = typeLabel
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z]/g, " ")
    .trim()
    .split(/\s+/)[0];
  return (word?.[0] ?? "M").toUpperCase();
}

/** Siguiente código libre. `taken` son los códigos existentes (cualquier tipo). */
export function suggestCode(opts: {
  typeLabel: string;
  parentCode?: string | null;
  taken: Iterable<string>;
}) {
  const used = new Set([...opts.taken].map((c) => c.toLowerCase()));
  const letter = initial(opts.typeLabel);
  if (opts.parentCode) {
    for (let n = 1; n < 1000; n++) {
      const code = `${opts.parentCode}-${letter}${n}`;
      if (!used.has(code.toLowerCase())) return code;
    }
  }
  for (let n = 1; n < 10000; n++) {
    const code = `${letter}-${String(n).padStart(3, "0")}`;
    if (!used.has(code.toLowerCase())) return code;
  }
  return `${letter}-${Date.now()}`;
}

/** ¿`id` desciende de alguno de `ancestors`? (recorre la cadena de origen) */
export function descendsFrom(
  id: string,
  ancestors: Set<string>,
  parentOf: Map<string, string | null>,
): boolean {
  let cur = parentOf.get(id) ?? null;
  for (let depth = 0; cur && depth < 50; depth++) {
    if (ancestors.has(cur)) return true;
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}
