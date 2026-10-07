import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** `false` durante el prerender/hidratación, `true` ya en el navegador. */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
