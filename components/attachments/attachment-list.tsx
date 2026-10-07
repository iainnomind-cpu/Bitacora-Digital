"use client";

import { useState } from "react";
import { Camera, Check, Loader2, Mic, NotebookPen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/datetime";
import { useTranscribe, useTranscriptions, type Transcription } from "@/lib/queries/ai";
import { useTimeZone } from "@/lib/queries/profile";
import { useSignedUrls, useUpdateCaption, type Attachment } from "@/lib/queries/attachments";
import { formatDuration } from "@/lib/templates/duration";
import { cn } from "@/lib/utils";

const KIND_ICONS = { foto: Camera, audio: Mic, texto: NotebookPen } as const;

/**
 * Adjuntos en línea de tiempo por hora de captura. `editable`: pie de foto editable.
 * `selected`/`onToggle`: modo selección (bandeja de entrada).
 */
export function AttachmentList({
  attachments,
  editable,
  selected,
  onToggle,
}: {
  attachments: Attachment[];
  editable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const timeZone = useTimeZone();
  const paths = attachments.flatMap((a) => (a.storage_path ? [a.storage_path] : []));
  const urls = useSignedUrls(paths);
  const transcriptions = useTranscriptions(
    attachments.filter((a) => a.kind === "audio").map((a) => a.id),
  );

  return (
    <ol className="flex flex-col gap-3">
      {attachments.map((a) => {
        const Icon = KIND_ICONS[a.kind as keyof typeof KIND_ICONS] ?? NotebookPen;
        const url = a.storage_path ? urls.data?.get(a.storage_path) : undefined;
        const isSelected = selected?.has(a.id) ?? false;
        return (
          <li
            key={a.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-card p-3",
              isSelected && "border-primary ring-2 ring-primary/30",
            )}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {onToggle && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label="Seleccionar"
                  onClick={() => onToggle(a.id)}
                  className="-my-2 -ml-2 flex size-12 items-center justify-center"
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md border-2",
                      isSelected && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {isSelected && <Check className="size-4" aria-hidden />}
                  </span>
                </button>
              )}
              <Icon className="size-4" aria-hidden />
              <span className="font-mono tabular-nums">{formatTime(a.captured_at, timeZone)}</span>
              {a.kind === "audio" && a.duration_seconds != null && (
                <span>· {formatDuration(Math.round(Number(a.duration_seconds)))}</span>
              )}
            </div>

            {a.kind === "foto" &&
              (url ? (
                <a href={url} target="_blank" rel="noreferrer" className="block">
                  {/* URL firmada de corta duración: no pasa por el optimizador de imágenes. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={a.caption ?? "Foto"}
                    loading="lazy"
                    className="max-h-72 w-full rounded-lg bg-muted object-contain"
                  />
                </a>
              ) : (
                <div className="h-48 animate-pulse rounded-lg bg-muted" />
              ))}

            {a.kind === "audio" &&
              (url ? (
                <audio controls preload="none" src={url} className="w-full" />
              ) : (
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            {a.kind === "audio" && (
              <TranscriptionView
                attachmentId={a.id}
                transcription={transcriptions.data?.get(a.id)}
                loading={transcriptions.isPending}
              />
            )}

            {a.kind === "texto" && <p className="whitespace-pre-line">{a.text_content}</p>}

            {a.kind === "foto" &&
              (editable ? (
                <CaptionInput key={`${a.id}:${a.caption ?? ""}`} attachment={a} />
              ) : (
                a.caption && <p className="text-sm">{a.caption}</p>
              ))}
            {a.kind === "foto" && !a.caption && a.ai_description && (
              <PhotoDescription attachment={a} canUse={Boolean(editable)} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CaptionInput({ attachment }: { attachment: Attachment }) {
  const update = useUpdateCaption();
  const [value, setValue] = useState(attachment.caption ?? "");
  const save = () => {
    const caption = value.trim() || null;
    if (caption !== attachment.caption) update.mutate({ id: attachment.id, caption });
  };
  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder="Pie de foto (opcional)"
      aria-label="Pie de foto"
      aria-invalid={update.isError || undefined}
      className="h-12 text-base"
    />
  );
}

/** Texto transcrito de un audio, con su estado y botón para (re)intentar (§7.1). */
function TranscriptionView({
  attachmentId,
  transcription,
  loading,
}: {
  attachmentId: string;
  transcription: Transcription | undefined;
  loading: boolean;
}) {
  const transcribe = useTranscribe();
  const working = transcribe.isPending || transcription?.status === "procesando";

  if (loading) return null;
  if (working) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Transcribiendo…
      </p>
    );
  }
  if (transcription?.status === "lista") {
    return (
      <blockquote className="border-l-2 pl-3 text-sm whitespace-pre-line">
        {transcription.text || "(sin texto)"}
      </blockquote>
    );
  }
  const failed = transcription?.status === "error" || transcribe.isError;
  return (
    <div className="flex flex-col gap-1">
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {transcribe.error?.message ?? "No se pudo transcribir."}
        </p>
      )}
      <Button
        variant="outline"
        className="h-12 self-start"
        onClick={() => transcribe.mutate(attachmentId)}
      >
        <RotateCcw className="size-4" aria-hidden />
        {failed ? "Reintentar transcripción" : "Transcribir"}
      </Button>
    </div>
  );
}

/** Descripción de la IA de una foto; se puede usar como pie de foto (§7.6). */
function PhotoDescription({ attachment, canUse }: { attachment: Attachment; canUse: boolean }) {
  const update = useUpdateCaption();
  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p>
        <span className="font-medium">IA:</span> {attachment.ai_description}
      </p>
      {attachment.ai_extracted_text && (
        <p className="font-mono text-xs">«{attachment.ai_extracted_text}»</p>
      )}
      {canUse && (
        <Button
          variant="ghost"
          className="h-12 self-start"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: attachment.id, caption: attachment.ai_description })}
        >
          Usar como pie de foto
        </Button>
      )}
    </div>
  );
}
