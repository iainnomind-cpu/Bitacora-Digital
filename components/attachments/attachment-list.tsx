"use client";

import { useState } from "react";
import { Camera, Check, Mic, NotebookPen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/datetime";
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

            {a.kind === "texto" && <p className="whitespace-pre-line">{a.text_content}</p>}

            {a.kind === "foto" &&
              (editable ? (
                <CaptionInput attachment={a} />
              ) : (
                a.caption && <p className="text-sm">{a.caption}</p>
              ))}
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
