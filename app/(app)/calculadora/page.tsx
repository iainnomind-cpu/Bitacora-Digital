import type { Metadata } from "next";
import { Suspense } from "react";
import { CalculatorView } from "@/components/calc/calculator-view";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Calculadora de soluciones" };

export default function CalculadoraPage() {
  return (
    <>
      <PageHeader title="Soluciones">
        <p className="text-sm text-muted-foreground">Calculadora para preparar soluciones.</p>
      </PageHeader>
      {/* useSearchParams es dato de tiempo de ejecución (cacheComponents). */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <CalculatorView />
      </Suspense>
    </>
  );
}
