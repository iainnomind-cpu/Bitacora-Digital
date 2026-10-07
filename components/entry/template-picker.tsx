"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { TemplateIcon } from "@/components/templates/template-icon";
import { dateInTimeZone } from "@/lib/datetime";
import { useCreateEntry, useTemplateUsage } from "@/lib/queries/entries";
import { useTimeZone } from "@/lib/queries/profile";
import { useTemplates, type TemplateWithFields } from "@/lib/queries/templates";
import { initialValues } from "@/lib/templates/values";
import { cn } from "@/lib/utils";

/** Selector de plantilla (§9.2): las más usadas primero; al tocar una se crea la entrada. */
export function TemplatePicker() {
  const router = useRouter();
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
        onSuccess: (entry) => router.replace(`/entrada/${entry.id}`),
        onError: () => setChosen(null),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
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
