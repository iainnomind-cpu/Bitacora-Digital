// Campos comunes de toda entrada (columnas de entries, fuera de la plantilla).
export const COMMON_TEXT_FIELDS = [
  { key: "objective", label: "Objetivo", multiline: true },
  { key: "observations", label: "Observaciones", multiline: true },
  { key: "results", label: "Resultados", multiline: true },
  { key: "next_steps", label: "Siguiente paso", multiline: true },
  { key: "data_location", label: "Ubicación de datos", multiline: false },
] as const;

export type CommonTextKey = (typeof COMMON_TEXT_FIELDS)[number]["key"];
