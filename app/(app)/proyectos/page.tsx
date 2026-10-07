import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata: Metadata = { title: "Proyectos" };

export default function ProyectosPage() {
  return (
    <>
      <PageHeader title="Proyectos">
        <p className="text-sm text-muted-foreground">
          Experimentos o líneas de trabajo. El activo filtra Hoy y se asigna a las entradas nuevas.
        </p>
      </PageHeader>
      <ProjectsView />
    </>
  );
}
