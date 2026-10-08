import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
const subscribe = (cb: () => void) => {
  const t = setInterval(cb, MINUTE / 2);
  return () => clearInterval(t);
};

/** Hora actual redondeada al minuto (se actualiza sola); 0 durante el prerender. */
export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE) * MINUTE,
    () => 0,
  );
}
