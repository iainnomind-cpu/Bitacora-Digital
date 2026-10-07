"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, FlaskConical, Plus, Search } from "lucide-react";
import { chipClass } from "@/components/entry/fields/inputs";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSamples, type Sample, type SampleStatus } from "@/lib/queries/samples";
import { SAMPLE_TYPE_LABELS, SAMPLE_TYPES, type SampleType } from "@/lib/templates/fields";
import { cn } from "@/lib/utils";
import { SampleStatusBadge } from "./sample-status-badge";

/** Muestras (§9.8): lista por tipo, búsqueda por código. */
export function SamplesView() {
  const samples = useSamples();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SampleType | null>(null);
  const [onlyActive, setOnlyActive] = useState(true);

  const q = query.trim().toLowerCase();
  const visible = (samples.data ?? []).filter(
    (s) =>
      (!type || s.sample_type === type) &&
      (!onlyActive || s.status === "activa") &&
      (!q ||
        s.code.toLowerCase().includes(q) ||
        (s.storage_location ?? "").toLowerCase().includes(q)),
  );
  const codeById = new Map((samples.data ?? []).map((s) => [s.id, s.code]));
  const counts = new Map<string, number>();
  for (const s of samples.data ?? [])
    counts.set(s.sample_type, (counts.get(s.sample_type) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={type ? `/muestras/nueva?tipo=${type}` : "/muestras/nueva"}
        className={cn(buttonVariants(), "h-14 w-full gap-2 rounded-xl text-base")}
      >
        <Plus className="size-5" aria-hidden />
        Nueva muestra
      </Link>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar código o ubicación"
          aria-label="Buscar muestra"
          className="h-12 pl-10 font-mono text-base"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button type="button" onClick={() => setType(null)} className={chipClass(type == null)}>
          Todas
        </button>
        {SAMPLE_TYPES.filter((t) => counts.has(t)).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(type === t ? null : t)}
            className={cn(chipClass(type === t), "shrink-0")}
          >
            {SAMPLE_TYPE_LABELS[t]} <span className="opacity-70">{counts.get(t)}</span>
          </button>
        ))}
      </div>
      <label className="flex min-h-12 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyActive}
          onChange={(e) => setOnlyActive(e.target.checked)}
          className="size-5 accent-primary"
        />
        Solo activas
      </label>

      {samples.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : samples.error ? (
        <p className="text-sm text-destructive">No se pudieron cargar: {samples.error.message}</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <FlaskConical className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-medium">
            {samples.data.length ? "Sin resultados" : "Aún no hay muestras"}
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Registra animales, bloques, navajas, rejillas… o créalas desde una entrada con los
            códigos que dictaste.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((s) => (
            <SampleRow
              key={s.id}
              sample={s}
              parentCode={s.parent_id ? codeById.get(s.parent_id) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SampleRow({ sample, parentCode }: { sample: Sample; parentCode?: string }) {
  return (
    <li>
      <Link
        href={`/muestras/${sample.id}`}
        className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono font-medium">{sample.code}</p>
          <p className="truncate text-sm text-muted-foreground">
            {SAMPLE_TYPE_LABELS[sample.sample_type as SampleType] ?? sample.sample_type}
            {parentCode && ` · de ${parentCode}`}
            {sample.storage_location && ` · ${sample.storage_location}`}
          </p>
        </div>
        {sample.status !== "activa" && <SampleStatusBadge status={sample.status as SampleStatus} />}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
