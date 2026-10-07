"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FilePlus2, Inbox, ListPlus, Loader2, Sparkles, X } from "lucide-react";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { CaptureBar } from "@/components/attachments/capture-bar";
import { StatusBadge } from "@/components/entry/status-badge";
import { Button } from "@/components/ui/button";
import { dateInTimeZone, formatEntryDate } from "@/lib/datetime";
import { useAssignAttachments, useInbox, type Attachment } from "@/lib/queries/attachments";
import { useRecentDrafts } from "@/lib/queries/entries";
import {
  acceptGroup,
  groupKeys,
  useCaptureGroups,
  useOrganizeInbox,
  type CaptureGroup,
} from "@/lib/queries/inbox";
import { useTimeZone } from "@/lib/queries/profile";
import { useTemplates, type TemplateWithFields } from "@/lib/queries/templates";
import { GroupCard } from "./group-card";

/**
 * Bandeja de entrada (§6.3, §9.6): lo capturado sin entrada. La IA propone agrupaciones como
 * tarjetas (§7.6); lo que no quedó en ninguna se puede asignar a mano.
 */
export function InboxView() {
  const timeZone = useTimeZone();
  const inbox = useInbox();
  const groups = useCaptureGroups();
  const templates = useTemplates();
  const organize = useOrganizeInbox();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const inboxById = new Map((inbox.data ?? []).map((a) => [a.id, a]));
  // Tarjetas cuyos adjuntos siguen en la bandeja.
  const cards = (groups.data ?? [])
    .map((g) => ({
      group: g,
      attachments: g.attachment_ids.flatMap((id) => inboxById.get(id) ?? []),
    }))
    .filter((c) => c.attachments.length > 0);
  const grouped = new Set(cards.flatMap((c) => c.attachments.map((a) => a.id)));
  const ungrouped = (inbox.data ?? []).filter((a) => !grouped.has(a.id));

  // Al abrir la bandeja, organizar lo que no está en ninguna tarjeta (una vez por conjunto).
  const ungroupedKey = ungrouped
    .map((a) => a.id)
    .sort()
    .join(",");
  const attempted = useRef<string | null>(null);
  const ready = inbox.isSuccess && groups.isSuccess;
  useEffect(() => {
    if (!ready || !ungroupedKey || organize.isPending || attempted.current === ungroupedKey) return;
    attempted.current = ungroupedKey;
    organize.mutate();
  }, [ready, ungroupedKey, organize]);

  const byDay = new Map<string, Attachment[]>();
  for (const a of ungrouped) {
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
      ) : inbox.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <Inbox className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-medium">La bandeja está vacía</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Lo que captures sin elegir entrada aparecerá aquí, y la IA te propondrá cómo
            organizarlo.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="propuestas" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="propuestas"
                className="flex items-center gap-2 font-heading text-lg font-semibold"
              >
                <Sparkles className="size-5" aria-hidden />
                Propuestas
              </h2>
              <Button
                variant="outline"
                className="h-12"
                disabled={organize.isPending}
                onClick={() => organize.mutate()}
              >
                {organize.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {organize.isPending ? "Organizando…" : "Organizar"}
              </Button>
            </div>
            {organize.error && (
              <p role="alert" className="text-sm text-destructive">
                {organize.error.message}
              </p>
            )}
            {templates.data && (
              <AcceptConfident cards={cards} templates={templates.data} timeZone={timeZone} />
            )}
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {organize.isPending
                  ? "Analizando fotos, audios y notas…"
                  : "Sin propuestas por ahora. Toca “Organizar” para pedirlas."}
              </p>
            ) : (
              templates.data &&
              cards.map(({ group, attachments }) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  attachments={attachments}
                  templates={templates.data}
                  timeZone={timeZone}
                />
              ))
            )}
          </section>

          {ungrouped.length > 0 && (
            <section aria-labelledby="sin-agrupar" className="flex flex-col gap-3">
              <h2 id="sin-agrupar" className="font-heading text-lg font-semibold">
                Sin agrupar
              </h2>
              <p className="text-sm text-muted-foreground">
                Toca la casilla de cada elemento para seleccionarlo y asignarlo a mano.
              </p>
              {[...byDay].map(([day, items]) => (
                <div key={day} className="flex flex-col gap-2">
                  <h3 className="font-heading font-semibold">{formatEntryDate(day)}</h3>
                  <AttachmentList
                    attachments={[...items].reverse()}
                    selected={selected}
                    onToggle={toggle}
                  />
                </div>
              ))}
            </section>
          )}
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

const HIGH_CONFIDENCE = 0.8;

/**
 * Aceptar de un toque las tarjetas de alta confianza (§7.6). Nunca es automático: el usuario lo
 * pide, y cada entrada queda con su sugerencia de llenado pendiente de revisar.
 */
function AcceptConfident({
  cards,
  templates,
  timeZone,
}: {
  cards: { group: CaptureGroup; attachments: Attachment[] }[];
  templates: TemplateWithFields[];
  timeZone: string;
}) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const confident = cards.filter(
    (c) =>
      Number(c.group.confidence ?? 0) >= HIGH_CONFIDENCE &&
      (c.group.target_entry_id || templates.some((t) => t.id === c.group.suggested_template_id)),
  );
  if (confident.length < 2 && !result) return null;

  const run = async () => {
    setRunning(true);
    setResult(null);
    let ok = 0;
    for (const { group, attachments } of confident) {
      try {
        await acceptGroup({
          group,
          attachments,
          template: templates.find((t) => t.id === group.suggested_template_id) ?? null,
          targetEntryId: group.target_entry_id,
          title: group.suggested_title ?? "",
          modified: false,
          timeZone,
        });
        ok++;
      } catch {
        // la tarjeta queda pendiente para aceptarla a mano
      }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: groupKeys.pending }),
      queryClient.invalidateQueries({ queryKey: ["attachments"] }),
      queryClient.invalidateQueries({ queryKey: ["entries"] }),
    ]);
    setRunning(false);
    setResult(
      `${ok} de ${confident.length} aceptadas. Abre cada entrada desde Hoy para revisar el llenado.`,
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {confident.length >= 2 && (
        <Button className="h-12" disabled={running} onClick={run}>
          {running && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {running ? "Aceptando…" : `Aceptar las ${confident.length} de alta confianza`}
        </Button>
      )}
      {result && (
        <p role="status" className="text-sm text-muted-foreground">
          {result}
        </p>
      )}
    </div>
  );
}
