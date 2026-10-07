"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUDIO_BITS_PER_SECOND, MAX_AUDIO_SECONDS, pickAudioMimeType } from "@/lib/media/audio";
import { formatDuration } from "@/lib/templates/duration";
import { cn } from "@/lib/utils";

type State = "idle" | "requesting" | "recording" | "error";

/**
 * Grabadora (§9.5): un botón grande, tiempo transcurrido y detención automática al llegar al
 * límite. Al detener entrega el audio con su duración y la hora de inicio.
 */
export function Recorder({
  onRecorded,
  onCancel,
}: {
  onRecorded: (audio: { blob: Blob; durationSeconds: number; startedAt: Date }) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef<Date>(new Date());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const discard = useRef(false);

  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanup();
    },
    [],
  );

  const start = async () => {
    const mimeType = pickAudioMimeType();
    if (mimeType == null || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError("Este navegador no puede grabar audio.");
      return;
    }
    setState("requesting");
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("error");
      setError("No hay permiso para usar el micrófono. Revísalo en los ajustes del navegador.");
      return;
    }

    const rec = new MediaRecorder(stream.current, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    chunks.current = [];
    discard.current = false;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      cleanup();
      if (discard.current) return;
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAt.current.getTime()) / 1000),
      );
      const blob = new Blob(chunks.current, { type: rec.mimeType || mimeType || "audio/webm" });
      onRecorded({ blob, durationSeconds, startedAt: startedAt.current });
      setState("idle");
      setElapsed(0);
    };
    recorder.current = rec;
    startedAt.current = new Date();
    rec.start(1000);
    setState("recording");
    setElapsed(0);
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current.getTime()) / 1000);
      setElapsed(s);
      if (s >= MAX_AUDIO_SECONDS && rec.state === "recording") rec.stop();
    }, 250);
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const cancel = () => {
    discard.current = true;
    stop();
    cleanup();
    setState("idle");
    onCancel();
  };

  const recording = state === "recording";

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-5">
      <p
        className={cn(
          "font-mono text-3xl tabular-nums",
          recording ? "text-foreground" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {formatDuration(elapsed)}
        <span className="ml-2 text-sm text-muted-foreground">
          / {formatDuration(MAX_AUDIO_SECONDS)}
        </span>
      </p>
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={state === "requesting"}
        aria-label={recording ? "Detener y guardar" : "Empezar a grabar"}
        className={cn(
          "flex size-24 items-center justify-center rounded-full text-white shadow-md transition-transform active:scale-95 disabled:opacity-60",
          recording ? "animate-pulse bg-red-600" : "bg-red-500",
        )}
      >
        {recording ? (
          <Square className="size-9 fill-current" aria-hidden />
        ) : (
          <Mic className="size-10" aria-hidden />
        )}
      </button>
      <p className="text-sm text-muted-foreground">
        {state === "requesting"
          ? "Pidiendo permiso del micrófono…"
          : recording
            ? "Grabando… toca para detener y guardar"
            : "Toca para grabar"}
      </p>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
      <Button variant="ghost" className="h-12" onClick={cancel}>
        <X className="size-4" aria-hidden />
        {recording ? "Descartar" : "Cerrar"}
      </Button>
    </div>
  );
}
