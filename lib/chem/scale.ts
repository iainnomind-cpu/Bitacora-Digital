// Escalar una receta leída de un protocolo a otro volumen, con el procedimiento explicado.
// La IA solo transcribe cantidades y volúmenes; las cuentas se hacen aquí.
import { computeRecipe, type RecipeComponent } from "./solutions";
import {
  fmt,
  fmtMass,
  fmtVolume,
  MASS,
  toLiters,
  VOLUME,
  type ConcUnit,
  type MassUnit,
  type VolumeUnit,
} from "./units";

/** Unidades de cantidad que puede traer un protocolo. "unidad" = tabletas, viales, piezas… */
export const AMOUNT_UNITS = [
  ...(Object.keys(MASS) as MassUnit[]),
  ...(Object.keys(VOLUME) as VolumeUnit[]),
  "U",
  "unidad",
] as const;
export type AmountUnit = (typeof AMOUNT_UNITS)[number];

export type ReadComponent = {
  name: string;
  amount: number | null;
  unit: AmountUnit | null;
  concentration: number | null;
  concentration_unit: ConcUnit | null;
  mw: number | null;
  /** El disolvente con el que se afora ("agua c.b.p. 100 mL"). */
  is_solvent: boolean;
  as_written: string;
};

export type ReadSolution = {
  name: string;
  original_volume: number | null;
  original_volume_unit: VolumeUnit | null;
  components: ReadComponent[];
  instructions: string;
  notes: string;
};

const isMass = (u: string): u is MassUnit => u in MASS;
const isVolume = (u: string): u is VolumeUnit => u in VOLUME;

function formatAmount(value: number, unit: AmountUnit): string {
  if (isMass(unit)) return fmtMass(value * MASS[unit]);
  if (isVolume(unit)) return fmtVolume(value * VOLUME[unit]);
  return `${fmt(value)} ${unit === "unidad" ? (value === 1 ? "unidad" : "unidades") : unit}`;
}

export type ScaledLine = {
  name: string;
  original: string;
  scaled: string | null;
  /** "8 g × 0.25 = 2 g" */
  math: string | null;
  note?: string;
  solvent?: boolean;
};

/**
 * Escala la receta al volumen deseado. Cada cantidad se multiplica por el factor
 * (volumen deseado ÷ volumen original); las concentraciones no cambian.
 */
export function scaleSolution(s: ReadSolution, target: number, targetUnit: VolumeUnit) {
  if (!s.original_volume || !s.original_volume_unit) {
    throw new Error(
      "El protocolo no indica el volumen total de esta solución; escríbelo para poder escalarla.",
    );
  }
  if (!(target > 0)) throw new Error("El volumen deseado debe ser mayor que 0.");
  const originalL = toLiters(s.original_volume, s.original_volume_unit);
  const targetL = toLiters(target, targetUnit);
  const factor = targetL / originalL;

  const lines: ScaledLine[] = s.components.map((c) => {
    const original =
      c.as_written || (c.amount != null && c.unit ? formatAmount(c.amount, c.unit) : "—");
    if (c.is_solvent) {
      return {
        name: c.name,
        original,
        scaled: `aforar a ${fmtVolume(targetL)}`,
        math: null,
        solvent: true,
      };
    }
    if ((c.amount == null || !c.unit) && c.concentration != null && c.concentration_unit) {
      // Solo concentración: calcularla para el volumen deseado (sólido con PM, % o masa/vol).
      const r = computeRecipe(
        [
          {
            name: c.name,
            final: c.concentration,
            finalUnit: c.concentration_unit,
            source: "solido",
            mw: c.mw,
          },
        ],
        targetL,
        "L",
      ).lines[0];
      if (!r.error && (r.grams != null || r.liters != null)) {
        const amount = r.grams != null ? fmtMass(r.grams) : fmtVolume(r.liters!);
        return {
          name: c.name,
          original,
          scaled: amount,
          math: `${fmt(c.concentration)} ${c.concentration_unit} en ${fmtVolume(targetL)}${c.mw ? ` (PM ${fmt(c.mw)} g/mol)` : ""} → ${amount}`,
        };
      }
    }
    if (c.amount == null || !c.unit) {
      return {
        name: c.name,
        original,
        scaled: null,
        math: null,
        note:
          c.concentration != null
            ? `Sin cantidad en el protocolo: va a ${fmt(c.concentration)} ${c.concentration_unit ?? ""} (la concentración no cambia).`
            : "El protocolo no indica cantidad.",
      };
    }
    const scaled = c.amount * factor;
    return {
      name: c.name,
      original: formatAmount(c.amount, c.unit),
      scaled: formatAmount(scaled, c.unit),
      math: `${formatAmount(c.amount, c.unit)} × ${fmt(factor)} = ${formatAmount(scaled, c.unit)}`,
      ...(c.unit === "unidad" && !Number.isInteger(scaled)
        ? {
            note: "No da un número entero: prepara la cantidad entera más cercana y ajusta el volumen.",
          }
        : {}),
    };
  });

  return {
    factor,
    explanation: `Factor = volumen deseado ÷ volumen del protocolo = ${fmtVolume(targetL)} ÷ ${fmtVolume(originalL)} = ${fmt(factor)}. Cada cantidad se multiplica por ${fmt(factor)}; las concentraciones finales quedan iguales.`,
    lines,
  };
}

/**
 * Convierte la receta leída a componentes con concentración final (para guardarla en "Mis
 * soluciones" y prepararla en cualquier volumen). Sólidos → g/L (o M si hay PM y se dio en
 * molaridad); líquidos → % v/v. Los que no se pueden convertir se omiten.
 */
export function toRecipeComponents(s: ReadSolution): {
  components: RecipeComponent[];
  skipped: string[];
} {
  const skipped: string[] = [];
  const components: RecipeComponent[] = [];
  const volumeL =
    s.original_volume && s.original_volume_unit
      ? toLiters(s.original_volume, s.original_volume_unit)
      : null;

  for (const c of s.components) {
    if (c.is_solvent) continue;
    if (c.concentration != null && c.concentration_unit && c.concentration_unit !== "X") {
      components.push({
        name: c.name,
        final: c.concentration,
        finalUnit: c.concentration_unit,
        source: "solido",
        mw: c.mw,
        stock: null,
        stockUnit: null,
        note: c.as_written || null,
      });
      continue;
    }
    if (c.amount != null && c.unit && volumeL) {
      if (isMass(c.unit)) {
        components.push({
          name: c.name,
          final: (c.amount * MASS[c.unit]) / volumeL,
          finalUnit: "g/L",
          source: "solido",
          mw: c.mw,
          stock: null,
          stockUnit: null,
          note: c.as_written || null,
        });
        continue;
      }
      if (isVolume(c.unit)) {
        components.push({
          name: c.name,
          final: ((c.amount * VOLUME[c.unit]) / volumeL) * 100,
          finalUnit: "% v/v",
          source: "solido",
          mw: null,
          stock: null,
          stockUnit: null,
          note: c.as_written || null,
        });
        continue;
      }
    }
    skipped.push(c.name);
  }
  return { components, skipped };
}
