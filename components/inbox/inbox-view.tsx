"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FilePlus2, Inbox, ListPlus, X } from "lucide-react";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { CaptureBar } from "@/components/attachments/capture-bar";
import { StatusBadge } from "@/components/entry/status-badge";
import { Button } from "@/components/ui/button";
import { dateInTimeZone, formatEntryDate } from "@/lib/datetime";
import { useAssignAttachments, useInbox, type Attachment } from "@/lib/queries/attachments";
import { useRecentDrafts } from "@/lib/queries/entries";
import { useTimeZone } from "@/lib/queries/profile";

/**
 * Bandeja de entrada (§6.3, §9.6): lo capturado sin entrada. Por ahora se asigna a mano; la
 * agrupación con IA llega en la etapa 6b.
 */
export function InboxView() {
  const timeZone = useTimeZone();
  const inbox = useInbox();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const byDay = new Map<string, Attachment[]>();
  for (const a of inbox.data ?? []) {
    const day = dateInTimeZone(new Date(a.captured_at), timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }

  return (
    <div className="flex flex-col gap-6">
      <CaptureBar entryId={null} />

      {inbox.isPending ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : inbox.error ? (
        <p className="text-sm text-destructive">
          No se pudo cargar la bandeja: {inbox.error.message}
        </p>
      ) : byDay.size === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <Inbox className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-medium">La bandeja está vacía</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Lo que captures sin elegir entrada aparecerá aquí para asignarlo después.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Toca la casilla de cada elemento para seleccionarlo y asignarlo a una entrada.
          </p>
          {[...byDay].map(([day, items]) => (
            <section key={day} aria-label={formatEntryDate(day)} className="flex flex-col gap-2">
              <h2 className="font-heading font-semibold">{formatEntryDate(day)}</h2>
              <AttachmentList
                attachments={[...items].reverse()}
                selected={selected}
                onToggle={toggle}
              />
            </section>
          ))}
        </>
      )}

      {selected.size > 0 && (
        <AssignBar ids={[...selected]} onClear={() => setSelected(new Set())} />
      )}
    </div>
  );
}

function AssignBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const drafts = useRecentDrafts();
  const assign = useAssignAttachments();

  return (
    <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 rounded-xl border bg-background p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {ids.length} {ids.length === 1 ? "seleccionado" : "seleccionados"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label="Quitar selección"
          onClick={onClear}
        >
          <X className="size-5" aria-hidden />
        </Button>
      </div>

      {choosing ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Elige el borrador al que se agregan:</p>
          {drafts.isPending ? (
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
          ) : !drafts.data?.length ? (
            <p className="text-sm">No hay entradas en borrador. Crea una nueva.</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {drafts.data.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={assign.isPending}
                    onClick={() =>
                      assign.mutate(
                        { ids, entryId: e.id },
                        { onSuccess: () => router.push(`/entrada/${e.id}`) },
                      )
                    }
                    className="flex min-h-14 w-full items-center justify-between gap-2 rounded-xl border bg-card px-3 text-left hover:bg-muted/50 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.title || "Sin título"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatEntryDate(e.entry_date)}
                      </span>
                    </span>
                    <StatusBadge status={e.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {assign.error && (
            <p role="alert" className="text-sm text-destructive">
              {assign.error.message}
            </p>
          )}
          <Button variant="outline" className="h-12" onClick={() => setChoosing(false)}>
            Volver
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={() => setChoosing(true)}>
            <ListPlus className="size-4" aria-hidden />A una entrada
          </Button>
          <Button
            className="h-12"
            onClick={() => router.push(`/entrada/nueva?adjuntos=${ids.join(",")}`)}
          >
            <FilePlus2 className="size-4" aria-hidden />
            Entrada nueva
          </Button>
        </div>
      )}
    </div>
  );
}
