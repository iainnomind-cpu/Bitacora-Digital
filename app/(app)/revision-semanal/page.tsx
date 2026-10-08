import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { WeeklyReview } from "@/components/review/weekly-review";

export const metadata: Metadata = { title: "Revisión semanal" };

export default function RevisionSemanalPage() {
  return (
    <>
      <PageHeader title="Revisión semanal">
        <p className="text-sm text-muted-foreground">Qué se hizo, problemas y siguientes pasos.</p>
      </PageHeader>
      {/* useSearchParams es dato de tiempo de ejecución (cacheComponents). */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <WeeklyReview />
      </Suspense>
    </>
  );
}
