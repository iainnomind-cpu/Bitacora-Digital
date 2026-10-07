"use client";

import { useState } from "react";
import { AlertTriangle, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FillOutput } from "@/lib/ai/schemas";
import { COMMON_TEXT_FIELDS } from "@/lib/entries/common";
import type { EntryDraft } from "@/lib/queries/entries";
import type { FieldDef } from "@/lib/templates/fields";
import { formatFieldValue } from "@/lib/templates/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  label: string;
  current: string;
  proposed: string;
  uncertain?: string;
  apply: (patch: Partial<EntryDraft> & { data: EntryDraft["data"] }) => void;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const text = (v: string | null) => (v && v.trim() !== "" ? v : "—");

/**
 * Revisión de la sugerencia de IA (§9.4): diferencias campo por campo, actual vs propuesto.
 * Nada se escribe en la entrada hasta que el usuario aplica lo que eligió (§7).
 */
export function AiFillReview({
  fields,
  draft,
  output,
  timeZone,
  pending,
  onApply,
  onDiscard,
}: {
  fields: FieldDef[];
  draft: EntryDraft;
  output: FillOutput;
  timeZone: string;
  pending: boolean;
  onApply: (patch: Partial<EntryDraft>, all: boolean) => void;
  onDiscard: () => void;
}) {
  const uncertain = new Map(output.uncertain.map((u) => [u.key, u.reason]));
  const rows: Row[] = [];

  for (const f of fields) {
    const proposed = output.fields[f.key];
    if (proposed == null || same(proposed, draft.data[f.key])) continue;
    rows.push({
      id: `f:${f.key}`,
      label: f.label,
      current: formatFieldValue(f, draft.data[f.key], timeZone),
      proposed: formatFieldValue(f, proposed, timeZone),
      uncertain: uncertain.get(f.key),
      apply: (p) => {
        p.data = { ...p.data, [f.key]: proposed };
      },
    });
  }
  for (const c of COMMON_TEXT_FIELDS) {
    if (c.key === "data_location") continue;
    const proposed = output[c.key];
    if (proposed == null || same(proposed, draft[c.key])) continue;
    rows.push({
      id: `c:${c.key}`,
      label: c.label,
      current: text(draft[c.key]),
      proposed,
      uncertain: uncertain.get(c.key),
      apply: (p) => {
        p[c.key] = proposed;
      },
    });
  }

  // Lo dudoso empieza sin marcar: el usuario decide.
  const [selected, setSelected] = useState(
    () => new Set(rows.filter((r) => !r.uncertain).map((r) => r.id)),
  );
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () => {
    const patch: Partial<EntryDraft> & { data: EntryDraft["data"] } = { data: { ...draft.data } };
    for (const r of rows) if (selected.has(r.id)) r.apply(patch);
    onApply(patch, selected.size === rows.length);
  };

  const labelFor = (key: string) =>
    fields.find((f) => f.key === key)?.label ??
    COMMON_TEXT_FIELDS.find((c) => c.key === key)?.label ??
    key;
  const otherUncertain = output.uncertain.filter(
    (u) => !rows.some((r) => r.id.endsWith(`:${u.key}`)),
  );

  return (
    <section
      id="sugerencia-ia"
      aria-labelledby="sugerencia-ia-titulo"
      className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-card p-4"
    >
      <h2
        id="sugerencia-ia-titulo"
        className="flex items-center gap-2 font-heading text-lg font-semibold"
      >
        <Sparkles className="size-5" aria-hidden />
        Sugerencia de la IA
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          La IA no encontró datos nuevos en los audios y notas de esta entrada.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Marca lo que quieras aplicar. Lo dudoso viene sin marcar.
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const on = selected.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(r.id)}
                    className={cn(
                      "flex w-full gap-3 rounded-xl border p-3 text-left transition-colors",
                      on ? "border-primary bg-primary/5" : "bg-background",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                        on && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {on && <Check className="size-4" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-medium">{r.label}</span>
                      {r.current !== "—" && (
                        <span className="block whitespace-pre-line text-muted-foreground line-through">
                          {r.current}
                        </span>
                      )}
                      <span className="block whitespace-pre-line">{r.proposed}</span>
                      {r.uncertain && (
                        <span className="mt-1 flex items-start gap-1 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          {r.uncertain}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {otherUncertain.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Dudas de la IA</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {otherUncertain.map((u) => (
              <li key={u.key}>
                {labelFor(u.key)}: {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {output.deviations.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Desviaciones del protocolo</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {output.deviations.map((d) => (
              <li key={d.key}>
                {labelFor(d.key)}: esperado {d.expected}, registrado {d.actual}
              </li>
            ))}
          </ul>
        </div>
      )}
      {output.samples_mentioned.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">Muestras mencionadas:</span>{" "}
          <span className="font-mono">{output.samples_mentioned.join(", ")}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" disabled={pending} onClick={onDiscard}>
          Descartar
        </Button>
        <Button className="h-12" disabled={pending || selected.size === 0} onClick={apply}>
          {pending ? "Aplicando…" : `Aplicar (${selected.size})`}
        </Button>
      </div>
    </section>
  );
}
