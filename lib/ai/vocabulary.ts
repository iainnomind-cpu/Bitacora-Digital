// Contexto para la transcripción (§7.1). El vocabulario viene del perfil y del proyecto del
// usuario (Ajustes → Mi laboratorio, Proyectos) más los códigos de muestras recientes.

/** Vocabulario que antes estaba fijo; se usa para llenar el perfil de cuentas que ya existían. */
export const NEURO_VOCABULARY = [
  "IBA1",
  "DAB",
  "3xTg",
  "ultramicrotomo",
  "semifino",
  "ultrafino",
  "glutaraldehído",
  "paraformaldehído",
  "PFA",
  "tetróxido de osmio",
  "acetato de uranilo",
  "citrato de plomo",
  "azul de toluidina",
  "Epon",
  "microCT",
  "rejilla",
  "formvar",
  "navaja de vidrio",
  "PBS",
  "Tritón X-100",
  "recuperación antigénica",
  "TEM",
];

/** Términos comunes en cualquier laboratorio biológico. */
export const GENERAL_VOCABULARY = ["PBS", "pH", "µL", "mL", "rpm", "°C", "mM", "µM", "ng/µL"];

export function transcribePrompt(labContext: string) {
  return [
    "Notas de voz de una bitácora de laboratorio en español de México.",
    labContext.slice(0, 600),
    "Se dictan tiempos, volúmenes, concentraciones, unidades y códigos de muestra. Escribe " +
      "números y unidades con cifras y los códigos con letras, cifras y guiones (B-014-A, no " +
      "«be cero catorce a»).",
  ]
    .filter(Boolean)
    .join(" ");
}
