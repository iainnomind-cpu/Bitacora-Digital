"use client";

import Link from "next/link";
import { Beaker, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseDilution } from "@/lib/chem/solutions";
import { useSamples } from "@/lib/queries/samples";
import { SamplePicker } from "@/components/samples/sample-picker";
import {
  emptyReagent,
  emptyStep,
  REAGENT_PARTS,
  type Reagent,
  type Step,
} from "@/lib/templates/fields";
import { DurationInput, fieldInputClass } from "./inputs";
import type { FieldProps } from "./basic-fields";

// ---------------------------------------------------------------------------
// sample_ref — códigos de muestra (las muestras se crean y vinculan en etapas 4 y 7)
// ---------------------------------------------------------------------------
export function SampleRefField({
  id,
  field,
  value,
  onChange,
  disabled,
  invalid,
  form,
}: FieldProps<"sample_ref">) {
  const samples = useSamples();
  const codes = Array.isArray(value)
    ? (value as string[])
    : typeof value === "string" && value
      ? [value]
      : [];

  // Muestras elegidas en los otros campos de muestra de la entrada (posibles orígenes).
  const otherCodes = new Set(
    (form?.fields ?? [])
      .filter((f) => f.type === "sample_ref" && f.key !== field.key)
      .flatMap((f) => {
        const v = form?.data[f.key];
        return Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
      }),
  );
  const related = (samples.data ?? []).filter((s) => otherCodes.has(s.code));

  return (
    <SamplePicker
      id={id}
      field={field}
      value={codes}
      related={related}
      disabled={disabled}
      invalid={invalid}
      onChange={(next) => onChange(field.multiple ? next : (next[0] ?? null))}
    />
  );
}

// ---------------------------------------------------------------------------
// reagent — nombre, marca, lote, concentración/dilución
// ---------------------------------------------------------------------------
function ReagentInputs({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: Reagent;
  onChange: (value: Reagent) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {REAGENT_PARTS.map((part, i) => (
        <label key={part.key} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{part.label}</span>
          <Input
            id={i === 0 ? idPrefix : undefined}
            value={value[part.key] ?? ""}
            onChange={(e) => onChange({ ...value, [part.key]: e.target.value || null })}
            disabled={disabled}
            className={fieldInputClass}
          />
        </label>
      ))}
      {value.concentracion && parseDilution(value.concentracion) && (
        <Link
          href={`/calculadora?herramienta=factor&dilucion=${encodeURIComponent(value.concentracion)}`}
          className="flex min-h-12 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:col-span-2"
        >
          <Beaker className="size-4" aria-hidden />
          Calcular volúmenes para {value.concentracion}
        </Link>
      )}
    </div>
  );
}

export function ReagentField({ id, field, value, onChange, disabled }: FieldProps<"reagent">) {
  if (!field.multiple) {
    return (
      <ReagentInputs
        idPrefix={id}
        value={(value as Reagent | null) ?? emptyReagent()}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  const current = Array.isArray(value) ? (value as Reagent[]) : [];
  return (
    <div className="flex flex-col gap-3">
      {current.map((reagent, i) => (
        <div key={i} className="rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Reactivo {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-12"
              aria-label={`Quitar reactivo ${i + 1}`}
              disabled={disabled}
              onClick={() => onChange(current.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
          <ReagentInputs
            idPrefix={i === 0 ? id : `${id}-${i}`}
            value={reagent}
            onChange={(r) => onChange(current.map((x, j) => (j === i ? r : x)))}
            disabled={disabled}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-12"
        disabled={disabled}
        onClick={() => onChange([...current, emptyReagent()])}
      >
        <Plus className="size-4" aria-hidden />
        Agregar reactivo
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// steps — pasos con duración planificada vs real
// ---------------------------------------------------------------------------
export function StepsField({ id, value, onChange, disabled }: FieldProps<"steps">) {
  const current = Array.isArray(value) ? (value as Step[]) : [];
  const update = (i: number, patch: Partial<Step>) =>
    onChange(current.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div id={id} className="flex flex-col gap-3">
      {current.map((step, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground">
              {i + 1}
            </span>
            <Input
              value={step.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Nombre del paso"
              aria-label={`Paso ${i + 1}: nombre`}
              disabled={disabled}
              className={fieldInputClass}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-12 shrink-0"
              aria-label={`Quitar paso ${i + 1}`}
              disabled={disabled}
              onClick={() => onChange(current.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Planificado</span>
            <DurationInput
              label={`Paso ${i + 1} planificado`}
              value={step.planned_seconds}
              onChange={(n) => update(i, { planned_seconds: n })}
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Real</span>
            <DurationInput
              label={`Paso ${i + 1} real`}
              value={step.actual_seconds}
              onChange={(n) => update(i, { actual_seconds: n })}
              disabled={disabled}
            />
          </div>
          <Input
            value={step.note ?? ""}
            onChange={(e) => update(i, { note: e.target.value || null })}
            placeholder="Nota (opcional)"
            aria-label={`Paso ${i + 1}: nota`}
            disabled={disabled}
            className={fieldInputClass}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-12"
        disabled={disabled}
        onClick={() => onChange([...current, emptyStep()])}
      >
        <Plus className="size-4" aria-hidden />
        Agregar paso
      </Button>
    </div>
  );
}
