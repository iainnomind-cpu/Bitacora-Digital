// Al empezar una tarea programada: en qué campos va cada muestra y cuántas entradas crear.
import type { FieldDef } from "@/lib/templates/fields";
import { initialValues, type EntryData } from "@/lib/templates/values";

type SampleLite = { code: string; sample_type: string };
export type PlannedEntry = { data: EntryData; sampleCode: string | null };

/** Campo de muestra donde va una muestra de cierto tipo (primero los de lo que se usa). */
function fieldFor(fields: FieldDef[], type: string) {
  const refs = fields.filter(
    (f): f is Extract<FieldDef, { type: "sample_ref" }> =>
      f.type === "sample_ref" && f.sample_type === type,
  );
  return refs.find((f) => f.role === "usada") ?? refs[0];
}

/**
 * Reparte las muestras de la tarea en los campos de la plantilla. Si un campo admite una sola
 * muestra y la tarea trae varias de ese tipo (p. ej. 8 ratones para el laberinto de Morris), se
 * crea una entrada por muestra; el resto de las muestras va igual en todas.
 */
export function planEntries(fields: FieldDef[], samples: SampleLite[]): PlannedEntry[] {
  const base = initialValues(fields);
  const byField = new Map<
    string,
    { field: Extract<FieldDef, { type: "sample_ref" }>; codes: string[] }
  >();
  for (const s of samples) {
    const f = fieldFor(fields, s.sample_type);
    if (!f) continue;
    const slot = byField.get(f.key) ?? { field: f, codes: [] };
    slot.codes.push(s.code);
    byField.set(f.key, slot);
  }

  // Un solo campo "de uno" con varias muestras define una entrada por muestra.
  const splitter = [...byField.values()].find((x) => !x.field.multiple && x.codes.length > 1);
  const fill = (data: EntryData) => {
    for (const { field, codes } of byField.values()) {
      if (field.key === splitter?.field.key) continue;
      data[field.key] = field.multiple ? codes : codes[0];
    }
    return data;
  };

  if (!splitter) return [{ data: fill({ ...base }), sampleCode: null }];
  return splitter.codes.map((code) => ({
    data: { ...fill({ ...base }), [splitter.field.key]: code },
    sampleCode: code,
  }));
}
