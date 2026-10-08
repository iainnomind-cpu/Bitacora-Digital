"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, FileDown, History } from "lucide-react";
import { TemplateIcon } from "@/components/templates/template-icon";
import { buttonVariants } from "@/components/ui/button";
import { formatEntryDate } from "@/lib/datetime";
import type { Entry } from "@/lib/queries/entries";
import type { Template } from "@/lib/queries/templates";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export function EntryHeader({
  entry,
  template,
  aside,
}: {
  entry: Entry;
  template: Pick<Template, "name" | "icon" | "color">;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link href="/hoy" className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-12 gap-1")}>
          <ChevronLeft className="size-5" aria-hidden />
          Hoy
        </Link>
        <div className="flex items-center gap-1">
          {aside}
          <Link
            href={`/imprimir?entrada=${entry.id}`}
            aria-label="Exportar a PDF"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-12")}
          >
            <FileDown className="size-4" aria-hidden />
          </Link>
          <Link
            href={`/entrada/${entry.id}/historial`}
            className={cn(buttonVariants({ variant: "ghost" }), "h-12 gap-1.5")}
          >
            <History className="size-4" aria-hidden />
            Historial
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <TemplateIcon icon={template.icon} color={template.color} />
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{template.name}</p>
          <div className="flex items-center gap-2">
            <StatusBadge status={entry.status} />
            <span className="text-sm text-muted-foreground">
              {formatEntryDate(entry.entry_date)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
