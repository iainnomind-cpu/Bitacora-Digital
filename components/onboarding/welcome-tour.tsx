"use client";

import { useEffect, useState } from "react";
import {
  Beaker,
  BellRing,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  FolderKanban,
  Inbox,
  LayoutTemplate,
  Loader2,
  Mic,
  NotebookPen,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { installPack } from "@/lib/queries/packs";
import { useProfile } from "@/lib/queries/profile";
import { useUpdateProfile } from "@/lib/queries/projects";
import { createClient } from "@/lib/supabase/client";
import { TEMPLATE_PACKS } from "@/lib/templates/packs";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

/** Evento para abrir el recorrido desde cualquier parte (Ajustes → Ver el recorrido). */
export const TOUR_EVENT = "bitacora:recorrido";

type Slide = { icon: LucideIcon; title: string; points: string[]; kind?: "lab" | "packs" };

const SLIDES: Slide[] = [
  {
    icon: BookOpenText,
    title: "Bienvenido a tu bitácora",
    points: [
      "Registra lo que realmente pasó en cada experimento: tiempos, desviaciones y observaciones.",
      "Captura primero (foto, audio o nota) y organiza después: la IA te ayuda a ordenarlo.",
      "Nada se borra: cada cambio queda en el historial, como en una bitácora de papel.",
    ],
  },
  {
    icon: FolderKanban,
    title: "Tu laboratorio",
    points: [
      "Cuéntale a la IA en qué trabajas: así entiende tus técnicas, siglas y reactivos.",
      "Más adelante puedes crear proyectos (en Ajustes) para separar experimentos.",
    ],
    kind: "lab",
  },
  {
    icon: LayoutTemplate,
    title: "Plantillas",
    points: [
      "Cada actividad tiene su plantilla: los campos que debes registrar.",
      "Agrega las de tu área aquí, o crea la tuya desde la foto de tu protocolo (Plantillas → Desde protocolo).",
    ],
    kind: "packs",
  },
  {
    icon: Mic,
    title: "Hoy y captura rápida",
    points: [
      "En Hoy ves las entradas del día y los borradores pendientes.",
      "Los botones Audio, Foto y Nota guardan al instante, sin elegir plantilla: van a la bandeja.",
      "El botón ➕ crea una entrada: escribe “voy a hacer…” y la IA te sugiere la plantilla.",
    ],
  },
  {
    icon: NotebookPen,
    title: "Entradas",
    points: [
      "Se guardan solas mientras escribes. Los audios se transcriben solos.",
      "“Llenar con IA” lee tus audios y notas y propone los valores: tú eliges qué aplicar.",
      "“Modo guiado” recorre los pasos con temporizador y te avisa al terminar.",
      "Al cerrar una entrada ya no se edita: solo se le agregan adendas.",
    ],
  },
  {
    icon: Inbox,
    title: "Bandeja de entrada",
    points: [
      "Lo que capturaste sin entrada espera aquí.",
      "La IA lo agrupa por hora y por muestra, y te propone a qué entrada va: acepta, cambia o rechaza.",
    ],
  },
  {
    icon: FlaskConical,
    title: "Muestras",
    points: [
      "Registra animales, tejidos, bloques, plásmidos, líneas celulares… con su código.",
      "Cada muestra guarda de dónde viene y en qué entradas se usó o produjo.",
      "En Buscar, escribe un código para ver todas las entradas donde aparece.",
    ],
  },
  {
    icon: Beaker,
    title: "Calculadora de soluciones",
    points: [
      "Molaridad, diluciones, %, seriadas, mezclas maestras y recetas guardadas.",
      "Sube la foto de un protocolo: te dice cuánto usar de cada cosa para el volumen que quieras.",
      "¿Dudas? Pregunta y te explica el cálculo paso a paso.",
    ],
  },
  {
    icon: BellRing,
    title: "Instálala y activa avisos",
    points: [
      "Instálala en tu teléfono para abrirla como una app (Ajustes → Instalar la app).",
      "Activa las notificaciones para recordatorios del día y temporizadores.",
      "Puedes repetir este recorrido cuando quieras desde Ajustes.",
    ],
  },
];

/**
 * Muestra el recorrido a quien no lo ha visto (marca `tour_done` en los datos de su cuenta) y
 * cuando se pide con el evento TOUR_EVENT.
 */
export function TourGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        const user = data.session?.user;
        if (!cancelled && user && !user.user_metadata?.tour_done) setOpen(true);
      });
    const show = () => setOpen(true);
    window.addEventListener(TOUR_EVENT, show);
    return () => {
      cancelled = true;
      window.removeEventListener(TOUR_EVENT, show);
    };
  }, []);

  if (!open) return null;
  return <WelcomeTour onClose={() => setOpen(false)} />;
}

