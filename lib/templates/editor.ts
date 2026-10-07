// Ayudas del editor de plantillas (§5 "Editor de plantillas").
import type { FieldDef, FieldType } from "./fields";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto corto",
  longtext: "Texto largo",
  number: "Número",
  duration: "Duración",
  datetime: "Fecha y hora",
  time: "Hora",
  select: "Opción única",
  multiselect: "Varias opciones",
  boolean: "Sí / No",
  rating: "Calidad 1–5",
  sample_ref: "Muestra",
  reagent: "Reactivo",
  steps: "Pasos (planificado vs real)",
};

export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

/** "Volumen de fijador" → "volumen_de_fijador" (único dentro de la plantilla). */
export function fieldKey(label: string, taken: Iterable<string>) {
  const base =
    label
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "campo";
  const safe = /^[a-z]/.test(base) ? base : `c_${base}`;
  const used = new Set(taken);
  let key = safe;
  for (let i = 2; used.has(key); i++) key = `${safe}_${i}`;
  return key;
}

/** Campo nuevo del tipo indicado, con los valores mínimos válidos. */
export function newField(type: FieldType, label: string, key: string): FieldDef {
  const base = { key, label, required: false };
  switch (type) {
    case "select":
    case "multiselect":
      return { ...base, type, options: ["Opción 1", "Opción 2"] };
    case "sample_ref":
      return { ...base, type, sample_type: "otro", multiple: false, role: "usada" };
    case "reagent":
      return { ...base, type, multiple: false };
    case "steps":
      return { ...base, type, expected: [] };
    default:
      return { ...base, type } as FieldDef;
  }
}

/**
 * Cambia el tipo de un campo conservando etiqueta, clave, obligatorio y ayuda. Los valores que
 * no aplican al nuevo tipo (unidad, opciones, esperado…) se descartan.
 */
export function changeFieldType(field: FieldDef, type: FieldType): FieldDef {
  const next = newField(type, field.label, field.key);
  return {
    ...next,
    required: field.required,
    ...(field.help ? { help: field.help } : {}),
  } as FieldDef;
}

export type TemplateDraft = {
  name: string;
  activity_type: string;
  description: string;
  icon: string;
  color: string;
  fields: FieldDef[];
  protocol_notes: string;
  protocol_sources: string[];
};

export const emptyTemplateDraft = (): TemplateDraft => ({
  name: "",
  activity_type: "",
  description: "",
  icon: "notebook-pen",
  color: "slate",
  fields: [],
  protocol_notes: "",
  protocol_sources: [],
});

/** Clave de actividad a partir del texto libre ("Western blot" → "western_blot"). */
export function activityKey(text: string) {
  return fieldKey(text || "libre", []);
}
