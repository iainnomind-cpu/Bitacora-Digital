"use client";

import { useId, useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { chipClass, fieldInputClass } from "@/components/entry/fields/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SAMPLE_STATUS_LABELS,
  useSamples,
  type Sample,
  type SampleInput,
  type SampleStatus,
} from "@/lib/queries/samples";
import { SAMPLE_TYPE_HELP } from "@/lib/help/glossary";
import { useSampleTypes } from "@/lib/queries/sample-types";
import { ParentPicker } from "./parent-picker";

type SampleType = string;

type Row = { key: string; value: string };

function toRows(suggested: string[], metadata: Record<string, string>): Row[] {
  const rows: Row[] = Object.entries(metadata).map(([key, value]) => ({
    key,
    value: String(value),
  }));
  for (const key of suggested) {
    if (!rows.some((r) => r.key === key)) rows.push({ key, value: "" });
  }
  return rows;
}

/** Formulario de muestra (crear o editar). El padre se elige por código. */
export function SampleForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: Partial<SampleInput> & { sample_type: SampleType };
  submitLabel: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: SampleInput) => void;
  onCancel?: () => void;
}) {
  const formId = useId();
  const samples = useSamples();
  const sampleTypes = useSampleTypes();
  const [code, setCode] = useState(initial.code ?? "");
  const [type, setType] = useState<SampleType>(initial.sample_type);
  const [status, setStatus] = useState<SampleStatus>(initial.status ?? "activa");
  const [location, setLocation] = useState(initial.storage_location ?? "");
  const [parentCode, setParentCode] = useState(
    () => samples.data?.find((s) => s.id === initial.parent_id)?.code ?? "",
  );
  const [rows, setRows] = useState<Row[]>(() =>
    toRows(sampleTypes.metadataOf(initial.sample_type), initial.metadata ?? {}),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // El padre de una muestra existente puede llegar después de cargar la lista.
  const [syncedParent, setSyncedParent] = useState(Boolean(parentCode) || !initial.parent_id);
  if (!syncedParent && samples.data) {
    setSyncedParent(true);
    setParentCode(samples.data.find((s) => s.id === initial.parent_id)?.code ?? "");
  }

  const parentTypes = sampleTypes.parentsOf(type);
  const parentOptions = (samples.data ?? []).filter(
    (s) => parentTypes.includes(s.sample_type as SampleType) && s.code !== code.trim(),
  );

  const changeType = (t: SampleType) => {
    setType(t);
    setRows((prev) =>
      toRows(
        sampleTypes.metadataOf(t),
        Object.fromEntries(prev.filter((r) => r.value.trim()).map((r) => [r.key, r.value])),
      ),
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!code.trim()) return setLocalError("Escribe el código.");
    let parent: Sample | undefined;
    if (parentCode.trim()) {
      parent = samples.data?.find((s) => s.code === parentCode.trim());
      if (!parent)
        return setLocalError(`No existe una muestra con el código ${parentCode.trim()}.`);
    }
    onSubmit({
      code: code.trim(),
      sample_type: type,
      parent_id: parent?.id ?? null,
      status,
      storage_location: location.trim() || null,
      metadata: Object.fromEntries(
        rows
          .filter((r) => r.key.trim() && r.value.trim())
          .map((r) => [r.key.trim(), r.value.trim()]),
      ),
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${formId}-code`} className="text-base">
          Código<span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${formId}-code`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ej. B-014-A"
          autoCapitalize="characters"
          className={`${fieldInputClass} font-mono`}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {sampleTypes.active.map(({ key: t }) => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={chipClass(type === t)}
              aria-pressed={type === t}
            >
              {sampleTypes.labelOf(t)}
            </button>
          ))}
        </div>
        {SAMPLE_TYPE_HELP[type] && (
          <p className="flex gap-1.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {SAMPLE_TYPE_HELP[type]}
          </p>
        )}
      </fieldset>

      {parentTypes.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-parent`} className="text-base">
            Viene de ({parentTypes.map((t) => sampleTypes.labelOf(t).toLowerCase()).join(" o ")})
          </Label>
          <ParentPicker
            id={`${formId}-parent`}
            options={parentOptions}
            all={samples.data ?? []}
            value={parentCode}
            onChange={setParentCode}
          />
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">Estado</legend>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SAMPLE_STATUS_LABELS) as SampleStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={chipClass(status === s)}
              aria-pressed={status === s}
            >
              {SAMPLE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${formId}-loc`} className="text-base">
          Ubicación (caja / posición)
        </Label>
        <Input
          id={`${formId}-loc`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ej. Caja 2, posición 5"
          className={fieldInputClass}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">Datos</legend>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <Input
              value={r.key}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
              }
              placeholder="Dato"
              aria-label="Nombre del dato"
              className={fieldInputClass}
            />
            <Input
              value={r.value}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
              }
              placeholder="Valor"
              aria-label={`Valor de ${r.key || "dato"}`}
              className={fieldInputClass}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-12"
              aria-label="Quitar dato"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => setRows([...rows, { key: "", value: "" }])}
        >
          <Plus className="size-4" aria-hidden />
          Agregar dato
        </Button>
      </fieldset>

      {(localError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {localError ?? error?.message}
        </p>
      )}
      <div className={onCancel ? "grid grid-cols-2 gap-2" : "flex"}>
        {onCancel && (
          <Button type="button" variant="outline" className="h-14" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="h-14 flex-1 text-base" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
