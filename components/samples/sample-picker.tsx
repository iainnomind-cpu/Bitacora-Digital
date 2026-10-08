"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEntryDate } from "@/lib/datetime";
import { useSampleTypes } from "@/lib/queries/sample-types";
import { createSample, sampleKeys, useSamples, type Sample } from "@/lib/queries/samples";
import { descendsFrom, suggestCode } from "@/lib/samples/codes";
import type { FieldOf } from "@/lib/templates/fields";
import { cn } from "@/lib/utils";

/**
 * Selector de muestras para un campo de la plantilla (§6.1.11): en lugar de escribir el código,
 * se elige de las muestras registradas del tipo del campo. Primero aparecen las que vienen de
 * las muestras ya elegidas en otros campos de la entrada (p. ej. los tejidos del animal
 * elegido). Se pueden crear al momento, con código sugerido y su origen ya ligado.
 */
export function SamplePicker({
  id,
  field,
  value,
  onChange,
  related,
  disabled,
  invalid,
}: {
  id: string;
  field: FieldOf<"sample_ref">;
  value: string[];
  onChange: (codes: string[]) => void;
  /** Muestras elegidas en otros campos de la misma entrada (posibles orígenes). */
  related: Sample[];
  disabled?: boolean;
  invalid?: boolean;
}) {
  const queryClient = useQueryClient();
  const samples = useSamples();
  const types = useSampleTypes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeLabel = types.labelOf(field.sample_type);
  const typeLower = typeLabel.toLowerCase();
  const all = samples.data ?? [];
  const byCode = new Map(all.map((s) => [s.code, s]));
  const parentOf = new Map(all.map((s) => [s.id, s.parent_id]));
  const selected = new Set(value);

  // Orígenes posibles para una muestra nueva: las elegidas en la entrada del tipo adecuado.
  const parentTypes = types.parentsOf(field.sample_type);
  const parentCandidates = related.filter((s) => parentTypes.includes(s.sample_type));
  const defaultParent = parentCandidates[0] ?? null;
  const chosenParent = all.find((s) => s.id === (parentId ?? defaultParent?.id)) ?? null;

  const q = query.trim().toLowerCase();
  const ofType = all
    .filter(
      (s) => s.sample_type === field.sample_type && (s.status === "activa" || selected.has(s.code)),
    )
    .filter(
      (s) =>
        !q ||
        s.code.toLowerCase().includes(q) ||
        JSON.stringify(s.metadata).toLowerCase().includes(q),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const relatedIds = new Set(related.map((s) => s.id));
  const fromEntry = ofType.filter((s) => descendsFrom(s.id, relatedIds, parentOf));
  const others = ofType.filter((s) => !fromEntry.includes(s));

  const toggle = (code: string) => {
    if (field.multiple)
      onChange(selected.has(code) ? value.filter((c) => c !== code) : [...value, code]);
    else {
      onChange(selected.has(code) ? [] : [code]);
      if (!selected.has(code)) setOpen(false);
    }
  };

  const startCreate = (code?: string) => {
    setError(null);
    setCreating(
      code ??
        suggestCode({
          typeLabel,
          parentCode: (chosenParent ?? defaultParent)?.code,
          taken: all.map((s) => s.code),
        }),
    );
  };

  const create = async () => {
    if (!creating?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const s = await createSample({
        code: creating.trim(),
        sample_type: field.sample_type,
        parent_id: chosenParent?.id ?? null,
        status: "activa",
        storage_location: null,
        metadata: {},
      });
      await queryClient.invalidateQueries({ queryKey: sampleKeys.all });
      onChange(field.multiple ? [...value, s.code] : [s.code]);
      setCreating(null);
      setQuery("");
      if (!field.multiple) setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const describe = (s: Sample) => {
    const parent = s.parent_id ? all.find((p) => p.id === s.parent_id)?.code : null;
    const meta = Object.values((s.metadata ?? {}) as Record<string, unknown>)
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ");
    return [parent && `de ${parent}`, meta, formatEntryDate(s.created_at.slice(0, 10))]
      .filter(Boolean)
      .join(" · ");
  };

  const renderRow = (s: Sample) => {
    const on = selected.has(s.code);
    return (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => toggle(s.code)}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left",
            on ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
              on && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {on && <Check className="size-4" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono font-medium">{s.code}</span>
            <span className="block truncate text-xs text-muted-foreground">{describe(s)}</span>
          </span>
        </button>
      </li>
    );
  };

  const unknownTyped = value.filter((c) => !byCode.has(c));
  const exactMatch = q && all.some((s) => s.code.toLowerCase() === q);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((code) => (
            <li
              key={code}
              className="flex h-12 items-center gap-1 rounded-xl border bg-card pr-1 pl-3 font-mono text-sm"
            >
              {code}
              {!byCode.has(code) && (
                <span className="font-sans text-xs text-amber-700 dark:text-amber-400">
                  (sin registrar)
                </span>
              )}
              <button
                type="button"
                aria-label={`Quitar ${code}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(field.multiple || value.length === 0 || open) && (
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className="h-12 justify-between text-base"
        >
          <span className="flex items-center gap-2">
            {field.role === "producida" ? (
              <Plus className="size-4" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            {value.length && field.multiple
              ? `Agregar otro ${typeLower}`
              : field.role === "producida"
                ? `Agregar ${typeLower} producido`
                : `Elegir ${typeLower}`}
          </span>
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </Button>
      )}

      {open && (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-primary/30 bg-card p-3">
          {/* Crear nueva: primero en los campos de lo que se produce. */}
          {creating == null ? (
            <Button
              type="button"
              variant={field.role === "producida" ? "default" : "outline"}
              className="h-12 justify-start gap-2"
              onClick={() => startCreate()}
            >
              <Plus className="size-4" aria-hidden />
              {chosenParent
                ? `Nuevo ${typeLower} de ${chosenParent.code}`
                : `Registrar ${typeLower} nuevo`}
            </Button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2">
              <span className="text-sm font-medium">Nuevo {typeLower}</span>
              <Input
                value={creating}
                onChange={(e) => setCreating(e.target.value)}
                aria-label="Código"
                className="h-12 font-mono text-base"
                autoFocus
              />
              {parentCandidates.length > 1 && (
                <select
                  value={chosenParent?.id ?? ""}
                  onChange={(e) => {
                    setParentId(e.target.value || null);
                    const p = all.find((s) => s.id === e.target.value);
                    setCreating(
                      suggestCode({
                        typeLabel,
                        parentCode: p?.code,
                        taken: all.map((s) => s.code),
                      }),
                    );
                  }}
                  aria-label="Viene de"
                  className="h-12 rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30"
                >
                  {parentCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      Viene de {p.code}
                    </option>
                  ))}
                  <option value="">Sin origen</option>
                </select>
              )}
              {parentCandidates.length === 1 && (
                <span className="text-xs text-muted-foreground">
                  Viene de {parentCandidates[0].code}
                </span>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  onClick={() => setCreating(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="h-12"
                  disabled={busy || !creating.trim()}
                  onClick={() => void create()}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  Crear y agregar
                </Button>
              </div>
            </div>
          )}

          {all.some((s) => s.sample_type === field.sample_type) && (
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar ${typeLower}`}
                aria-label={`Buscar ${typeLower}`}
                className="h-12 pl-9 font-mono text-base"
              />
            </div>
          )}

          {fromEntry.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h4 className="text-xs font-medium text-muted-foreground">
                De lo elegido en esta entrada
              </h4>
              <ul className="flex flex-col gap-1.5">{fromEntry.map(renderRow)}</ul>
            </section>
          )}
          {others.length > 0 && (
            <section className="flex flex-col gap-1.5">
              {fromEntry.length > 0 && (
                <h4 className="text-xs font-medium text-muted-foreground">Otros</h4>
              )}
              <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                {others.slice(0, 50).map(renderRow)}
              </ul>
            </section>
          )}
          {samples.isSuccess && ofType.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {q ? "Sin resultados." : `Aún no tienes ${typeLower}s registrados.`}
            </p>
          )}
          {q && !exactMatch && creating == null && (
            <Button
              type="button"
              variant="ghost"
              className="h-12 justify-start"
              onClick={() => startCreate(query.trim())}
            >
              <Plus className="size-4" aria-hidden />
              Registrar «{query.trim()}» como {typeLower}
            </Button>
          )}
          {unknownTyped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Los códigos «sin registrar» se pueden registrar en la sección Muestras de la entrada.
            </p>
          )}
          <Button type="button" variant="ghost" className="h-12" onClick={() => setOpen(false)}>
            Listo
          </Button>
        </div>
      )}
    </div>
  );
}
