import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TemplatePicker } from "@/components/entry/template-picker";

export const metadata: Metadata = { title: "Nueva entrada" };

export default function NuevaEntradaPage() {
  return (
    <>
      <PageHeader title="Nueva entrada">
        <p className="text-sm text-muted-foreground">¿Qué actividad vas a registrar?</p>
      </PageHeader>
      <TemplatePicker />
    </>
  );
}
