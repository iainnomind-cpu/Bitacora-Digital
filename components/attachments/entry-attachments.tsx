"use client";

import { useEntryAttachments } from "@/lib/queries/attachments";
import { AttachmentList } from "./attachment-list";
import { CaptureBar } from "./capture-bar";

/** Fotos, audios y notas de una entrada. En borrador permite capturar y editar pies de foto. */
export function EntryAttachments({ entryId, editable }: { entryId: string; editable: boolean }) {
  const { data, isPending, error } = useEntryAttachments(entryId);
  if (!editable && !data?.length) return null;

  return (
    <section aria-labelledby="adjuntos" className="flex flex-col gap-4">
      <h2 id="adjuntos" className="border-b pb-2 font-heading text-lg font-semibold">
        Adjuntos
      </h2>
      {editable && <CaptureBar entryId={entryId} />}
      {isPending ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      ) : error ? (
        <p className="text-sm text-destructive">No se pudieron cargar: {error.message}</p>
      ) : data.length > 0 ? (
        <AttachmentList attachments={data} editable={editable} />
      ) : null}
    </section>
  );
}
