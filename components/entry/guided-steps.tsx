"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, ChevronLeft, ChevronRight, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelTimer, scheduleTimer } from "@/lib/queries/timers";
import { formatDuration } from "@/lib/templates/duration";
import type { Step } from "@/lib/templates/fields";
import { cn } from "@/lib/utils";

/**
 * Modo guiado (§6.2 temporizadores): recorre los pasos uno por uno con botones grandes.
 * "Empezar" guarda la hora y, si el paso tiene duración planificada, programa una notificación
 * push para cuando termine (llega aunque se cierre la app). "Terminar" guarda la duración real.
 * Mientras está abierto, mantiene la pantalla encendida.
 */
export function GuidedSteps({
  entryId,
  title,
  steps,
  onChange,
  onClose,
}: {
  entryId: string;
  title: string;
  steps: Step[];
  onChange: (steps: Step[]) => void;
  onClose: () => void;
}) {
  const firstPending = steps.findIndex((s) => !s.finished_at && s.actual_seconds == null);
  const [index, setIndex] = useState(firstPending >= 0 ? firstPending : 0);
  const [now, setNow] = useState(() => Date.now());
  const step = steps[index];
  const running = Boolean(step?.started_at && !step.finished_at);

  // Reloj de la cuenta regresiva.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  // Pantalla siempre encendida mientras se trabaja.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  const elapsed = running ? Math.floor((now - Date.parse(step.started_at!)) / 1000) : 0;
  const remaining = step?.planned_seconds != null ? step.planned_seconds - elapsed : null;
  const overdue = running && remaining != null && remaining <= 0;

  // Aviso local al llegar a cero (además del push del servidor).
  const [alerted, setAlerted] = useState<string | null>(null);
  if (overdue && alerted !== step.started_at) {
    setAlerted(step.started_at ?? null);
    navigator.vibrate?.([300, 150, 300, 150, 600]);
  }

  const patchStep = (i: number, patch: Partial<Step>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const start = async () => {
    const startedAt = new Date();
    patchStep(index, {
      started_at: startedAt.toISOString(),
      finished_at: null,
      actual_seconds: null,
      timer_id: null,
    });
    if (step.planned_seconds) {
      const timerId = await scheduleTimer({
        entryId,
        title: `Terminó: ${step.label || `paso ${index + 1}`}`,
        body: `${title} · ${formatDuration(step.planned_seconds)}`,
        fireAt: new Date(startedAt.getTime() + step.planned_seconds * 1000),
      });
      if (timerId) {
        onChange(
          steps.map((s, j) =>
            j === index
              ? {
                  ...s,
                  started_at: startedAt.toISOString(),
                  finished_at: null,
                  actual_seconds: null,
                  timer_id: timerId,
                }
              : s,
          ),
        );
      }
    }
  };

  const finish = () => {
    const end = new Date();
    void cancelTimer(step.timer_id);
    const actual = step.started_at
      ? Math.round((end.getTime() - Date.parse(step.started_at)) / 1000)
      : null;
    patchStep(index, { finished_at: end.toISOString(), actual_seconds: actual, timer_id: null });
    if (index < steps.length - 1) setIndex(index + 1);
  };

  const restart = () => {
    void cancelTimer(step.timer_id);
    patchStep(index, { started_at: null, finished_at: null, actual_seconds: null, timer_id: null });
  };

  const done = steps.filter((s) => s.finished_at || s.actual_seconds != null).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo guiado"
      className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <header className="flex items-center gap-2 border-b px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{title}</p>
          <p className="text-sm font-medium">
            Paso {index + 1} de {steps.length} · {done} terminados
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label="Cerrar modo guiado"
          onClick={onClose}
        >
          <X className="size-6" aria-hidden />
        </Button>
      </header>

      <div className="flex h-2 bg-muted" aria-hidden>
        {steps.map((s, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 border-r border-background",
              s.finished_at || s.actual_seconds != null
                ? "bg-emerald-500"
                : i === index
                  ? "bg-primary/50"
                  : "",
            )}
          />
        ))}
      </div>

      {step ? (
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 overflow-y-auto px-4 py-6">
          <h2 className="text-2xl leading-tight font-semibold">
            {step.label || `Paso ${index + 1}`}
          </h2>
          {step.planned_seconds != null && (
            <p className="text-muted-foreground">
              Planificado: {formatDuration(step.planned_seconds)}
            </p>
          )}

          <div
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border p-6 text-center",
              overdue && "border-red-500 bg-red-500/10",
            )}
            aria-live="polite"
          >
            {running ? (
              <>
                <span className="font-mono text-6xl font-semibold tabular-nums">
                  {remaining != null
                    ? formatDuration(Math.abs(remaining))
                    : formatDuration(elapsed)}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    overdue ? "font-medium text-red-600" : "text-muted-foreground",
                  )}
                >
                  {remaining == null
                    ? "transcurrido"
                    : overdue
                      ? "¡Tiempo cumplido! (de más)"
                      : "restante"}
                </span>
                {step.timer_id && !overdue && (
                  <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <BellRing className="size-3.5" aria-hidden />
                    Te avisaremos al terminar aunque cierres la app
                  </span>
                )}
              </>
            ) : step.finished_at || step.actual_seconds != null ? (
              <>
                <Check className="size-10 text-emerald-600" aria-hidden />
                <span className="text-lg font-medium">
                  Terminado · real {formatDuration(step.actual_seconds)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Sin empezar</span>
            )}
          </div>

          <Input
            value={step.note ?? ""}
            onChange={(e) => patchStep(index, { note: e.target.value || null })}
            placeholder="Nota de este paso (opcional)"
            aria-label="Nota del paso"
            className="h-12 text-base"
          />

          <div className="mt-auto flex flex-col gap-3">
            {running ? (
              <Button className="h-20 text-xl" onClick={finish}>
                <Check className="size-7" aria-hidden />
                Terminar paso
              </Button>
            ) : (
              <Button className="h-20 text-xl" onClick={start}>
                {step.finished_at ? (
                  <RotateCcw className="size-7" aria-hidden />
                ) : (
                  <Play className="size-7" aria-hidden />
                )}
                {step.finished_at ? "Repetir paso" : "Empezar"}
              </Button>
            )}
            {running && (
              <Button variant="ghost" className="h-12" onClick={restart}>
                Reiniciar este paso
              </Button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-14"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ChevronLeft className="size-5" aria-hidden />
                Anterior
              </Button>
              <Button
                variant="outline"
                className="h-14"
                disabled={index >= steps.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Siguiente
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </div>
          </div>
        </main>
      ) : (
        <p className="p-6 text-center text-muted-foreground">Esta plantilla no tiene pasos.</p>
      )}
    </div>
  );
}