function WelcomeTour({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const profile = useProfile();
  const update = useUpdateProfile();
  const [index, setIndex] = useState(0);
  const [lab, setLab] = useState<string | null>(null);
  const [packs, setPacks] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;
  const labValue = lab ?? profile.data?.ai_context ?? "";

  const finish = async () => {
    await createClient()
      .auth.updateUser({ data: { tour_done: true } })
      .catch(() => {});
    onClose();
  };

  // Al salir de un paso con datos, guardarlos.
  const next = async () => {
    setError(null);
    try {
      if (slide.kind === "lab" && lab != null && lab.trim() !== (profile.data?.ai_context ?? "")) {
        setBusy("Guardando…");
        await update.mutateAsync({ ai_context: lab.trim() || null });
      }
      if (slide.kind === "packs" && packs.size) {
        for (const p of TEMPLATE_PACKS.filter((x) => packs.has(x.key))) {
          setBusy(`Agregando ${p.name}…`);
          await installPack(p);
        }
        setPacks(new Set());
        void queryClient.invalidateQueries({ queryKey: ["templates"] });
        void queryClient.invalidateQueries({ queryKey: ["sample_types"] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
      return;
    }
    setBusy(null);
    if (last) await finish();
    else setIndex(index + 1);
  };

  const Icon = slide.icon;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recorrido-titulo"
      className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <header className="flex items-center justify-between px-4 py-2">
        <div className="flex gap-1.5" aria-label={`Paso ${index + 1} de ${SLIDES.length}`}>
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          className="h-12 gap-1 text-muted-foreground"
          onClick={() => void finish()}
        >
          Saltar
          <X className="size-4" aria-hidden />
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Icon className="size-8" aria-hidden />
        </span>
        <h2 id="recorrido-titulo" className="font-heading text-2xl leading-tight font-semibold">
          {slide.title}
        </h2>
        <ul className="flex flex-col gap-3">
          {slide.points.map((p) => (
            <li key={p} className="flex gap-2 text-base">
              <Sparkles className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        {slide.kind === "lab" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="recorrido-lab">Mi área y técnicas (opcional)</Label>
            <Textarea
              id="recorrido-lab"
              value={labValue}
              onChange={(e) => setLab(e.target.value)}
              placeholder="Ej. Biología molecular: clonación, qPCR y Western blot en células HEK293"
              className="min-h-28 text-base"
            />
          </div>
        )}

        {slide.kind === "packs" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Agregar plantillas de (opcional):</legend>
            {TEMPLATE_PACKS.map((p) => {
              const on = packs.has(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() =>
                    setPacks((prev) => {
                      const n = new Set(prev);
                      if (n.has(p.key)) n.delete(p.key);
                      else n.add(p.key);
                      return n;
                    })
                  }
                  className={cn(
                    "flex min-h-14 flex-col items-start justify-center rounded-xl border px-4 text-left",
                    on && "border-primary bg-primary/5 ring-2 ring-primary/30",
                  )}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.templates.map((t) => t.name).join(", ")}
                  </span>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Ya tienes 11 plantillas de histología y microscopía. Puedes agregar más después en
              Plantillas.
            </p>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </main>

      <footer className="mx-auto grid w-full max-w-lg grid-cols-[auto_1fr] gap-3 px-6 pb-4">
        <Button
          variant="outline"
          className="h-14 px-5"
          disabled={index === 0 || busy != null}
          onClick={() => setIndex(index - 1)}
          aria-label="Anterior"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <Button className="h-14 text-base" disabled={busy != null} onClick={() => void next()}>
          {busy ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              {busy}
            </>
          ) : last ? (
            "Empezar"
          ) : (
            <>
              Siguiente
              <ChevronRight className="size-5" aria-hidden />
            </>
          )}
        </Button>
      </footer>
    </div>
  );
}
