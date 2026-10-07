"use client";

import { useState } from "react";
import { Ban, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { COMMON_TEXT_FIELDS } from "@/lib/entries/common";
import { useTimeZone } from "@/lib/queries/profile";
import {
  useAddAddendum,
  useEntryAddenda,
  useSetEntryStatus,
  type Entry,
} from "@/lib/queries/entries";
import type { TemplateWithFields } from "@/lib/queries/templates";
import { formatFieldValue } from "@/lib/templates/format";
import type { EntryData } from "@/lib/templates/values";
import { EntryHeader } from "./entry-header";
import { VoidEntry } from "./void-entry";

/** Entrada cerrada o anulada: solo lectura, con adendas (§3). */
export function EntryReadView({ entry, template }: { entry: Entry; template: TemplateWithFields }) {
  const timeZone = useTimeZone();
  const setStatus = useSetEntryStatus(entry.id);
  const data = (entry.data ?? {}) as EntryData;

  return (
    <div className="flex flex-col gap-6">
      <EntryHeader entry={entry} template={template} />

      {entry.status === "anulada" && (
        <div className="flex gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
          <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">Entrada anulada.</span> Motivo: {entry.void_reason}
          </p>
        </div>
      )}

      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{entry.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatTime(entry.started_at, timeZone)} – {formatTime(entry.ended_at, timeZone)}
          {entry.closed_at && ` · Cerrada el ${formatDateTime(entry.closed_at, timeZone)}`}
        </p>
      </div>

      <dl className="flex flex-col gap-4">
        <ReadItem label="Objetivo" value={entry.objective} />
        {template.fields.map((f) => (
          <ReadItem
            key={f.key}
            label={f.label}
            value={formatFieldValue(f, data[f.key], timeZone)}
          />
        ))}
        {COMMON_TEXT_FIELDS.filter((f) => f.key !== "objective").map((f) => (
          <ReadItem
            key={f.key}
            label={f.label}
            value={entry[f.key]}
            mono={f.key === "data_location"}
          />
        ))}
      </dl>

      <Addenda entry={entry} />

      {entry.status === "cerrada" && (
        <div className="border-t pt-6">
          <VoidEntry
            onConfirm={(reason) => setStatus.mutate({ status: "anulada", voidReason: reason })}
            pending={setStatus.isPending}
            error={setStatus.error}
          />
        </div>
      )}
    </div>
  );
}

function ReadItem({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="border-b pb-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 break-words whitespace-pre-line ${mono ? "font-mono text-sm" : ""}`}>
        {value && value.trim() !== "" ? value : "—"}
      </dd>
    </div>
  );
}

function Addenda({ entry }: { entry: Entry }) {
  const timeZone = useTimeZone();
  const addenda = useEntryAddenda(entry.id);
  const add = useAddAddendum(entry.id);
  const [content, setContent] = useState("");
  const canAdd = entry.status === "cerrada";

  if (!canAdd && !addenda.data?.length) return null;

  return (
    <section aria-labelledby="adendas" className="flex flex-col gap-3">
      <h2 id="adendas" className="font-heading text-lg font-semibold">
        Adendas
      </h2>
      {addenda.data?.length ? (
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
      ) : (
        <p className="text-sm text-muted-foreground">
          Sin adendas. Úsalas para agregar algo después del cierre sin modificar lo registrado.
        </p>
      )}
      {canAdd && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) return;
            add.mutate(content.trim(), { onSuccess: () => setContent("") });
          }}
        >
          <Label htmlFor="new-addendum" className="sr-only">
            Nueva adenda
          </Label>
          <Textarea
            id="new-addendum"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe una adenda…"
            className="min-h-20 text-base"
          />
          {add.error && (
            <p role="alert" className="text-sm text-destructive">
              {add.error.message}
            </p>
          )}
          <Button
            type="submit"
            variant="outline"
            className="h-12"
            disabled={add.isPending || content.trim() === ""}
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            {add.isPending ? "Agregando…" : "Agregar adenda"}
          </Button>
        </form>
      )}
    </section>
  );
}
