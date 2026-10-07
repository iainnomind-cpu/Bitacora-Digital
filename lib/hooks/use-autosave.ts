"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Guarda el último valor después de `delay` ms sin cambios (§9: sin botón "guardar").
 * - Nunca hay dos guardados a la vez: si cambia mientras guarda, guarda otra vez al terminar.
 * - `flush()` guarda ya y espera (antes de cerrar la entrada o al salir de la página).
 * - Si falla, conserva el valor pendiente; el siguiente cambio o `flush()` reintenta.
 */
export function useAutosave<T>(save: (value: T) => Promise<void>, delay = 1500) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const saveRef = useRef(save);
  const latest = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const run = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    for (;;) {
      while (inflight.current) await inflight.current;
      const pending = latest.current;
      if (!pending) break;
      latest.current = null;
      setStatus("saving");

      let failed = false;
      inflight.current = saveRef
        .current(pending.value)
        .then(() => setError(null))
        .catch((e: unknown) => {
          failed = true;
          latest.current ??= pending; // reintentar con lo último
          setError(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => {
          inflight.current = null;
        });
      await inflight.current;

      if (failed) {
        setStatus("error");
        throw new Error("No se pudo guardar");
      }
    }
    setStatus("saved");
  }, []);

  const schedule = useCallback(
    (value: T) => {
      latest.current = { value };
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run().catch(() => {}), delay);
    },
    [delay, run],
  );

  // Guardar al ocultar la pestaña (cambiar de app en el teléfono) y avisar al cerrar con pendientes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && latest.current) void run().catch(() => {});
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current || inflight.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (latest.current) void run().catch(() => {}); // al navegar dentro de la app
    };
  }, [run]);

  return { status, error, schedule, flush: run };
}
