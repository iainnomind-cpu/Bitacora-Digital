"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  currentSubscription,
  pushSupport,
  subscribePush,
  unsubscribePush,
} from "@/lib/push/client";
import { postJson } from "@/lib/queries/ai";

type State = "loading" | "off" | "on";

/** Activar notificaciones en este dispositivo (§8: solo con un botón, nunca al abrir la app). */
export function NotificationsCard() {
  const mounted = useMounted();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (!pushSupport().supported) return;
    currentSubscription()
      .then((s) => setState(s ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  if (!mounted) return <div className="h-24 animate-pulse rounded-xl bg-muted" />;
  const support = pushSupport();

  if (support.needsInstall) {
    return (
      <p className="rounded-xl border bg-card p-4 text-sm">
        En iPhone primero instala la app en la pantalla de inicio (abajo); luego ábrela desde su
        ícono y vuelve aquí para activar las notificaciones.
      </p>
    );
  }
  if (!support.supported) {
    return (
      <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Este navegador no admite notificaciones push.
      </p>
    );
  }

  const run = async (action: () => Promise<unknown>, done: State, text: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setState(done);
      setMessage({ text });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const on = state === "on";
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm">
        {on ? (
          <Bell className="size-5" aria-hidden />
        ) : (
          <BellOff className="size-5 text-muted-foreground" aria-hidden />
        )}
        {on
          ? "Notificaciones activadas en este dispositivo."
          : "Notificaciones desactivadas en este dispositivo."}
      </p>
      <div className={on ? "grid grid-cols-2 gap-2" : "flex"}>
        {on ? (
          <>
            <Button
              variant="outline"
              className="h-12"
              disabled={busy}
              onClick={() => run(unsubscribePush, "off", "Notificaciones desactivadas.")}
            >
              Desactivar
            </Button>
            <Button
              className="h-12"
              disabled={busy}
              onClick={() =>
                run(
                  () => postJson("/api/push/test", {}),
                  "on",
                  "Enviada. Debe llegar en unos segundos.",
                )
              }
            >
              <Send className="size-4" aria-hidden />
              Probar
            </Button>
          </>
        ) : (
          <Button
            className="h-12 flex-1"
            disabled={busy || state === "loading"}
            onClick={() => run(subscribePush, "on", "Listo: recibirás los recordatorios aquí.")}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Bell className="size-4" aria-hidden />
            )}
            Activar notificaciones
          </Button>
        )}
      </div>
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
