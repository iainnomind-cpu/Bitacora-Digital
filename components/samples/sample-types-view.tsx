"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import { chipClass, fieldInputClass } from "@/components/entry/fields/inputs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSampleTypes, useSaveSampleType, type SampleTypeRow } from "@/lib/queries/sample-types";
import { cn } from "@/lib/utils";

/** Tipos de muestra del usuario: cualquiera, para cualquier laboratorio (plásmido, cepa, suero…). */
export function SampleTypesView() {
  const types = useSampleTypes();
  const [editing, setEditing] = useState<SampleTypeRow | "nuevo" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/muestras"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-12 gap-1 self-start")}
      >
        <ChevronLeft className="size-5" aria-hidden />
        Muestras
      </Link>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Tipos de muestra</h1>
      <p className="text-sm text-muted-foreground">
        Define qué cosas rastreas en tu laboratorio, de qué vienen y qué datos llevan.
      </p>

      {editing === "nuevo" ? (
        <TypeForm onDone={() => setEditing(null)} />
      ) : (
        <Button className="h-12" onClick={() => setEditing("nuevo")}>
          <Plus className="size-4" aria-hidden />
          Nuevo tipo
        </Button>
      )}

      {types.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <ul className="flex flex-col gap-2">
          {types.all.map((t) =>
            editing !== "nuevo" && editing?.id === t.id ? (
              <li key={t.id}>
                <TypeForm type={t} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card p-3",
                  t.is_archived && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t.label}
                    {t.is_archived && (
                      <span className="ml-2 text-xs text-muted-foreground">(archivado)</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {t.parent_keys.length
                      ? `Viene de ${t.parent_keys.map(types.labelOf).join(" o ")}`
                      : "Sin origen"}
                    {t.metadata_keys.length > 0 && ` · ${t.metadata_keys.join(", ")}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-12"
                  aria-label={`Editar ${t.label}`}
                  onClick={() => setEditing(t)}
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

function TypeForm({ type, onDone }: { type?: SampleTypeRow; onDone: () => void }) {
  const types = useSampleTypes();
  const save = useSaveSampleType();
  const [label, setLabel] = useState(type?.label ?? "");
  const [parents, setParents] = useState<string[]>(type?.parent_keys ?? []);
  const [metadata, setMetadata] = useState((type?.metadata_keys ?? []).join(", "));

  const submit = (archive?: boolean) =>
    save.mutate(
      {
        id: type?.id,
        input: {
          label: label.trim(),
          parent_keys: parents,
          metadata_keys: metadata
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
          ...(archive !== undefined ? { is_archived: archive } : {}),
        },
      },
      { onSuccess: onDone },
    );

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (label.trim()) submit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo-nombre">Nombre</Label>
        <Input
          id="tipo-nombre"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej. Plásmido, Línea celular, Suero"
          className={fieldInputClass}
          autoFocus
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Puede venir de</legend>
        <div className="flex flex-wrap gap-2">
          {types.active
            .filter((t) => t.key !== type?.key)
            .map((t) => {
              const on = parents.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setParents(on ? parents.filter((p) => p !== t.key) : [...parents, t.key])
                  }
                  className={chipClass(on)}
                >
                  {t.label}
                </button>
              );
            })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo-datos">Datos sugeridos (separados por coma)</Label>
        <Input
          id="tipo-datos"
          value={metadata}
          onChange={(e) => setMetadata(e.target.value)}
          placeholder="Ej. resistencia, inserto, concentración"
          className={fieldInputClass}
        />
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
        <Button type="submit" className="h-12" disabled={save.isPending || !label.trim()}>
          Guardar
        </Button>
      </div>
      {type && (
        <Button
          type="button"
          variant="ghost"
          className="h-12"
          disabled={save.isPending}
          onClick={() => submit(!type.is_archived)}
        >
          {type.is_archived ? "Reactivar tipo" : "Archivar tipo"}
        </Button>
      )}
    </form>
  );
}
