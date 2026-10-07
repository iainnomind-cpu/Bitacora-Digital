"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { chipClass } from "@/components/entry/fields/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dilution,
  factorDilution,
  massForMolarity,
  masterMix,
  parseDilution,
  percentSolution,
  serialDilution,
} from "@/lib/chem/solutions";
import {
  CONC_UNITS,
  convertConc,
  dimensionOf,
  fmt,
  fmtMass,
  fmtVolume,
  MASS_CONC,
  MOLAR,
  toGrams,
  toLiters,
  VOLUME,
  MASS,
  type ConcUnit,
  type MassUnit,
  type MolarUnit,
  type VolumeUnit,
} from "@/lib/chem/units";
import { NumberWithUnit, PlainNumber, ReagentPicker, Result, tryCalc } from "./calc-inputs";

const VOLUMES = Object.keys(VOLUME) as VolumeUnit[];
const MASSES = Object.keys(MASS) as MassUnit[];
const MOLARS = Object.keys(MOLAR) as MolarUnit[];
const MOLAR_AND_MASS = [...MOLARS, ...(Object.keys(MASS_CONC) as ConcUnit[])] as ConcUnit[];

/** Masa a pesar para una molaridad (o la molaridad que da una masa). */
export function MolarityCalc() {
  const [name, setName] = useState("");
  const [mw, setMw] = useState<number | null>(null);
  const [mode, setMode] = useState<"masa" | "conc">("masa");
  const [conc, setConc] = useState<number | null>(null);
  const [concUnit, setConcUnit] = useState<ConcUnit>("mM");
  const [vol, setVol] = useState<number | null>(null);
  const [volUnit, setVolUnit] = useState<VolumeUnit>("mL");
  const [mass, setMass] = useState<number | null>(null);
  const [massUnit, setMassUnit] = useState<MassUnit>("mg");

  const r =
    mode === "masa"
      ? conc != null && vol != null && mw
        ? tryCalc(() => massForMolarity({ conc, concUnit, volume: vol, volumeUnit: volUnit, mw }))
        : null
      : mass != null && vol != null && mw
        ? tryCalc(() => toGrams(mass, massUnit) / mw / toLiters(vol, volUnit))
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("masa")}
          className={chipClass(mode === "masa")}
        >
          ¿Cuánto peso?
        </button>
        <button
          type="button"
          onClick={() => setMode("conc")}
          className={chipClass(mode === "conc")}
        >
          ¿Qué concentración?
        </button>
      </div>
      <ReagentPicker name={name} onName={setName} mw={mw} onMw={setMw} />
      {mode === "masa" ? (
        <NumberWithUnit
          label="Concentración deseada"
          value={conc}
          onChange={setConc}
          unit={concUnit}
          units={MOLAR_AND_MASS}
          onUnit={setConcUnit}
        />
      ) : (
        <NumberWithUnit
          label="Masa pesada"
          value={mass}
          onChange={setMass}
          unit={massUnit}
          units={MASSES}
          onUnit={setMassUnit}
        />
      )}
      <NumberWithUnit
        label="Volumen final"
        value={vol}
        onChange={setVol}
        unit={volUnit}
        units={VOLUMES}
        onUnit={setVolUnit}
      />
      <Result
        error={r?.error}
        hint={
          mode === "masa" && r?.value != null
            ? `Disuelve en menos volumen y afora a ${fmt(vol!)} ${volUnit}.`
            : null
        }
      >
        {r?.value != null &&
          (mode === "masa" ? (
            <p className="text-2xl font-semibold">Pesa {fmtMass(r.value)}</p>
          ) : (
            <p className="text-2xl font-semibold">
              {fmt(convertConc(r.value, "M", "mM"))} mM
              <span className="ml-2 text-base font-normal text-muted-foreground">
                ({fmt(r.value)} M)
              </span>
            </p>
          ))}
      </Result>
    </div>
  );
}

/** C1·V1 = C2·V2. */
export function DilutionCalc() {
  const [c1, setC1] = useState<number | null>(null);
  const [u1, setU1] = useState<ConcUnit>("M");
  const [c2, setC2] = useState<number | null>(null);
  const [u2, setU2] = useState<ConcUnit>("mM");
  const [v2, setV2] = useState<number | null>(null);
  const [vu, setVu] = useState<VolumeUnit>("mL");
  const [mw, setMw] = useState<number | null>(null);
  const needsMw = c1 != null && c2 != null && dimensionOf(u1) !== dimensionOf(u2);

  const r =
    c1 != null && c2 != null && v2 != null
      ? tryCalc(() =>
          dilution({
            stock: c1,
            stockUnit: u1,
            final: c2,
            finalUnit: u2,
            finalVolume: v2,
            finalVolumeUnit: vu,
            mw,
          }),
        )
      : null;

  return (
    <div className="flex flex-col gap-4">
      <NumberWithUnit
        label="Stock (C1)"
        value={c1}
        onChange={setC1}
        unit={u1}
        units={CONC_UNITS}
        onUnit={setU1}
      />
      <NumberWithUnit
        label="Final (C2)"
        value={c2}
        onChange={setC2}
        unit={u2}
        units={CONC_UNITS}
        onUnit={setU2}
      />
      <NumberWithUnit
        label="Volumen final (V2)"
        value={v2}
        onChange={setV2}
        unit={vu}
        units={VOLUMES}
        onUnit={setVu}
      />
      {needsMw && <PlainNumber label="Peso molecular (g/mol)" value={mw} onChange={setMw} />}
      <Result error={r?.error} hint={r?.value ? `Dilución 1:${fmt(r.value.factor)}` : null}>
        {r?.value && (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-semibold">{fmtVolume(r.value.stockLiters)} de stock</p>
            <p className="text-lg">+ {fmtVolume(r.value.diluentLiters)} de diluyente</p>
          </div>
        )}
      </Result>
    </div>
  );
}

