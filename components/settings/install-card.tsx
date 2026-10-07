"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import { pushSupport } from "@/lib/push/client";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

/**
 * Instalar la app (§6.1.14). Android/escritorio: botón con el aviso del navegador si está
 * disponible. iPhone: instrucciones (Safari no ofrece aviso), necesarias además para el push.
 */
export function InstallCard() {
  const mounted = useMounted();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted) return <div className="h-24 animate-pulse rounded-xl bg-muted" />;
  const { ios, standalone } = pushSupport();

  if (standalone || installed) {
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm">
        <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
        La app está instalada en este dispositivo.
      </p>
    );
  }

  if (ios) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
        <p className="font-medium">Instalar en iPhone o iPad</p>
        <ol className="flex flex-col gap-2">
          <li className="flex items-start gap-2">
            <span className="font-medium">1.</span>
            <span>
              Abre esta página en <strong>Safari</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-medium">2.</span>
            <span className="flex flex-wrap items-center gap-1">
              Toca <Share className="inline size-4" aria-label="Compartir" />{" "}
              <strong>Compartir</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-medium">3.</span>
            <span className="flex flex-wrap items-center gap-1">
              Elige <SquarePlus className="inline size-4" aria-hidden />{" "}
              <strong>Agregar a inicio</strong>.
            </span>
          </li>
        </ol>
        <p className="text-muted-foreground">
          En iPhone las notificaciones solo funcionan con la app instalada (iOS 16.4 o posterior).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
      <p>Instala la app para abrirla desde la pantalla de inicio, como una app normal.</p>
      {prompt ? (
        <Button
          className="h-12"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          <Download className="size-4" aria-hidden />
          Instalar
        </Button>
      ) : (
        <p className="text-muted-foreground">
          Abre el menú del navegador (⋮) y elige <strong>Instalar app</strong> o{" "}
          <strong>Agregar a la pantalla principal</strong>.
        </p>
      )}
    </div>
  );
}
