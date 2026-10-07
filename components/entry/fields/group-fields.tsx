"use client";

import { useId, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSampleTypes } from "@/lib/queries/sample-types";
import { useSampleCodes } from "@/lib/queries/samples";
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
}: FieldProps<"sample_ref">) {
  const listId = useId();
  const { data: codes = [] } = useSampleCodes(field.sample_type);
  const typeLabel = useSampleTypes().labelOf(field.sample_type).toLowerCase();
  const [draft, setDraft] = useState("");

  const datalist = (
    <datalist id={listId}>
      {codes.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );

  if (!field.multiple) {
    return (
      <>
        <Input
          id={id}
          list={listId}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          onBlur={(e) => onChange(e.target.value.trim() || null)}
          placeholder={`Código de ${typeLabel}`}
          autoCapitalize="characters"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={`${fieldInputClass} font-mono`}
        />
        {datalist}
      </>
    );
  }

  const current = Array.isArray(value) ? (value as string[]) : [];
  const add = () => {
    const code = draft.trim();
    if (code && !current.includes(code)) onChange([...current, code]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      {current.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {current.map((code) => (
            <li
              key={code}
              className="flex h-12 items-center gap-1 rounded-xl border bg-card pr-1 pl-3 font-mono text-sm"
            >
              {code}
              <button
                type="button"
                aria-label={`Quitar ${code}`}
                disabled={disabled}
                onClick={() => onChange(current.filter((c) => c !== code))}
                className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          list={listId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Código de ${typeLabel}`}
          autoCapitalize="characters"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={`${fieldInputClass} font-mono`}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 px-4"
          disabled={disabled || draft.trim() === ""}
          onClick={add}
        >
          <Plus className="size-4" aria-hidden />
          Agregar
        </Button>
      </div>
      {datalist}
    </div>
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
