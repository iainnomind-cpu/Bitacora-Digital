// Unidades para preparar soluciones. Todo se convierte a una base:
//   volumen → L · masa → g · cantidad → mol · molaridad → mol/L · masa/volumen → g/L
// El porcentaje p/v se trata como masa/volumen (1 % p/v = 1 g/100 mL = 10 g/L).

export const VOLUME = { L: 1, mL: 1e-3, µL: 1e-6, nL: 1e-9 } as const;
export const MASS = { kg: 1e3, g: 1, mg: 1e-3, µg: 1e-6, ng: 1e-9 } as const;
export const AMOUNT = { mol: 1, mmol: 1e-3, µmol: 1e-6, nmol: 1e-9 } as const;
export const MOLAR = { M: 1, mM: 1e-3, µM: 1e-6, nM: 1e-9, pM: 1e-12 } as const;
export const MASS_CONC = {
  "g/L": 1,
  "mg/mL": 1,
  "µg/µL": 1,
  "mg/L": 1e-3,
  "µg/mL": 1e-3,
  "ng/µL": 1e-3,
  "ng/mL": 1e-6,
  "% p/v": 10,
} as const;

export type VolumeUnit = keyof typeof VOLUME;
export type MassUnit = keyof typeof MASS;
export type AmountUnit = keyof typeof AMOUNT;
export type MolarUnit = keyof typeof MOLAR;
export type MassConcUnit = keyof typeof MASS_CONC;

/** Unidades de concentración que se pueden convertir entre sí (con peso molecular si cambia la dimensión). */
export type ConcUnit = MolarUnit | MassConcUnit | "% v/v" | "X";
export const CONC_UNITS: ConcUnit[] = [
  ...(Object.keys(MOLAR) as MolarUnit[]),
  ...(Object.keys(MASS_CONC) as MassConcUnit[]),
  "% v/v",
  "X",
];

export type Dimension = "molar" | "mass" | "vv" | "x";
export function dimensionOf(unit: ConcUnit): Dimension {
  if (unit in MOLAR) return "molar";
  if (unit in MASS_CONC) return "mass";
  return unit === "% v/v" ? "vv" : "x";
}

export class UnitError extends Error {}

/**
 * Convierte una concentración a otra unidad. Entre molaridad y masa/volumen hace falta el peso
 * molecular (g/mol). "% v/v" y "X" solo se convierten dentro de su propia dimensión.
 */
export function convertConc(
  value: number,
  from: ConcUnit,
  to: ConcUnit,
  mw?: number | null,
): number {
  if (from === to) return value;
  const df = dimensionOf(from);
  const dt = dimensionOf(to);
  if (df === dt) {
    if (df === "molar") return (value * MOLAR[from as MolarUnit]) / MOLAR[to as MolarUnit];
    if (df === "mass")
      return (value * MASS_CONC[from as MassConcUnit]) / MASS_CONC[to as MassConcUnit];
    return value;
  }
  if ((df === "molar" && dt === "mass") || (df === "mass" && dt === "molar")) {
    if (!mw || mw <= 0)
      throw new UnitError(
        "Para pasar entre molaridad y masa/volumen se necesita el peso molecular.",
      );
    if (df === "molar") {
      const gPerL = value * MOLAR[from as MolarUnit] * mw;
      return gPerL / MASS_CONC[to as MassConcUnit];
    }
    const molPerL = (value * MASS_CONC[from as MassConcUnit]) / mw;
    return molPerL / MOLAR[to as MolarUnit];
  }
  throw new UnitError(`No se puede convertir ${from} a ${to}.`);
}

export const toLiters = (v: number, u: VolumeUnit) => v * VOLUME[u];
export const fromLiters = (l: number, u: VolumeUnit) => l / VOLUME[u];
export const toGrams = (m: number, u: MassUnit) => m * MASS[u];
export const fromGrams = (g: number, u: MassUnit) => g / MASS[u];

/** Elige la unidad de volumen más legible (µL < 1 mL ≤ mL < 1 L ≤ L). */
export function bestVolume(liters: number): { value: number; unit: VolumeUnit } {
  const abs = Math.abs(liters);
  if (abs >= 1) return { value: liters, unit: "L" };
  if (abs >= 1e-3) return { value: liters / 1e-3, unit: "mL" };
  if (abs >= 1e-6 || abs === 0) return { value: liters / 1e-6, unit: "µL" };
  return { value: liters / 1e-9, unit: "nL" };
}

/** Elige la unidad de masa más legible. */
export function bestMass(grams: number): { value: number; unit: MassUnit } {
  const abs = Math.abs(grams);
  if (abs >= 1000) return { value: grams / 1e3, unit: "kg" };
  if (abs >= 1) return { value: grams, unit: "g" };
  if (abs >= 1e-3 || abs === 0) return { value: grams / 1e-3, unit: "mg" };
  if (abs >= 1e-6) return { value: grams / 1e-6, unit: "µg" };
  return { value: grams / 1e-9, unit: "ng" };
}

/** Número con 3–4 cifras significativas, coma decimal no (se usa punto, como en el laboratorio). */
export function fmt(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e5 || abs < 1e-3) return n.toExponential(2).replace("e", " × 10^");
  return Number(n.toPrecision(digits)).toString();
}

export const fmtVolume = (liters: number) => {
  const { value, unit } = bestVolume(liters);
  return `${fmt(value)} ${unit}`;
};
export const fmtMass = (grams: number) => {
  const { value, unit } = bestMass(grams);
  return `${fmt(value)} ${unit}`;
};
