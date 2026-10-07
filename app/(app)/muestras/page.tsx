import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Muestras" };

export default function MuestrasPage() {
  return (
    <>
      <PageHeader title="Muestras" />
      <ComingSoon icon={FlaskConical} title="Muestras" stage="7">
        Animales, bloques, navajas y rejillas con su cadena padre → hijos.
      </ComingSoon>
    </>
  );
}
