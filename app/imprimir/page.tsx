import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintView } from "@/components/print/print-view";

export const metadata: Metadata = { title: "Imprimir" };

// Fuera del grupo (app): sin barra de navegación, para que el PDF salga limpio.
export default function ImprimirPage() {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Preparando el documento…</p>}>
      <PrintView />
    </Suspense>
  );
}