/** Diluciones 1:X (anticuerpos, colorantes), opcionalmente para varias muestras. */
export function FactorCalc({ initialFactor }: { initialFactor?: string | null }) {
  const [factorText, setFactorText] = useState(initialFactor ?? "1:500");
  const [v, setV] = useState<number | null>(1);
  const [vu, setVu] = useState<VolumeUnit>("mL");
  const [samples, setSamples] = useState<number | null>(1);
  const [excess, setExcess] = useState<number | null>(10);
  const [parts, setParts] = useState<"total" | "diluent">("total");
  const factor = parseDilution(factorText);
  const multiplier = (samples ?? 1) * (1 + (excess ?? 0) / 100);

  const r =
    factor && v != null
      ? tryCalc(() =>
          factorDilution({ factor, finalVolume: v * multiplier, finalVolumeUnit: vu, parts }),
        )
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="factor">Dilución</Label>
        <Input
          id="factor"
          value={factorText}
          onChange={(e) => setFactorText(e.target.value)}
          placeholder="1:500"
          className="h-12 font-mono text-base"
        />
        {!factor && factorText.trim() && (
          <p className="text-sm text-destructive">Escribe algo como 1:500 o 1/200.</p>
        )}
      </div>
      <NumberWithUnit
        label="Volumen por muestra"
        value={v}
        onChange={setV}
        unit={vu}
        units={VOLUMES}
        onUnit={setVu}
      />
      <div className="grid grid-cols-2 gap-2">
        <PlainNumber label="Muestras" value={samples} onChange={setSamples} integer />
        <PlainNumber label="Excedente" value={excess} onChange={setExcess} suffix="%" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setParts("total")}
          className={chipClass(parts === "total")}
        >
          1 en {factor ?? "X"} total
        </button>
        <button
          type="button"
          onClick={() => setParts("diluent")}
          className={chipClass(parts === "diluent")}
        >
          1 + {factor ?? "X"} diluyente
        </button>
      </div>
      <Result
        error={r?.error}
        hint={
          r?.value && multiplier !== 1
            ? `Para ${samples} muestras + ${excess ?? 0} % (×${fmt(multiplier, 3)}): ${fmtVolume(toLiters(v! * multiplier, vu))} en total.`
            : null
        }
      >
        {r?.value && (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-semibold">{fmtVolume(r.value.stockLiters)} de stock</p>
            <p className="text-lg">+ {fmtVolume(r.value.diluentLiters)} de diluyente</p>
          </div>
        )}
      </Result>
    </div>
  );
}

/** Soluciones en % p/v o % v/v. */
export function PercentCalc() {
  const [kind, setKind] = useState<"pv" | "vv">("pv");
  const [pct, setPct] = useState<number | null>(null);
  const [v, setV] = useState<number | null>(null);
  const [vu, setVu] = useState<VolumeUnit>("mL");
  const r =
    pct != null && v != null
      ? tryCalc(() => percentSolution({ percent: pct, volume: v, volumeUnit: vu }))
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setKind("pv")} className={chipClass(kind === "pv")}>
          % p/v (sólido)
        </button>
        <button type="button" onClick={() => setKind("vv")} className={chipClass(kind === "vv")}>
          % v/v (líquido)
        </button>
      </div>
      <PlainNumber label="Porcentaje" value={pct} onChange={setPct} suffix="%" />
      <NumberWithUnit
        label="Volumen final"
        value={v}
        onChange={setV}
        unit={vu}
        units={VOLUMES}
        onUnit={setVu}
      />
      <Result
        error={r?.error}
        hint={r?.value ? "Afora con el disolvente hasta el volumen final." : null}
      >
        {r?.value && (
          <p className="text-2xl font-semibold">
            {kind === "pv"
              ? `Pesa ${fmtMass(r.value.grams)}`
              : `Mide ${fmtVolume(r.value.soluteLiters)}`}
          </p>
        )}
      </Result>
    </div>
  );
}

