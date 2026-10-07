"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, Mic, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/media/image";
import { useAnalyzePhoto, useTranscribe } from "@/lib/queries/ai";
import { useCreateAttachment, type NewCapture } from "@/lib/queries/attachments";
import { cn } from "@/lib/utils";
import { Recorder } from "./recorder";

type Panel = "audio" | "nota" | null;

const BUTTONS = [
  { key: "audio", label: "Audio", icon: Mic },
  { key: "foto", label: "Foto", icon: Camera },
  { key: "nota", label: "Nota", icon: NotebookPen },
] as const;

/**
 * Captura rápida (§6.1.2): foto, audio o nota sin elegir plantilla. Con `entryId` null va a
 * la bandeja de entrada; con una entrada en borrador, directo a ella.
 */
export function CaptureBar({ entryId }: { entryId: string | null }) {
  const create = useCreateAttachment(entryId);
  const transcribe = useTranscribe();
  const analyze = useAnalyzePhoto();
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const destination = entryId ? "en la entrada" : "en la bandeja de entrada";

  const save = async (capture: NewCapture, label: string) => {
    setBusy(`Guardando ${label}…`);
    setMessage(null);
    try {
      const attachment = await create.mutateAsync(capture);
      // Cada audio se transcribe y cada foto se analiza al subirse (§7.6).
      if (attachment.kind === "audio") transcribe.mutate(attachment.id);
      if (attachment.kind === "foto") analyze.mutate(attachment.id);
      setMessage(`${label[0].toUpperCase()}${label.slice(1)} guardada ${destination}.`);
    } catch {
      // create.error muestra el detalle
    } finally {
      setBusy(null);
    }
  };

  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      setBusy("Preparando foto…");
      const blob = await compressImage(file);
      // lastModified es la hora de la toma con la cámara (o del archivo, si viene de la galería).
      await save(
        { kind: "foto", blob, capturedAt: new Date(file.lastModified || Date.now()) },
        "foto",
      );
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const onButton = (key: (typeof BUTTONS)[number]["key"]) => {
    if (key === "foto") fileInput.current?.click();
    else setPanel(panel === key ? null : key);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {BUTTONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onButton(key)}
            disabled={busy != null}
            aria-expanded={key !== "foto" ? panel === key : undefined}
            className={cn(
              "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-medium transition-colors hover:bg-muted/50 disabled:opacity-50",
              panel === key && "border-primary ring-2 ring-primary/30",
            )}
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onPhotos(e.target.files)}
      />

      {panel === "audio" && (
        <Recorder
          onCancel={() => setPanel(null)}
          onRecorded={({ blob, durationSeconds, startedAt }) =>
            void save(
              { kind: "audio", blob, durationSeconds, capturedAt: startedAt },
              "nota de voz",
            )
          }
        />
      )}

      {panel === "nota" && (
        <form
          className="flex flex-col gap-2 rounded-xl border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const text = note.trim();
            if (!text) return;
            void save({ kind: "texto", text }, "nota").then(() => {
              setNote("");
              setPanel(null);
            });
          }}
        >
          <Label htmlFor={`nota-${entryId ?? "bandeja"}`} className="sr-only">
            Nota rápida
          </Label>
          <Textarea
            id={`nota-${entryId ?? "bandeja"}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escribe una nota rápida…"
            className="min-h-24 text-base"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={() => setPanel(null)}>
              Cancelar
            </Button>
            <Button type="submit" className="h-12" disabled={busy != null || note.trim() === ""}>
              Guardar nota
            </Button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="min-h-5 text-sm">
        {busy ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {busy}
          </span>
        ) : create.error ? (
          <span role="alert" className="text-destructive">
            No se pudo guardar: {create.error.message}
          </span>
        ) : message ? (
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" aria-hidden />
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
