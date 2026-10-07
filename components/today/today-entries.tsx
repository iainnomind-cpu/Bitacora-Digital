"use client";

import Link from "next/link";
import { ListTodo } from "lucide-react";
import { StatusBadge } from "@/components/entry/status-badge";
import { TemplateIcon } from "@/components/templates/template-icon";
import { dateInTimeZone, formatEntryDate, formatTime } from "@/lib/datetime";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useEntriesOfDay, usePendingDrafts } from "@/lib/queries/entries";
import { useTimeZone } from "@/lib/queries/profile";
import { useActiveProject } from "@/lib/queries/projects";
import { useTemplates } from "@/lib/queries/templates";

type Summary = NonNullable<ReturnType<typeof useEntriesOfDay>["data"]>[number];

/** Línea de tiempo del día y borradores pendientes de días anteriores (§9.1). */
export function TodayEntries() {
  const mounted = useMounted();
  const timeZone = useTimeZone();
  // La fecha se calcula en el navegador: la página se prerenderiza.
  const today = mounted ? dateInTimeZone(new Date(), timeZone) : "";
  const active = useActiveProject();
  if (!today || active.isPending) {
    return (
      <div className="mt-8">
        <ListSkeleton />
      </div>
    );
  }
  return <Lists today={today} projectId={active.id} />;
}

function Lists({ today, projectId }: { today: string; projectId: string | null }) {
  const entries = useEntriesOfDay(today, projectId);
  const pending = usePendingDrafts(today, projectId);

  return (
    <>
      <section aria-labelledby="linea-tiempo" className="mt-8">
        <h2 id="linea-tiempo" className="mb-3 font-heading text-lg font-semibold">
          Entradas del día
        </h2>
        {entries.isPending ? (
          <ListSkeleton />
        ) : entries.error ? (
          <p className="text-sm text-destructive">
            No se pudieron cargar las entradas: {entries.error.message}
          </p>
        ) : entries.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
            <ListTodo className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">Aún no hay entradas hoy</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Toca “Nueva entrada” para empezar a registrar.
            </p>
          </div>
        ) : (
          <EntryList entries={entries.data} />
        )}
      </section>

      {pending.data && pending.data.length > 0 && (
        <section aria-labelledby="pendientes" className="mt-8">
          <h2 id="pendientes" className="mb-1 font-heading text-lg font-semibold">
            Borradores sin cerrar
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">De días anteriores.</p>
          <EntryList entries={pending.data} showDate />
        </section>
      )}
    </>
  );
}

function EntryList({ entries, showDate }: { entries: Summary[]; showDate?: boolean }) {
  const timeZone = useTimeZone();
  const templates = useTemplates();
  const byId = new Map(templates.data?.map((t) => [t.id, t]));

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((e) => {
        const t = byId.get(e.template_id);
        return (
          <li key={e.id}>
            <Link
              href={`/entrada/${e.id}`}
              className="flex min-h-20 items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
            >
              <span className="w-12 shrink-0 text-center font-mono text-sm text-muted-foreground tabular-nums">
                {showDate
                  ? formatEntryDate(e.entry_date).replace(/ \d{4}$/, "")
                  : formatTime(e.started_at, timeZone)}
              </span>
              <TemplateIcon icon={t?.icon ?? null} color={t?.color ?? null} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.title || t?.name || "Sin título"}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  {t && <span className="truncate text-xs text-muted-foreground">{t.name}</span>}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
