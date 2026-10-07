import type { Metadata } from "next";
import { Suspense } from "react";
import { PreviewSkeleton, TemplatePreview } from "@/components/templates/template-preview";

export const metadata: Metadata = { title: "Plantilla" };

export default function PlantillaPage({ params }: PageProps<"/plantillas/[id]">) {
  return (
    <Suspense fallback={<PreviewSkeleton />}>
      <TemplatePreview params={params} />
    </Suspense>
  );
}
