"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, Check, Loader2, Mic, NotebookPen, X } from "lucide-react";
import { TemplateIcon } from "@/components/templates/template-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEntryDate, formatTime } from "@/lib/datetime";
import { useTranscriptions } from "@/lib/queries/ai";
import { useSignedUrls, type Attachment } from "@/lib/queries/attachments";
import { useRecentDrafts } from "@/lib/queries/entries";
import { useAcceptGroup, useUpdateGroup, type CaptureGroup } from "@/lib/queries/inbox";
import type { TemplateWithFields } from "@/lib/queries/templates";
import { cn } from "@/lib/utils";

const selectClass =
  "h-12 w-full rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30";

/**
 * Tarjeta de una agrupación propuesta por la IA (§7.6 "Revisión en la bandeja"). Nada se mueve
 * hasta tocar "Aceptar"; se puede cambiar plantilla, destino y título, o quitar adjuntos.
 */
export function GroupCard({
  group,
  attachments,
  templates,
  timeZone,
}: {
  group: CaptureGroup;
  attachments: Attachment[];
  templates: TemplateWithFields[];
  timeZone: string;
}) {
  const router = useRouter();
  const drafts = useRecentDrafts();
  const accept = useAcceptGroup();
  const update = useUpdateGroup();

  const [templateId, setTemplateId] = useState(group.suggested_template_id ?? "");
  const [target, setTarget] = useState(group.target_entry_id ?? "");
  const [title, setTitle] = useState(group.suggested_title ?? "");
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState(false);

  const items = attachments.filter((a) => !removed.has(a.id));
  const template = templates.find((t) => t.id === templateId) ?? null;
  const targetDraft = drafts.data?.find((d) => d.id === target);
  const modified =
    removed.size > 0 ||
    templateId !== (group.suggested_template_id ?? "") ||
    target !== (group.target_entry_id ?? "") ||
    title !== (group.suggested_title ?? "");
  const canAccept = items.length > 0 && (target !== "" || template != null);
  const busy = accept.isPending || update.isPending;

  const onAccept = () =>
    accept.mutate(
      {
        group,
        attachments: items,
        template,
        targetEntryId: target || null,
        title,
        modified,
        timeZone,
      },
      { onSuccess: (entryId) => router.push(`/entrada/${entryId}`) },
    );

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-3">
      <header className="flex items-start gap-3">
        <TemplateIcon
          icon={template?.icon ?? null}
          color={template?.color ?? null}
          className="size-10"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title || template?.name || "Sin título"}</p>
          <p className="text-sm text-muted-foreground">
            {template?.name ?? "Plantilla por decidir"} ·{" "}
            {target ? `agregar a «${targetDraft?.title ?? "borrador"}»` : "entrada nueva"}
          </p>
        </div>
        {group.confidence != null && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
            {Math.round(Number(group.confidence) * 100)}%
          </span>
        )}
      </header>

      {group.reasoning && <p className="text-sm text-muted-foreground italic">{group.reasoning}</p>}

      <CompactAttachments
        attachments={items}
        timeZone={timeZone}
        onRemove={(id) => setRemoved((prev) => new Set(prev).add(id))}
      />

      {editing && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${group.id}-titulo`}>Título</Label>
            <Input
              id={`${group.id}-titulo`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${group.id}-destino`}>Destino</Label>
            <select
              id={`${group.id}-destino`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={selectClass}
            >
              <option value="">Entrada nueva</option>
              {drafts.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  Agregar a «{d.title || "Sin título"}» ({formatEntryDate(d.entry_date)})
                </option>
              ))}
            </select>
          </div>
          {!target && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${group.id}-plantilla`}>Plantilla</Label>
              <select
                id={`${group.id}-plantilla`}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className={selectClass}
              >
                <option value="">Elige una plantilla…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {(accept.error || update.error) && (
        <p role="alert" className="text-sm text-destructive">
          {(accept.error ?? update.error)?.message}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="ghost"
          className="h-12"
          disabled={busy}
          onClick={() => update.mutate({ id: group.id, patch: { status: "rechazado" } })}
        >
          Rechazar
        </Button>
        <Button
          variant="outline"
          className="h-12"
          disabled={busy}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Listo" : "Cambiar"}
        </Button>
        <Button className="h-12" disabled={busy || !canAccept} onClick={onAccept}>
          {accept.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          Aceptar
        </Button>
      </div>
      {!canAccept && items.length > 0 && (
        <p className="text-xs text-muted-foreground">Toca “Cambiar” para elegir una plantilla.</p>
      )}
    </article>
  );
}

const ICONS = { foto: Camera, audio: Mic, texto: NotebookPen } as const;

function CompactAttachments({
  attachments,
  timeZone,
  onRemove,
}: {
  attachments: Attachment[];
  timeZone: string;
  onRemove: (id: string) => void;
}) {
  const urls = useSignedUrls(
    attachments.flatMap((a) => (a.kind === "foto" && a.storage_path ? [a.storage_path] : [])),
  );
  const transcriptions = useTranscriptions(
    attachments.filter((a) => a.kind === "audio").map((a) => a.id),
  );

  return (
    <ul className="flex flex-col gap-1.5">
      {attachments.map((a) => {
        const Icon = ICONS[a.kind as keyof typeof ICONS] ?? NotebookPen;
        const url = a.storage_path ? urls.data?.get(a.storage_path) : undefined;
        const text =
          a.kind === "audio"
            ? (transcriptions.data?.get(a.id)?.text ?? "Audio sin transcribir")
            : a.kind === "texto"
              ? a.text_content
              : (a.caption ?? a.ai_description ?? "Foto");
        return (
          <li key={a.id} className="flex items-center gap-2 rounded-lg border bg-background p-1.5">
            {a.kind === "foto" && url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="size-12 shrink-0 rounded-md bg-muted object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-xs text-muted-foreground">
                {formatTime(a.captured_at, timeZone)}
              </span>
              <span className={cn("line-clamp-2 text-sm")}>{text}</span>
            </span>
            <button
              type="button"
              aria-label="Quitar de este grupo"
              onClick={() => onRemove(a.id)}
              className="flex size-12 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
