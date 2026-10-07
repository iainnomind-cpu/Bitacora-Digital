import type { Metadata } from "next";
import { Suspense } from "react";
import { EditTemplate } from "@/components/templates/template-pages";
import { PreviewSkeleton } from "@/components/templates/template-preview";

export const metadata: Metadata = { title: "Editar plantilla" };

export default function EditarPlantillaPage({ params }: PageProps<"/plantillas/[id]/editar">) {
  return (
    <Suspense fallback={<PreviewSkeleton />}>
      <EditTemplate params={params} />
    </Suspense>
  );
}
