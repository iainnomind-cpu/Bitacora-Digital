"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  Archive,
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  Copy,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DynamicForm } from "@/components/entry/dynamic-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { useArchiveTemplate, useTemplate, type TemplateWithFields } from "@/lib/queries/templates";
import { fieldsToJsonSchema } from "@/lib/templates/json-schema";
import {
  initialValues,
  validateEntryData,
  type EntryData,
  type ValidationMode,
} from "@/lib/templates/values";
import { cn } from "@/lib/utils";
import { TemplateIcon } from "./template-icon";

export function TemplatePreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: template, isPending, error } = useTemplate(id);

  if (isPending) return <PreviewSkeleton />;
  if (error) {
    return (
      <p className="text-sm text-destructive">No se pudo cargar la plantilla: {error.message}</p>
    );
  }
  if (!template) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>Esta plantilla no existe.</p>
        <BackLink />
      </div>
    );
  }
  return <PreviewForm key={template.id} template={template} />;
}

export function PreviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/plantillas"
      className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-12 gap-1")}
    >
      <ChevronLeft className="size-5" aria-hidden />
      Plantillas
    </Link>
  );
}

function PreviewForm({ template }: { template: TemplateWithFields }) {
  const [data, setData] = useState<EntryData>(() => initialValues(template.fields));
  const [checked, setChecked] = useState<ValidationMode | null>(null);
  const errors = checked ? validateEntryData(template.fields, data, checked) : {};
  const errorCount = Object.keys(errors).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink />
        <TemplateActions template={template} />
        <div className="mt-2 flex items-start gap-3">
          <TemplateIcon icon={template.icon} color={template.color} />
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{template.name}</h1>
            <p className="text-sm text-muted-foreground">
              Versión {template.current_version}
              {template.description && ` · ${template.description}`}
            </p>
          </div>
        </div>
      </div>

      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        Vista previa del formulario. Nada de lo que escribas aquí se guarda.
      </p>

      {template.fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta plantilla solo usa los campos comunes de la entrada: objetivo, observaciones,
          resultados, siguiente paso y ubicación de datos.
        </p>
      ) : (
        <DynamicForm fields={template.fields} value={data} onChange={setData} errors={errors} />
      )}

      {checked && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
            errorCount
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {errorCount ? (
            <CircleAlert className="size-5 shrink-0" aria-hidden />
          ) : (
            <CircleCheck className="size-5 shrink-0" aria-hidden />
          )}
          {errorCount
            ? `${errorCount} ${errorCount === 1 ? "campo necesita" : "campos necesitan"} revisión.`
            : checked === "cierre"
              ? "Lista para cerrarse."
              : "Válida como borrador."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" onClick={() => setChecked("borrador")}>
          Revisar borrador
        </Button>
        <Button className="h-12" onClick={() => setChecked("cierre")}>
          Revisar para cerrar
        </Button>
      </div>
      <Button
        variant="ghost"
        className="h-12"
        onClick={() => {
          setData(initialValues(template.fields));
          setChecked(null);
        }}
      >
        <RotateCcw className="size-4" aria-hidden />
        Reiniciar
      </Button>

      <details className="rounded-xl border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Datos (JSON)</summary>
        <pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
      </details>
      <details className="rounded-xl border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Esquema para la IA (JSON Schema)</summary>
        <pre className="mt-3 overflow-x-auto text-xs">
          {JSON.stringify(fieldsToJsonSchema(template.fields), null, 2)}
        </pre>
      </details>
    </div>
  );
}

function TemplateActions({ template }: { template: TemplateWithFields }) {
  const router = useRouter();
  const archive = useArchiveTemplate();
  return (
    <div className="mt-1 grid grid-cols-3 gap-2">
      <Link
        href={`/plantillas/${template.id}/editar`}
        className={cn(buttonVariants({ variant: "outline" }), "h-12 gap-1.5")}
      >
        <Pencil className="size-4" aria-hidden />
        Editar
      </Link>
      <Link
        href={`/plantillas/nueva?desde=${template.id}`}
        className={cn(buttonVariants({ variant: "outline" }), "h-12 gap-1.5")}
      >
        <Copy className="size-4" aria-hidden />
        Duplicar
      </Link>
      <Button
        variant="outline"
        className="h-12 gap-1.5"
        disabled={archive.isPending}
        onClick={() =>
          archive.mutate(
            { id: template.id, archived: !template.is_archived },
            { onSuccess: () => router.push("/plantillas") },
          )
        }
      >
        <Archive className="size-4" aria-hidden />
        {template.is_archived ? "Reactivar" : "Archivar"}
      </Button>
    </div>
  );
}
