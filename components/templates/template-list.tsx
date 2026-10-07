"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTemplates } from "@/lib/queries/templates";
import { TemplateIcon } from "./template-icon";

export function TemplateList() {
  const { data, isPending, error } = useTemplates();

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar las plantillas: {error.message}
      </p>
    );
  }
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay plantillas.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.map((t) => (
        <li key={t.id}>
          <Link
            href={`/plantillas/${t.id}`}
            className="flex min-h-20 items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
          >
            <TemplateIcon icon={t.icon} color={t.color} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {t.fields.length === 0 ? "Solo campos comunes" : `${t.fields.length} campos`}
                {t.description && ` · ${t.description}`}
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
