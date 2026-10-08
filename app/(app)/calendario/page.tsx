import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarioPage() {
  return (
    <>
      <PageHeader title="Calendario">
        <p className="text-sm text-muted-foreground">Lo que hiciste y lo que tienes programado.</p>
      </PageHeader>
      {/* useSearchParams es dato de tiempo de ejecución (cacheComponents). */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <CalendarView />
      </Suspense>
    </>
  );
}
