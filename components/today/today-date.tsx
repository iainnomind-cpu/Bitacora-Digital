"use client";

import { useMounted } from "@/lib/hooks/use-mounted";
import { formatLongDate } from "@/lib/datetime";

// La fecha se calcula en el navegador: la página se prerenderiza y no debe
// quedar congelada con la fecha de compilación.
export function TodayDate() {
  const mounted = useMounted();
  return (
    <p className="mt-1 min-h-5 text-sm text-muted-foreground first-letter:uppercase">
      {mounted ? formatLongDate(new Date()) : " "}
    </p>
  );
}
