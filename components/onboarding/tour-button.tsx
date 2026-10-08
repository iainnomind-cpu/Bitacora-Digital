"use client";

import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOUR_EVENT } from "./welcome-tour";

/** Vuelve a abrir el recorrido de la app. */
export function TourButton() {
  return (
    <Button
      variant="outline"
      className="h-12 w-full justify-start gap-3 px-4"
      onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
    >
      <Compass className="size-5 text-muted-foreground" aria-hidden />
      Ver el recorrido de la app
    </Button>
  );
}
