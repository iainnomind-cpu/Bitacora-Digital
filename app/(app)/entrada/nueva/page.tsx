import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Nueva entrada" };

export default function NuevaEntradaPage() {
  return (
    <>
      <PageHeader title="Nueva entrada" />
      <ComingSoon icon={LayoutTemplate} title="Selector de plantilla" stage="3–4">
        Elegir plantilla por actividad (o dejar que la IA la sugiera) y llenar el formulario.
      </ComingSoon>
    </>
  );
}
