"use client";

import { AlertTriangle, CircleCheck, Info, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
import { useCheckEntry, useEntryReview } from "@/lib/queries/ai";
import { useTimeZone } from "@/lib/queries/profile";
import type { FieldDef } from "@/lib/templates/fields";
import { checkEntry } from "@/lib/templates/deviations";
import type { EntryData } from "@/lib/templates/values";

/**
 * Avisos de la entrada (§7.3): datos obligatorios que faltan y desviaciones del protocolo
 * (en vivo, sin IA) + revisión opcional con IA contra el texto del protocolo.
 */
export function EntryFlags({
  entryId,
  fields,
  data,
  hasProtocol,
  beforeCheck,
}: {
  entryId: string;
  fields: FieldDef[];
  data: EntryData;
  hasProtocol: boolean;
  /** Guardar lo pendiente antes de revisar (la IA lee lo guardado). */
  beforeCheck?: () => Promise<void>;
}) {
  const timeZone = useTimeZone();
  const flags = checkEntry(fields, data);
  const review = useEntryReview(entryId);
  const check = useCheckEntry(entryId);
  const deviations = flags.filter((f) => f.kind === "desviacion");
  const missing = flags.filter((f) => f.kind === "faltante");

  if (!flags.length && !hasProtocol && !review.data) return null;

  return (
    <section aria-labelledby="avisos" className="flex flex-col gap-3">
      <h2 id="avisos" className="border-b pb-2 font-heading text-lg font-semibold">
        Avisos
      </h2>

      {flags.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-emerald-600" aria-hidden />
          Sin desviaciones de los valores del protocolo.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {deviations.map((f) => (
            <li key={f.key} className="flex gap-2 rounded-lg bg-amber-500/10 p-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <span>
                <span className="font-medium">{f.label}.</span> {f.message}
              </span>
            </li>
          ))}
          {missing.map((f) => (
            <li key={f.key} className="flex gap-2 rounded-lg bg-muted p-2">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-medium">{f.label}:</span> {f.message.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {review.data && (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
          <p className="font-medium">
            Revisión con IA · {formatDateTime(review.data.at, timeZone)}
          </p>
          <p className="text-muted-foreground">{review.data.summary}</p>
          {review.data.missing.length > 0 && (
            <ul className="list-disc pl-5">
              {review.data.missing.map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.what}</span> — {m.reason}
                </li>
              ))}
            </ul>
          )}
          {review.data.deviations.length > 0 && (
            <ul className="list-disc pl-5">
              {review.data.deviations.map((d, i) => (
                <li key={i}>
                  <span className="font-medium">{d.what}:</span> protocolo {d.expected}, registrado{" "}
                  {d.actual}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasProtocol && (
        <Button
          variant="outline"
          className="h-12"
          disabled={check.isPending}
          onClick={async () => {
            await beforeCheck?.().catch(() => {});
            check.mutate();
          }}
        >
          {check.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ScanSearch className="size-4" aria-hidden />
          )}
          {check.isPending ? "Revisando…" : "Revisar contra el protocolo"}
        </Button>
      )}
      {check.error && (
        <p role="alert" className="text-sm text-destructive">
          {check.error.message}
        </p>
      )}
    </section>
  );
}
