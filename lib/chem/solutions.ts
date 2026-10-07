// Cálculos para preparar soluciones. Funciones puras (se prueban sin interfaz).
import {
  convertConc,
  dimensionOf,
  toLiters,
  UnitError,
  type ConcUnit,
  type VolumeUnit,
} from "./units";

/** Masa a pesar para una molaridad: m = C · V · PM. Regresa gramos. */
export function massForMolarity(opts: {
  conc: number;
  concUnit: ConcUnit;
  volume: number;
  volumeUnit: VolumeUnit;
  mw: number;
}): number {
  if (!(opts.mw > 0)) throw new UnitError("El peso molecular debe ser mayor que 0.");
  const molPerL = convertConc(opts.conc, opts.concUnit, "M", opts.mw);
  return molPerL * toLiters(opts.volume, opts.volumeUnit) * opts.mw;
}

/** Masa (g) o volumen (L) de soluto para una solución en % p/v o % v/v. */
export function percentSolution(opts: { percent: number; volume: number; volumeUnit: VolumeUnit }) {
  const mL = toLiters(opts.volume, opts.volumeUnit) * 1000;
  return { grams: (opts.percent * mL) / 100, soluteLiters: (opts.percent * mL) / 100 / 1000 };
}

/**
 * C1·V1 = C2·V2. Regresa el volumen de stock (V1, en L) y de diluyente para llegar a V2.
 * Acepta unidades distintas en C1 y C2 (con PM si cambia de molar a masa).
 */
export function dilution(opts: {
  stock: number;
  stockUnit: ConcUnit;
  final: number;
  finalUnit: ConcUnit;
  finalVolume: number;
  finalVolumeUnit: VolumeUnit;
  mw?: number | null;
}) {
  const c1 = opts.stock;
  const c2 = convertConc(opts.final, opts.finalUnit, opts.stockUnit, opts.mw);
  if (!(c1 > 0)) throw new UnitError("La concentración del stock debe ser mayor que 0.");
  if (c2 > c1) throw new UnitError("La concentración final no puede ser mayor que la del stock.");
  const v2 = toLiters(opts.finalVolume, opts.finalVolumeUnit);
  const v1 = (c2 * v2) / c1;
  return { stockLiters: v1, diluentLiters: v2 - v1, factor: c1 / c2 };
}

