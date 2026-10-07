"use client";

import { useEffect } from "react";

/** Registra /sw.js (push y, en la etapa 10, modo sin conexión). No pide ningún permiso. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((e) => console.warn("No se pudo registrar el service worker", e));
  }, []);
  return null;
}
