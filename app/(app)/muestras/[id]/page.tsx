import type { Metadata } from "next";
import { Suspense } from "react";
import { SampleDetail } from "@/components/samples/sample-detail";

export const metadata: Metadata = { title: "Muestra" };

export default function MuestraPage({ params }: PageProps<"/muestras/[id]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <SampleDetail params={params} />
    </Suspense>
  );
}
