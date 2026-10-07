import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SamplesView } from "@/components/samples/samples-view";

export const metadata: Metadata = { title: "Muestras" };

export default function MuestrasPage() {
  return (
    <>
      <PageHeader title="Muestras">
        <p className="text-sm text-muted-foreground">
          Animales, tejidos, bloques, navajas, rejillas, laminillas y muestras de microCT.
        </p>
      </PageHeader>
      <SamplesView />
    </>
  );
}
