import type { Metadata } from "next";
import { Search } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Buscar" };

export default function BuscarPage() {
  return (
    <>
      <PageHeader title="Buscar" />
      <ComingSoon icon={Search} title="Búsqueda" stage="8">
        Texto completo en español y filtros por fecha, actividad y código de muestra.
      </ComingSoon>
    </>
  );
}
