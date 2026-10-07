"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ChevronLeft, ChevronRight, GitBranch, Pencil, Plus } from "lucide-react";
import { StatusBadge } from "@/components/entry/status-badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { formatEntryDate } from "@/lib/datetime";
import {
  PARENT_TYPES,
  useSampleEntries,
  useSamples,
  useUpdateSample,
  type Sample,
  type SampleStatus,
} from "@/lib/queries/samples";
import { SAMPLE_TYPE_LABELS, SAMPLE_TYPES, type SampleType } from "@/lib/templates/fields";
import { cn } from "@/lib/utils";
import { SampleForm } from "./sample-form";
import { SampleStatusBadge } from "./sample-status-badge";

const typeLabel = (t: string) => SAMPLE_TYPE_LABELS[t as SampleType] ?? t;

export function SampleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const samples = useSamples();

  if (samples.isPending) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  if (samples.error) {
    return <p className="text-sm text-destructive">No se pudo cargar: {samples.error.message}</p>;
  }
  const sample = samples.data.find((s) => s.id === id);
  if (!sample) return <p>Esta muestra no existe.</p>;
  return <Detail key={sample.id} sample={sample} all={samples.data} />;
}

function Detail({ sample, all }: { sample: Sample; all: Sample[] }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateSample(sample.id);
  const entries = useSampleEntries(sample.id);
  const byId = new Map(all.map((s) => [s.id, s]));

  // Cadena hacia el origen (animal → … → esta muestra).
  const chain: Sample[] = [];
  for (
    let p = sample.parent_id ? byId.get(sample.parent_id) : undefined;
    p && chain.length < 50;
    p = p.parent_id ? byId.get(p.parent_id) : undefined
  ) {
    chain.unshift(p);
  }
  const children = all.filter((s) => s.parent_id === sample.id);
  const childTypes = SAMPLE_TYPES.filter((t) =>
    PARENT_TYPES[t].includes(sample.sample_type as SampleType),
  );
  const metadata = Object.entries((sample.metadata ?? {}) as Record<string, unknown>);

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Editar muestra</h1>
        <SampleForm
          initial={{
            code: sample.code,
            sample_type: sample.sample_type as SampleType,
            parent_id: sample.parent_id,
            status: sample.status as SampleStatus,
            storage_location: sample.storage_location,
            metadata: Object.fromEntries(metadata.map(([k, v]) => [k, String(v)])),
          }}
          submitLabel="Guardar cambios"
          pending={update.isPending}
          error={update.error}
          onCancel={() => setEditing(false)}
          onSubmit={(input) => update.mutate(input, { onSuccess: () => setEditing(false) })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <Link
            href="/muestras"
            className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-12 gap-1")}
          >
            <ChevronLeft className="size-5" aria-hidden />
            Muestras
          </Link>
          <Button variant="ghost" className="h-12 gap-1.5" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
        </div>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">{sample.code}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{typeLabel(sample.sample_type)}</span>
          <SampleStatusBadge status={sample.status as SampleStatus} />
          {sample.storage_location && <span>· {sample.storage_location}</span>}
        </div>
      </div>

      {metadata.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border bg-card p-4 text-sm">
          {metadata.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      <section aria-labelledby="cadena" className="flex flex-col gap-2">
        <h2 id="cadena" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <GitBranch className="size-5" aria-hidden />
          Cadena
        </h2>
        <ol className="flex flex-col">
          {chain.map((s) => (
            <li key={s.id} className="border-l-2 pb-2 pl-3">
              <SampleLink sample={s} />
            </li>
          ))}
          <li className="border-l-2 border-primary pb-2 pl-3">
            <span className="flex min-h-12 items-center gap-2 font-mono font-medium">
              {sample.code}
              <span className="font-sans text-sm font-normal text-muted-foreground">
                {typeLabel(sample.sample_type)} (esta)
              </span>
            </span>
          </li>
          {children.map((s) => (
            <li key={s.id} className="ml-4 border-l-2 pb-2 pl-3">
              <SampleLink sample={s} />
            </li>
          ))}
        </ol>
        {chain.length === 0 && children.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin muestra de origen ni derivadas.</p>
        )}
        {childTypes.length > 0 && (
          <Link
            href={`/muestras/nueva?padre=${encodeURIComponent(sample.code)}&tipo=${childTypes[0]}`}
            className={cn(buttonVariants({ variant: "outline" }), "h-12 gap-1.5")}
          >
            <Plus className="size-4" aria-hidden />
            Agregar derivada ({childTypes.map((t) => typeLabel(t).toLowerCase()).join(", ")})
          </Link>
        )}
      </section>

      <section aria-labelledby="entradas-muestra" className="flex flex-col gap-2">
        <h2 id="entradas-muestra" className="font-heading text-lg font-semibold">
          Entradas
        </h2>
        {entries.isPending ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        ) : !entries.data?.length ? (
          <p className="text-sm text-muted-foreground">Todavía no aparece en ninguna entrada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.data.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/entrada/${e.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title || "Sin título"}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatEntryDate(e.entry_date)} ·{" "}
                      {e.roles.map((r) => (r === "producida" ? "producida" : "usada")).join(" y ")}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SampleLink({ sample }: { sample: Sample }) {
  return (
    <Link
      href={`/muestras/${sample.id}`}
      className="flex min-h-12 items-center gap-2 hover:underline"
    >
      <span className="font-mono">{sample.code}</span>
      <span className="text-sm text-muted-foreground">{typeLabel(sample.sample_type)}</span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