/** Lee un factor de dilución escrito como "1:500", "1/500", "500" o "10X". */
export function parseDilution(text: string): number | null {
  const m = /^(?:1\s*[:/]\s*)?(\d+(?:\.\d+)?)\s*[xX]?(?![\d.])/.exec(text.trim().replace(",", "."));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

/**
 * Dilución por factor: `parts` = "total" (convención usual, 1:500 = 1 parte en 500 totales) o
 * "diluent" (1 parte + 500 de diluyente).
 */
export function factorDilution(opts: {
  factor: number;
  finalVolume: number;
  finalVolumeUnit: VolumeUnit;
  parts?: "total" | "diluent";
}) {
  if (!(opts.factor >= 1)) throw new UnitError("El factor de dilución debe ser 1 o mayor.");
  const v2 = toLiters(opts.finalVolume, opts.finalVolumeUnit);
  const totalParts = opts.parts === "diluent" ? opts.factor + 1 : opts.factor;
  const stock = v2 / totalParts;
  return { stockLiters: stock, diluentLiters: v2 - stock };
}

/**
 * Diluciones seriadas: `steps` tubos, cada uno con `tubeVolume` final (antes de pasar al
 * siguiente) y factor `factor`. Regresa cuánto pasar y cuánto diluyente poner, y la
 * concentración de cada tubo.
 */
export function serialDilution(opts: {
  start: number;
  factor: number;
  steps: number;
  tubeVolume: number;
  tubeVolumeUnit: VolumeUnit;
}) {
  if (!(opts.factor > 1)) throw new UnitError("El factor debe ser mayor que 1.");
  if (!Number.isInteger(opts.steps) || opts.steps < 1 || opts.steps > 24) {
    throw new UnitError("Entre 1 y 24 tubos.");
  }
  const v = toLiters(opts.tubeVolume, opts.tubeVolumeUnit);
  const transfer = v / opts.factor;
  return {
    transferLiters: transfer,
    diluentLiters: v - transfer,
    tubes: Array.from({ length: opts.steps }, (_, i) => ({
      tube: i + 1,
      conc: opts.start / opts.factor ** (i + 1),
    })),
  };
}

/** Mezcla maestra: cantidades por muestra × (n + excedente %). */
export function masterMix(opts: {
  samples: number;
  excessPercent: number;
  components: { name: string; perSample: number; unit: string }[];
}) {
  if (!(opts.samples > 0)) throw new UnitError("El número de muestras debe ser mayor que 0.");
  const multiplier = opts.samples * (1 + Math.max(0, opts.excessPercent) / 100);
  return {
    multiplier,
    components: opts.components.map((c) => ({ ...c, total: c.perSample * multiplier })),
  };
}

// ---------------------------------------------------------------------------
// Recetas de varios componentes (PBS, Tris-HCl, PFA…)
// ---------------------------------------------------------------------------

/** Cómo se agrega un componente: pesando un sólido o pipeteando de un stock. */
export type RecipeComponent = {
  name: string;
  /** Concentración final deseada en la solución. */
  final: number;
  finalUnit: ConcUnit;
  source: "solido" | "stock";
  /** g/mol; necesario para sólidos en molaridad o para convertir molar ↔ masa. */
  mw?: number | null;
  /** Para source = "stock": concentración del stock. */
  stock?: number | null;
  stockUnit?: ConcUnit | null;
  note?: string | null;
};

export type RecipeLine = RecipeComponent & {
  /** Gramos a pesar (sólidos) o litros a pipetear (stocks y líquidos puros en % v/v). */
  grams?: number;
  liters?: number;
  error?: string;
};

/** Cantidades de cada componente para `finalVolume`; el resto se completa con agua/diluyente. */
export function computeRecipe(
  components: RecipeComponent[],
  finalVolume: number,
  unit: VolumeUnit,
) {
  const v = toLiters(finalVolume, unit);
  const lines: RecipeLine[] = components.map((c) => {
    try {
      if (c.source === "stock") {
        if (!c.stock || !c.stockUnit) throw new UnitError("Falta la concentración del stock.");
        const d = dilution({
          stock: c.stock,
          stockUnit: c.stockUnit,
          final: c.final,
          finalUnit: c.finalUnit,
          finalVolume: v,
          finalVolumeUnit: "L",
          mw: c.mw,
        });
        return { ...c, liters: d.stockLiters };
      }
      const dim = dimensionOf(c.finalUnit);
      if (dim === "vv") return { ...c, liters: (c.final / 100) * v };
      if (dim === "x") throw new UnitError("Una concentración en X se prepara desde un stock.");
      if (dim === "molar") {
        if (!c.mw) throw new UnitError("Falta el peso molecular.");
        return {
          ...c,
          grams: massForMolarity({
            conc: c.final,
            concUnit: c.finalUnit,
            volume: v,
            volumeUnit: "L",
            mw: c.mw,
          }),
        };
      }
      return { ...c, grams: convertConc(c.final, c.finalUnit, "g/L") * v };
    } catch (e) {
      return { ...c, error: e instanceof Error ? e.message : String(e) };
    }
  });
  const liquids = lines.reduce((sum, l) => sum + (l.liters ?? 0), 0);
  return { lines, fillLiters: v - liquids, overfilled: liquids > v };
}

/** Escala una receta a otro volumen final (las concentraciones no cambian). */
export const scaleFactor = (fromVolumeL: number, toVolumeL: number) => toVolumeL / fromVolumeL;
