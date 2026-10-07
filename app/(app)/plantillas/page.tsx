import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateList } from "@/components/templates/template-list";

export const metadata: Metadata = { title: "Plantillas" };

export default function PlantillasPage() {
  return (
    <>
      <PageHeader title="Plantillas">
        <p className="text-sm text-muted-foreground">
          Toca una para ver su formulario. El editor llega en la fase 2.
        </p>
      </PageHeader>
      <TemplateList />
    </>
  );
}
