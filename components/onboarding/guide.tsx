"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Circle, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  getActiveGuide,
  GUIDE_TASKS,
  guideHidden,
  setActiveGuide,
  setGuideHidden,
  useGuideProgress,
} from "@/lib/onboarding/guide";
import { cn } from "@/lib/utils";

/** Tarjeta "Primeros pasos" en Hoy: tareas que se marcan solas; desaparece al completarlas. */
export function GettingStarted() {
  const mounted = useMounted();
  const progress = useGuideProgress();
  const [hidden, setHidden] = useState(() => guideHidden());
  if (!mounted || hidden || !progress.data) return null;

  const done = GUIDE_TASKS.filter((t) => progress.data[t.key]).length;
  if (done === GUIDE_TASKS.length) return null;
  const nextTask = GUIDE_TASKS.find((t) => !progress.data[t.key]);

  return (
    <section
      aria-labelledby="primeros-pasos"
      className="mb-4 flex flex-col gap-3 rounded-xl border-2 border-primary/30 bg-card p-4"
    >
      <header className="flex items-start gap-3">
        <Compass className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex-1">
          <h2 id="primeros-pasos" className="font-semibold">
            Primeros pasos · {done} de {GUIDE_TASKS.length}
          </h2>
          <p className="text-sm text-muted-foreground">
            Te guío paso a paso; cada tarea se marca sola al hacerla.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-2 -mr-2 size-12"
          aria-label="Ocultar la guía"
          onClick={() => {
            setGuideHidden(true);
            setHidden(true);
          }}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </header>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(done / GUIDE_TASKS.length) * 100}%` }}
        />
      </div>
      <ol className="flex flex-col gap-1">
        {GUIDE_TASKS.map((t) => {
          const ok = progress.data[t.key];
          const isNext = t.key === nextTask?.key;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-muted/50",
                  isNext && "bg-primary/5",
                )}
              >
                {ok ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-label="Hecho" />
                ) : (
                  <Circle
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-label="Pendiente"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={cn("block font-medium", ok && "text-muted-foreground line-through")}
                  >
                    {t.title}
                  </span>
                  {!ok && <span className="block text-xs text-muted-foreground">{t.summary}</span>}
                </span>
                {!ok && (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Recuadro con los pasos numerados de una tarea de la guía. Solo aparece cuando la página se
 * abrió desde la guía (`?guia=<clave>`).
 */
export function GuideBanner({ task }: { task: string }) {
  return (
    <Suspense fallback={null}>
      <Banner task={task} />
    </Suspense>
  );
}

function Banner({ task }: { task: string }) {
  const params = useSearchParams();
  const fromUrl = params.get("guia") === task;
  // Se abre con ?guia=<tarea> y sigue visible en las pantallas siguientes hasta cerrarla.
  const mounted = useMounted();
  const [closed, setClosed] = useState(false);
  const active = !closed && (fromUrl || (mounted && getActiveGuide() === task));
  const progress = useGuideProgress(active);
  useEffect(() => {
    if (fromUrl) setActiveGuide(task);
  }, [fromUrl, task]);
  const t = GUIDE_TASKS.find((x) => x.key === task);
  if (!t || !active) return null;
  const done = progress.data?.[task];
  const index = GUIDE_TASKS.findIndex((x) => x.key === task);
  const next = GUIDE_TASKS.slice(index + 1).find((x) => !progress.data?.[x.key]);

  return (
    <aside
      className="mb-4 flex flex-col gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4"
      aria-label="Guía de primeros pasos"
    >
      <div className="flex items-start gap-2">
        <Compass className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="flex-1 font-semibold">Guía: {t.title}</p>
        <button
          type="button"
          aria-label="Cerrar la guía"
          onClick={() => {
            setActiveGuide(null);
            setClosed(true);
          }}
          className="-mt-2 -mr-2 flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ol className="flex flex-col gap-2">
        {t.steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {done && (
        <div className="flex flex-col gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" aria-hidden />
            ¡Listo! Tarea completada.
          </p>
          {next ? (
            <Link
              href={next.href}
              onClick={() => setActiveGuide(next.key)}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Siguiente: {next.title} →
            </Link>
          ) : (
            <Link
              href="/hoy"
              onClick={() => setActiveGuide(null)}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Terminaste la guía. Volver a Hoy →
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
