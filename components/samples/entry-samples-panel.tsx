"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSample,
  sampleKeys,
  sampleRefsOf,
  syncEntrySamples,
  useEntrySampleLinks,
  useSamples,
  type Sample,
} from "@/lib/queries/samples";
import { useSampleTypes } from "@/lib/queries/sample-types";
import type { FieldDef } from "@/lib/templates/fields";
import type { EntryData } from "@/lib/templates/values";

type Ref = ReturnType<typeof sampleRefsOf>[number];

/**
 * Muestras de un borrador (§6.1.11): los códigos escritos en los campos de muestra, si ya están
 * registrados, y un botón para registrar los que falten. Las producidas toman como origen la
 * muestra usada del tipo adecuado (p. ej. rejillas ← bloque).
 */
export function EntrySamplesPanel({
  entryId,
  fields,
  data,
}: {
  entryId: string;
  fields: FieldDef[];
  data: EntryData;
}) {
  const queryClient = useQueryClient();
  const samples = useSamples();
  const sampleTypes = useSampleTypes();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refs = sampleRefsOf(fields, data);
  if (!fields.some((f) => f.type === "sample_ref")) return null;

  const byCode = new Map((samples.data ?? []).map((s) => [s.code, s]));
  const unique = [...new Map(refs.map((r) => [`${r.code}|${r.role}`, r])).values()];
  const missing = [
    ...new Map(unique.filter((r) => !byCode.has(r.code)).map((r) => [r.code, r])).values(),
  ];

  const register = async (toCreate: Ref[]) => {
    setRunning(true);
    setError(null);
    const known = new Map<string, Pick<Sample, "id" | "sample_type">>(byCode);
    // Primero las usadas (pueden ser origen de las producidas).
    const ordered = [...toCreate].sort(
      (a, b) => Number(a.role === "producida") - Number(b.role === "producida"),
    );
    try {
      for (const r of ordered) {
        const parentRef =
          r.role === "producida"
            ? unique.find(
                (u) =>
                  u.role === "usada" &&
                  sampleTypes.parentsOf(r.sampleType).includes(u.sampleType) &&
                  known.has(u.code),
              )
            : undefined;
        const created = await createSample({
          code: r.code,
          sample_type: r.sampleType,
          parent_id: parentRef ? known.get(parentRef.code)!.id : null,
          status: "activa",
          storage_location: null,
          metadata: {},
        });
        known.set(created.code, created);
      }
      await syncEntrySamples(entryId, fields, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      void queryClient.invalidateQueries({ queryKey: sampleKeys.all });
    }
  };

  return (
    <section aria-labelledby="muestras-entrada" className="flex flex-col gap-3">
      <h2 id="muestras-entrada" className="border-b pb-2 font-heading text-lg font-semibold">
        Muestras
      </h2>
      {unique.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Escribe códigos en los campos de muestra y aparecerán aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {unique.map((r) => {
            const s = byCode.get(r.code);
            return (
              <li key={`${r.code}|${r.role}`} className="flex min-h-12 items-center gap-2 text-sm">
                {s ? (
                  <Check className="size-4 shrink-0 text-emerald-600" aria-label="Registrada" />
                ) : (
                  <span
                    className="size-4 shrink-0 rounded-full border-2 border-dashed border-muted-foreground"
                    aria-label="Sin registrar"
                  />
                )}
                {s ? (
                  <Link
                    href={`/muestras/${s.id}`}
                    className="font-mono underline-offset-2 hover:underline"
                  >
                    {r.code}
                  </Link>
                ) : (
                  <span className="font-mono">{r.code}</span>
                )}
                <span className="text-muted-foreground">
                  {sampleTypes.labelOf(r.sampleType).toLowerCase()} {r.role}
                  {!s && " · sin registrar"}
                </span>
                {!s && (
                  <Button
                    variant="ghost"
                    className="ml-auto h-12"
                    disabled={running}
                    onClick={() => register([r])}
                  >
                    Registrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {missing.length > 1 && (
        <Button
          variant="outline"
          className="h-12"
          disabled={running}
          onClick={() => register(missing)}
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Registrar las {missing.length} que faltan
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

/** Muestras vinculadas a una entrada cerrada o anulada (solo lectura). */
export function EntrySamplesList({ entryId }: { entryId: string }) {
  const links = useEntrySampleLinks(entryId);
  const samples = useSamples();
  if (!links.data?.length || !samples.data) return null;
  const byId = new Map(samples.data.map((s) => [s.id, s]));

  return (
    <section aria-labelledby="muestras-entrada" className="flex flex-col gap-2">
      <h2 id="muestras-entrada" className="font-heading text-lg font-semibold">
        Muestras
      </h2>
      <ul className="flex flex-wrap gap-2">
        {links.data.map((l) => {
          const s = byId.get(l.sample_id);
          if (!s) return null;
          return (
            <li key={`${l.sample_id}|${l.role}`}>
              <Link
                href={`/muestras/${s.id}`}
                className="flex h-12 items-center gap-2 rounded-xl border bg-card px-3 text-sm hover:bg-muted/50"
              >
                <span className="font-mono">{s.code}</span>
                <span className="text-muted-foreground">{l.role}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
