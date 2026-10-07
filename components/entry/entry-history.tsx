"use client";

import Link from "next/link";
import { use } from "react";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
import { COMMON_TEXT_FIELDS } from "@/lib/entries/common";
import {
  ENTRY_STATUS_LABELS,
  useEntry,
  useEntryAddenda,
  useEntryRevisions,
  type Entry,
  type EntryStatus,
} from "@/lib/queries/entries";
import { useTimeZone } from "@/lib/queries/profile";
import { useTemplateVersion, type TemplateWithFields } from "@/lib/queries/templates";
import { formatFieldValue } from "@/lib/templates/format";
import type { EntryData } from "@/lib/templates/values";
import { cn } from "@/lib/utils";
import { EntrySkeleton } from "./entry-editor";

const SOURCE_LABELS: Record<string, string> = {
  usuario: "Edición",
  ia_aceptada: "Sugerencia de IA aceptada",
  sync_offline: "Sincronización sin conexión",
};

type Snapshot = Partial<Entry>;
type Change = { label: string; before: string; after: string };

function diff(
  before: Snapshot,
  after: Snapshot,
  template: TemplateWithFields,
  timeZone: string,
): Change[] {
  const changes: Change[] = [];
  const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : "—");
  const push = (label: string, b: string, a: string) => {
    if (b !== a) changes.push({ label, before: b, after: a });
  };

  push("Título", text(before.title), text(after.title));
  push(
    "Inicio",
    formatDateTime(before.started_at ?? null, timeZone),
    formatDateTime(after.started_at ?? null, timeZone),
  );
  push(
    "Fin",
    formatDateTime(before.ended_at ?? null, timeZone),
    formatDateTime(after.ended_at ?? null, timeZone),
  );
  const bData = (before.data ?? {}) as EntryData;
  const aData = (after.data ?? {}) as EntryData;
  for (const f of template.fields) {
    if (JSON.stringify(bData[f.key] ?? null) !== JSON.stringify(aData[f.key] ?? null)) {
      changes.push({
        label: f.label,
        before: formatFieldValue(f, bData[f.key], timeZone),
        after: formatFieldValue(f, aData[f.key], timeZone),
      });
    }
  }
  for (const f of COMMON_TEXT_FIELDS) push(f.label, text(before[f.key]), text(after[f.key]));
  const status = (s: unknown) => ENTRY_STATUS_LABELS[(s as EntryStatus) ?? "borrador"] ?? String(s);
  push("Estado", status(before.status), status(after.status));
  push("Motivo de anulación", text(before.void_reason), text(after.void_reason));
  return changes;
}

export function EntryHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const timeZone = useTimeZone();
  const entry = useEntry(id);
  const template = useTemplateVersion(entry.data?.template_id, entry.data?.template_version);
  const revisions = useEntryRevisions(id);
  const addenda = useEntryAddenda(id);

  if (entry.isPending || revisions.isPending || (entry.data && template.isPending)) {
    return <EntrySkeleton />;
  }
  const error = entry.error ?? template.error ?? revisions.error;
  if (error) return <p className="text-sm text-destructive">No se pudo cargar: {error.message}</p>;
  if (!entry.data || !template.data || !revisions.data) return <p>Esta entrada no existe.</p>;

  // revisions viene de la más nueva a la más vieja; cada snapshot es el estado ANTES del
  // cambio, y el estado después es el snapshot siguiente (o la entrada actual).
  const current = entry.data;
  const items = revisions.data.map((r, i) => {
    const after = (i === 0 ? current : revisions.data[i - 1].snapshot) as Snapshot;
    return {
      id: r.id,
      at: r.changed_at,
      source: r.change_source,
      changes: diff(r.snapshot as Snapshot, after, template.data, timeZone),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/entrada/${id}`}
          className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-12 gap-1")}
        >
          <ChevronLeft className="size-5" aria-hidden />
          Entrada
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-muted-foreground">{current.title}</p>
      </div>

      {addenda.data && addenda.data.length > 0 && (
        <section aria-labelledby="h-adendas" className="flex flex-col gap-2">
          <h2 id="h-adendas" className="font-heading text-lg font-semibold">
            Adendas
          </h2>
          <ol className="flex flex-col gap-2">
            {addenda.data.map((a) => (
              <li key={a.id} className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(a.created_at, timeZone)}
                </p>
                <p className="mt-1 whitespace-pre-line">{a.content}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="h-cambios" className="flex flex-col gap-3">
        <h2 id="h-cambios" className="font-heading text-lg font-semibold">
          Cambios
        </h2>
        <ol className="flex flex-col gap-3 border-l pl-4">
          {items.map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-primary" />
              <p className="text-sm font-medium">
                {formatDateTime(item.at, timeZone)} · {SOURCE_LABELS[item.source] ?? item.source}
              </p>
              {item.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cambios visibles.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {item.changes.map((c) => (
                    <li key={c.label} className="rounded-lg bg-muted/60 p-2 text-sm">
                      <p className="font-medium">{c.label}</p>
                      <p className="whitespace-pre-line text-muted-foreground line-through decoration-muted-foreground/60">
                        {c.before}
                      </p>
                      <p className="whitespace-pre-line">{c.after}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          <li className="relative">
            <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-muted-foreground" />
            <p className="text-sm font-medium">
              {formatDateTime(current.created_at, timeZone)} · Creada
            </p>
          </li>
        </ol>
      </section>
    </div>
  );
}