/** Diluciones seriadas. */
export function SerialCalc() {
  const [start, setStart] = useState<number | null>(null);
  const [unit, setUnit] = useState<ConcUnit>("µM");
  const [factor, setFactor] = useState<number | null>(10);
  const [tubes, setTubes] = useState<number | null>(6);
  const [v, setV] = useState<number | null>(1);
  const [vu, setVu] = useState<VolumeUnit>("mL");
  const r =
    start != null && factor != null && tubes != null && v != null
      ? tryCalc(() =>
          serialDilution({ start, factor, steps: tubes, tubeVolume: v, tubeVolumeUnit: vu }),
        )
      : null;

  return (
    <div className="flex flex-col gap-4">
      <NumberWithUnit
        label="Concentración inicial"
        value={start}
        onChange={setStart}
        unit={unit}
        units={CONC_UNITS}
        onUnit={setUnit}
      />
      <div className="grid grid-cols-2 gap-2">
        <PlainNumber label="Factor (cada tubo)" value={factor} onChange={setFactor} />
        <PlainNumber label="Tubos" value={tubes} onChange={setTubes} integer />
      </div>
      <NumberWithUnit
        label="Volumen por tubo"
        value={v}
        onChange={setV}
        unit={vu}
        units={VOLUMES}
        onUnit={setVu}
      />
      <Result error={r?.error}>
        {r?.value && (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-semibold">
              Pon {fmtVolume(r.value.diluentLiters)} de diluyente en cada tubo y pasa{" "}
              {fmtVolume(r.value.transferLiters)} al siguiente.
            </p>
            <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {r.value.tubes.map((t) => (
                <li key={t.tube} className="font-mono">
                  {t.tube}: {fmt(t.conc)} {unit}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Result>
    </div>
  );
}

/** Conversión entre unidades de concentración. */
export function ConvertCalc() {
  const [value, setValue] = useState<number | null>(null);
  const [from, setFrom] = useState<ConcUnit>("mg/mL");
  const [to, setTo] = useState<ConcUnit>("µM");
  const [mw, setMw] = useState<number | null>(null);
  const [name, setName] = useState("");
  const needsMw = dimensionOf(from) !== dimensionOf(to);
  const r = value != null ? tryCalc(() => convertConc(value, from, to, mw)) : null;

  return (
    <div className="flex flex-col gap-4">
      <NumberWithUnit
        label="Valor"
        value={value}
        onChange={setValue}
        unit={from}
        units={CONC_UNITS}
        onUnit={setFrom}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor="conv-to">Convertir a</Label>
        <select
          id="conv-to"
          value={to}
          onChange={(e) => setTo(e.target.value as ConcUnit)}
          className="h-12 rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30"
        >
          {CONC_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {needsMw && (
        <ReagentPicker
          name={name}
          onName={setName}
          mw={mw}
          onMw={setMw}
          label="Compuesto (para el PM)"
        />
      )}
      <Result error={r?.error}>
        {r?.value != null && (
          <p className="text-2xl font-semibold">
            {fmt(r.value)} {to}
          </p>
        )}
      </Result>
    </div>
  );
}

/** Mezcla maestra: volúmenes por muestra × (n + excedente). */
export function MasterMixCalc() {
  const [samples, setSamples] = useState<number | null>(10);
  const [excess, setExcess] = useState<number | null>(10);
  const [rows, setRows] = useState([
    { name: "Buffer 10X", perSample: 2 as number | null, unit: "µL" },
    { name: "dNTPs 10 mM", perSample: 0.4 as number | null, unit: "µL" },
    { name: "Agua", perSample: 15.6 as number | null, unit: "µL" },
  ]);
  const r =
    samples != null
      ? tryCalc(() =>
          masterMix({
            samples,
            excessPercent: excess ?? 0,
            components: rows
              .filter((x) => x.perSample != null)
              .map((x) => ({ name: x.name, perSample: x.perSample!, unit: x.unit })),
          }),
        )
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <PlainNumber label="Muestras" value={samples} onChange={setSamples} integer />
        <PlainNumber label="Excedente" value={excess} onChange={setExcess} suffix="%" />
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li key={i} className="grid grid-cols-[1fr_6rem_3.5rem_auto] items-end gap-2">
            <Input
              value={row.name}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
              aria-label="Componente"
              className="h-12 text-base"
            />
            <PlainNumber
              label={i === 0 ? "Por muestra" : ""}
              value={row.perSample}
              onChange={(n) => setRows(rows.map((x, j) => (j === i ? { ...x, perSample: n } : x)))}
            />
            <select
              value={row.unit}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))
              }
              aria-label="Unidad"
              className="h-12 rounded-lg border border-input bg-transparent px-1 text-base dark:bg-input/30"
            >
              {["µL", "mL", "ng", "µg", "U"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="size-12"
              aria-label="Quitar"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        className="h-12"
        onClick={() => setRows([...rows, { name: "", perSample: null, unit: "µL" }])}
      >
        <Plus className="size-4" aria-hidden />
        Componente
      </Button>
      <Result
        error={r?.error}
        hint={
          r?.value
            ? `×${fmt(r.value.multiplier, 3)} (${samples} muestras + ${excess ?? 0} %)`
            : null
        }
      >
        {r?.value && (
          <ul className="flex flex-col gap-1">
            {r.value.components.map((c, i) => (
              <li key={i} className="flex justify-between gap-2 text-lg">
                <span>{c.name || `Componente ${i + 1}`}</span>
                <span className="font-semibold tabular-nums">
                  {fmt(c.total)} {c.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Result>
    </div>
  );
}
