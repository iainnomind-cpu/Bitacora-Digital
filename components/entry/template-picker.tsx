"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { TemplateIcon } from "@/components/templates/template-icon";
import { dateInTimeZone } from "@/lib/datetime";
import { assignAttachments } from "@/lib/queries/attachments";
import { useCreateEntry, useTemplateUsage } from "@/lib/queries/entries";
import { useTimeZone } from "@/lib/queries/profile";
import { useTemplates, type TemplateWithFields } from "@/lib/queries/templates";
import { initialValues } from "@/lib/templates/values";
import { cn } from "@/lib/utils";

/**
 * Selector de plantilla (§9.2): las más usadas primero; al tocar una se crea la entrada.
 * Con `?adjuntos=id,id` (desde la bandeja) esos adjuntos pasan a la entrada nueva.
 */
export function TemplatePicker() {
  const router = useRouter();
  const attachmentIds = (useSearchParams().get("adjuntos") ?? "")
    .split(",")
    .filter((id) => z.uuid().safeParse(id).success);
  const [assignError, setAssignError] = useState<string | null>(null);
  const timeZone = useTimeZone();
  const templates = useTemplates();
  const usage = useTemplateUsage();
  const create = useCreateEntry();
  const [chosen, setChosen] = useState<string | null>(null);

  if (templates.isPending || usage.isPending) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }
  if (templates.error || usage.error) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar las plantillas: {(templates.error ?? usage.error)?.message}
      </p>
    );
  }

  const count = (t: TemplateWithFields) => usage.data.get(t.id) ?? 0;
  const sorted = [...templates.data].sort(
    (a, b) =>
      count(b) - count(a) ||
      Number(a.activity_type === "libre") - Number(b.activity_type === "libre") ||
      a.name.localeCompare(b.name, "es"),
  );

  const start = (t: TemplateWithFields) => {
    setChosen(t.id);
    create.mutate(
      {
        entryDate: dateInTimeZone(new Date(), timeZone),
        templateId: t.id,
        templateVersion: t.current_version,
        title: t.name,
        data: initialValues(t.fields),
      },
      {
        onSuccess: async (entry) => {
          if (attachmentIds.length > 0) {
            try {
              await assignAttachments(attachmentIds, entry.id);
            } catch (e) {
              // La entrada ya existe; los adjuntos siguen en la bandeja para asignarlos de nuevo.
              setAssignError(e instanceof Error ? e.message : String(e));
            }
          }
          router.replace(`/entrada/${entry.id}`);
        },
        onError: () => setChosen(null),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {attachmentIds.length > 0 && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm">
          {attachmentIds.length === 1
            ? "El adjunto seleccionado se agregará a la entrada nueva."
            : `Los ${attachmentIds.length} adjuntos seleccionados se agregarán a la entrada nueva.`}
        </p>
      )}
      {assignError && (
        <p role="alert" className="text-sm text-destructive">
          No se pudieron mover los adjuntos: {assignError}
        </p>
      )}
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo crear la entrada: {create.error.message}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3">
        {sorted.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              disabled={chosen != null}
              onClick={() => start(t)}
              className={cn(
                "flex h-28 w-full flex-col items-start justify-between rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60",
                chosen === t.id && "border-primary ring-2 ring-primary/30 disabled:opacity-100",
              )}
            >
              <span className="flex w-full items-start justify-between">
                <TemplateIcon icon={t.icon} color={t.color} className="size-10" />
                {chosen === t.id && (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                )}
              </span>
              <span className="line-clamp-2 text-sm leading-tight font-medium">{t.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
