import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { GuideBanner } from "@/components/onboarding/guide";
import { TemplatePicker } from "@/components/entry/template-picker";

export const metadata: Metadata = { title: "Nueva entrada" };

export default function NuevaEntradaPage() {
  return (
    <>
      <PageHeader title="Nueva entrada">
        <p className="text-sm text-muted-foreground">¿Qué actividad vas a registrar?</p>
      </PageHeader>
      <GuideBanner task="entrada" />
      {/* useSearchParams es dato de tiempo de ejecución (cacheComponents). */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <TemplatePicker />
      </Suspense>
    </>
  );
}
