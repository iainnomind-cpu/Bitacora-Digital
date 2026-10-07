"use client";

import { useState } from "react";
import { CheckCircle2, FolderKanban, Pencil, Plus } from "lucide-react";
import { fieldInputClass } from "@/components/entry/fields/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  parseVocabulary,
  useActiveProject,
  useProjects,
  useSaveProject,
  useUpdateProfile,
  type Project,
} from "@/lib/queries/projects";
import { cn } from "@/lib/utils";

/** Proyectos o experimentos: agrupan entradas y le dan contexto a la IA. */
export function ProjectsView() {
  const projects = useProjects();
  const active = useActiveProject();
  const setActive = useUpdateProfile();
  const [editing, setEditing] = useState<Project | "nuevo" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {editing === "nuevo" ? (
        <ProjectForm onDone={() => setEditing(null)} />
      ) : (
        <Button className="h-14 text-base" onClick={() => setEditing("nuevo")}>
          <Plus className="size-5" aria-hidden />
          Nuevo proyecto
        </Button>
      )}

      {projects.isPending ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : projects.data?.length === 0 && editing !== "nuevo" ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <FolderKanban className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-medium">Aún no hay proyectos</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Por ejemplo “Tesis 3xTg”, “Western de PSD-95” o “Cohorte de conducta 2”. Cada entrada
            nueva se asigna al proyecto activo.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.data?.map((p) =>
            editing !== "nuevo" && editing?.id === p.id ? (
              <li key={p.id}>
                <ProjectForm project={p} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border bg-card p-3",
                  p.status === "archivado" && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {p.name}
                    {active.id === p.id && (
                      <CheckCircle2 className="size-4 text-emerald-600" aria-label="Activo" />
                    )}
                    {p.status === "archivado" && (
                      <span className="text-xs text-muted-foreground">(archivado)</span>
                    )}
                  </p>
                  {p.description && (
                    <p className="truncate text-sm text-muted-foreground">{p.description}</p>
                  )}
                </div>
                {active.id !== p.id && p.status === "activo" && (
                  <Button
                    variant="outline"
                    className="h-12"
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ active_project_id: p.id })}
                  >
                    Activar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-12"
                  aria-label={`Editar ${p.name}`}
                  onClick={() => setEditing(p)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const save = useSaveProject();
  const setActive = useUpdateProfile();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [context, setContext] = useState(project?.ai_context ?? "");
  const [vocabulary, setVocabulary] = useState((project?.vocabulary ?? []).join(", "));

  const submit = (status?: "activo" | "archivado") =>
    save.mutate(
      {
        id: project?.id,
        input: {
          name: name.trim(),
          description: description.trim() || null,
          ai_context: context.trim() || null,
          vocabulary: parseVocabulary(vocabulary),
          ...(status ? { status } : {}),
        },
      },
      {
        onSuccess: (id) => {
          // Un proyecto recién creado queda activo.
          if (!project) setActive.mutate({ active_project_id: id });
          if (status === "archivado") setActive.mutate({ active_project_id: null });
          onDone();
        },
      },
    );

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) submit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="proy-nombre">Nombre</Label>
        <Input
          id="proy-nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldInputClass}
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="proy-desc">Descripción</Label>
        <Input
          id="proy-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Objetivo o pregunta del experimento"
          className={fieldInputClass}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="proy-contexto">Contexto para la IA</Label>
        <Textarea
          id="proy-contexto"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Modelo, técnicas y condiciones: “Ratones 3xTg de 6 y 12 meses; IHQ de IBA1 y GFAP en hipocampo”"
          className="min-h-24 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="proy-vocab">Vocabulario (separado por comas)</Label>
        <Textarea
          id="proy-vocab"
          value={vocabulary}
          onChange={(e) => setVocabulary(e.target.value)}
          placeholder="Siglas, reactivos y nombres que se dictan: GFAP, CA1, Alexa 488"
          className="min-h-16 text-base"
        />
        <p className="text-xs text-muted-foreground">
          Ayuda a que la transcripción escriba bien esos términos.
        </p>
      </div>
      {save.error && (
        <p role="alert" className="text-sm text-destructive">
          {save.error.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="h-12" disabled={save.isPending || !name.trim()}>
          Guardar
        </Button>
      </div>
      {project && (
        <Button
          type="button"
          variant="ghost"
          className="h-12"
          disabled={save.isPending}
          onClick={() => submit(project.status === "activo" ? "archivado" : "activo")}
        >
          {project.status === "activo" ? "Archivar proyecto" : "Reactivar proyecto"}
        </Button>
      )}
    </form>
  );
}
