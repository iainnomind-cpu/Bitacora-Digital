// Vocabulario del laboratorio para la transcripción (§7.1): términos que el modelo debe
// escribir tal cual. Los códigos de muestras recientes se agregan en cada llamada.
export const LAB_VOCABULARY = [
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
  "Spurr",
  "Araldita",
  "microCT",
  "vóxel",
  "rejilla",
  "formvar",
  "navaja de vidrio",
  "knifemaker",
  "PBS",
  "Tritón X-100",
  "anticuerpo primario",
  "anticuerpo secundario",
  "recuperación antigénica",
  "estereoscopio",
  "microscopio electrónico de transmisión",
  "TEM",
  "perfusión transcardiaca",
  "postfijación",
];

export const TRANSCRIBE_PROMPT =
  "Notas de voz de una bitácora de laboratorio de neurobiología en español de México: " +
  "histología, inmunohistoquímica, microscopía electrónica, ultramicrotomía y microCT con " +
  "ratones 3xTg. Se dictan tiempos, volúmenes, concentraciones, unidades y códigos de muestra " +
  "(por ejemplo B-014-A, 3xTg-M-014, R-014-A-03). Escribe números y unidades con cifras y " +
  "los códigos de muestra con letras, cifras y guiones (B-014-A, no «be cero catorce a»).";
