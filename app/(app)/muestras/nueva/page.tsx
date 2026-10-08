import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { GuideBanner } from "@/components/onboarding/guide";
import { NewSample } from "@/components/samples/new-sample";

export const metadata: Metadata = { title: "Nueva muestra" };

export default function NuevaMuestraPage() {
  return (
    <>
      <PageHeader title="Nueva muestra" />
      <GuideBanner task="muestra" />
      <GuideBanner task="derivada" />
      {/* useSearchParams es dato de tiempo de ejecución (cacheComponents). */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <NewSample />
      </Suspense>
    </>
  );
}
