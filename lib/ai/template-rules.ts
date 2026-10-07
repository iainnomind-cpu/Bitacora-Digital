// Reglas simples para sugerir plantilla sin llamar al modelo (§7.5 "Optimización").
// Se aplican sobre texto en minúsculas y sin acentos.

const RULES: { activity: string; pattern: RegExp; hint: string }[] = [
  {
    activity: "navaja_vidrio",
    pattern: /\bnavajas?\b|knife ?maker|tiras? de vidrio/,
    hint: "navaja",
  },
  { activity: "corte_semifino", pattern: /semifin/, hint: "semifino" },
  {
    activity: "corte_fino",
    pattern: /\bultrafin|\bcortes? finos?\b|\bfinos\b/,
    hint: "corte fino",
  },
  {
    activity: "contraste_rejillas",
    pattern: /contrast|uranilo|citrato de plomo/,
    hint: "contraste",
  },
  { activity: "tincion", pattern: /tincion|\bdab\b|\biba-?1\b|inmuno|anticuerpo/, hint: "tinción" },
  { activity: "perfusion_fijacion", pattern: /perfus/, hint: "perfusión" },
  { activity: "postfijacion", pattern: /post-? ?fija/, hint: "postfijación" },
  {
    activity: "inclusion_resina",
    pattern: /inclusion|resina|\bepon\b|\bspurr\b|polimeriz/,
    hint: "inclusión en resina",
  },
  { activity: "microct", pattern: /micro-? ?ct|microtomograf/, hint: "microCT" },
  {
    activity: "tratamiento_farmaco",
    pattern: /farmaco|inyecc|inyect|administr|\bdosis\b|tratamiento/,
    hint: "tratamiento",
  },
];

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Actividades que mencionan las reglas, con la palabra que las disparó. */
export function matchActivities(text: string) {
  const t = normalize(text);
  return RULES.filter((r) => r.pattern.test(t)).map((r) => ({
    activity: r.activity,
    hint: r.hint,
  }));
}
