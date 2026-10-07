import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchView } from "@/components/search/search-view";

export const metadata: Metadata = { title: "Buscar" };

export default function BuscarPage() {
  return (
    <>
      <PageHeader title="Buscar" />
      {/* useSearchParams es dato de tiempo de ejecución (cacheComponents). */}
      <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-muted" />}>
        <SearchView />
      </Suspense>
    </>
  );
}
