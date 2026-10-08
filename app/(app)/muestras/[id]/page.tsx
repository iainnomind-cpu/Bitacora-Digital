import type { Metadata } from "next";
import { Suspense } from "react";
import { GuideBanner } from "@/components/onboarding/guide";
import { SampleDetail } from "@/components/samples/sample-detail";

export const metadata: Metadata = { title: "Muestra" };

export default function MuestraPage({ params }: PageProps<"/muestras/[id]">) {
  return (
    <>
      <GuideBanner task="derivada" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <SampleDetail params={params} />
      </Suspense>
    </>
  );
}
