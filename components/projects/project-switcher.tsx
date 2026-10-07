"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { useActiveProject, useProjects, useUpdateProfile } from "@/lib/queries/projects";

/**
 * Proyecto activo: filtra Hoy y se asigna a las entradas nuevas. "Todos" = sin proyecto.
 */
export function ProjectSwitcher() {
  const projects = useProjects();
  const active = useActiveProject();
  const update = useUpdateProfile();
  const list = (projects.data ?? []).filter((p) => p.status === "activo" || p.id === active.id);

  if (!projects.isPending && list.length === 0) {
    return (
      <Link
        href="/proyectos"
        className="flex min-h-12 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <FolderKanban className="size-4" aria-hidden />
        Organiza tu trabajo en proyectos
      </Link>
    );
  }

  return (
    <label className="flex min-h-12 items-center gap-2 text-sm">
      <FolderKanban className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">Proyecto activo</span>
      <select
        value={active.id ?? ""}
        disabled={update.isPending || active.isPending}
        onChange={(e) => update.mutate({ active_project_id: e.target.value || null })}
        className="h-12 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30"
      >
        <option value="">Todos los proyectos</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
