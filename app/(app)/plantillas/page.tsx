import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Library, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateList } from "@/components/templates/template-list";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plantillas" };

export default function PlantillasPage() {
  return (
    <>
      <PageHeader title="Plantillas">
        <p className="text-sm text-muted-foreground">
          Una por actividad o protocolo. Toca una para ver su formulario o editarla.
        </p>
      </PageHeader>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link
          href="/plantillas/protocolo"
          className={cn(buttonVariants(), "h-14 gap-2 rounded-xl")}
        >
          <FileText className="size-5" aria-hidden />
          Desde protocolo
        </Link>
        <Link
          href="/plantillas/nueva"
          className={cn(buttonVariants({ variant: "outline" }), "h-14 gap-2 rounded-xl")}
        >
          <Plus className="size-5" aria-hidden />
          En blanco
        </Link>
      </div>
      <Link
        href="/plantillas/paquetes"
        className="mb-4 flex min-h-12 items-center gap-3 rounded-xl border bg-card px-4 transition-colors hover:bg-muted/50"
      >
        <Library className="size-5 text-muted-foreground" aria-hidden />
        <span className="flex-1 font-medium">Plantillas por disciplina</span>
        <span className="text-sm text-muted-foreground">molecular, inmuno, conducta…</span>
      </Link>
      <TemplateList />
    </>
  );
}
