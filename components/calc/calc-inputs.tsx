"use client";

import { useId, type ReactNode } from "react";
import { NumberInput } from "@/components/entry/fields/inputs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMMON_REAGENTS } from "@/lib/chem/common-reagents";
import { useReagentLibrary } from "@/lib/queries/solutions";
import { cn } from "@/lib/utils";

export const unitSelectClass =
  "h-12 shrink-0 rounded-lg border border-input bg-transparent px-2 text-base dark:bg-input/30";

/** Número + unidad en una sola fila. */
export function NumberWithUnit<U extends string>({
  label,
  value,
  onChange,
  unit,
  units,
  onUnit,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit: U;
  units: readonly U[];
  onUnit: (u: U) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <NumberInput id={id} value={value} onChange={onChange} placeholder={placeholder} />
        <select
          value={unit}
          onChange={(e) => onUnit(e.target.value as U)}
          aria-label={`${label}: unidad`}
          className={unitSelectClass}
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function PlainNumber({
  label,
  value,
  onChange,
  suffix,
  integer,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  integer?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <NumberInput
          id={id}
          value={value}
          onChange={onChange}
          integer={integer}
          className={suffix ? "pr-16" : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Reactivo con su peso molecular: al escribir o elegir un nombre de la biblioteca propia o de los
 * reactivos comunes, se llena el PM (editable).
 */
export function ReagentPicker({
  name,
  onName,
  mw,
  onMw,
  label = "Reactivo",
}: {
  name: string;
  onName: (v: string) => void;
  mw: number | null;
  onMw: (v: number | null) => void;
  label?: string;
}) {
  const id = useId();
  const library = useReagentLibrary();
  const options = [
    ...(library.data ?? []).map((r) => ({
      name: r.name,
      mw: r.molecular_weight ? Number(r.molecular_weight) : null,
      formula: r.formula,
    })),
    ...COMMON_REAGENTS,
  ];
  const lookup = (n: string) =>
    options.find(
      (o) =>
        o.name.toLowerCase() === n.trim().toLowerCase() ||
        o.formula?.toLowerCase() === n.trim().toLowerCase(),
    );

  return (
    <div className="grid grid-cols-[1fr_8rem] gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-n`}>{label}</Label>
        <Input
          id={`${id}-n`}
          list={`${id}-list`}
          value={name}
          onChange={(e) => {
            onName(e.target.value);
            const hit = lookup(e.target.value);
            if (hit?.mw) onMw(hit.mw);
          }}
          placeholder="NaCl, Tris base…"
          className="h-12 text-base"
        />
        <datalist id={`${id}-list`}>
          {options.map((o) => (
            <option key={`${o.name}-${o.formula}`} value={o.name}>
              {o.formula} · {o.mw} g/mol
            </option>
          ))}
        </datalist>
      </div>
      <PlainNumber label="PM (g/mol)" value={mw} onChange={onMw} />
    </div>
  );
}

/** Resultado grande y legible (lo que hay que pesar o pipetear). */
export function Result({
  children,
  error,
  hint,
}: {
  children?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-20 flex-col justify-center gap-1 rounded-xl border-2 p-4",
        error ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5",
      )}
    >
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        (children ?? <p className="text-sm text-muted-foreground">Llena los datos.</p>)
      )}
      {hint && !error && <div className="text-sm text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Ejecuta un cálculo y regresa su resultado o el mensaje de error, sin lanzar. */
export function tryCalc<T>(fn: () => T): { value: T | null; error: string | null } {
  try {
    return { value: fn(), error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : String(e) };
  }
}
