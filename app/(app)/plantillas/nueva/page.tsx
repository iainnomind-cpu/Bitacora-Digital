import type { Metadata } from "next";
import { Suspense } from "react";
import { NewTemplate } from "@/components/templates/template-pages";
import { PreviewSkeleton } from "@/components/templates/template-preview";

export const metadata: Metadata = { title: "Nueva plantilla" };

export default function NuevaPlantillaPage() {
  return (
    // useSearchParams es dato de tiempo de ejecución (cacheComponents).
    <Suspense fallback={<PreviewSkeleton />}>
      <NewTemplate />
    </Suspense>
  );
}
