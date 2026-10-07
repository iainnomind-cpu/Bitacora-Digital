"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FlaskConical, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { StatusBadge } from "@/components/entry/status-badge";
import { TemplateIcon } from "@/components/templates/template-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEntryDate } from "@/lib/datetime";
import { isEmptySearch, useEntrySearch, type SearchFilters } from "@/lib/queries/search";
import { useTemplates } from "@/lib/queries/templates";
import { flattenData, snippet } from "@/lib/search/text";
import { SAMPLE_TYPE_LABELS, type SampleType } from "@/lib/templates/fields";

const DEBOUNCE_MS = 350;
const selectClass =
  "h-12 w-full rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30";

function readFilters(params: URLSearchParams): SearchFilters {
  return {
    q: params.get("q") ?? "",
    from: params.get("desde"),
    to: params.get("hasta"),
    templateId: params.get("plantilla"),
    includeVoided: params.get("anuladas") === "1",
  };
}

function toParams(f: SearchFilters) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.from) p.set("desde", f.from);
  if (f.to) p.set("hasta", f.to);
  if (f.templateId) p.set("plantilla", f.templateId);
  if (f.includeVoided) p.set("anuladas", "1");
  return p.toString();
}

/** Buscar (§9.7): texto + filtros por fecha, actividad y código de muestra. */
export function SearchView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const templates = useTemplates();

  const [filters, setFilters] = useState(() => readFilters(params));
  const [text, setText] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(
    Boolean(filters.from || filters.to || filters.templateId || filters.includeVoided),
  );

  // La caja de texto aplica tras una pausa; los filtros, al instante.
  useEffect(() => {
    const t = setTimeout(
      () => setFilters((f) => (f.q === text ? f : { ...f, q: text })),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [text]);

  // Guardar la búsqueda en la URL para volver a ella con "atrás".
  useEffect(() => {
    const qs = toParams(filters);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

  const search = useEntrySearch(filters);
  const byTemplate = new Map(templates.data?.map((t) => [t.id, t]));
  const set = (patch: Partial<SearchFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const activeFilters = [
    filters.from,
    filters.to,
    filters.templateId,
    filters.includeVoided,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: text });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Texto o código (ej. B-014-A)"
            aria-label="Buscar en la bitácora"
            className="h-12 pl-10 text-base"
            autoFocus={!filters.q}
          />
        </div>
        <Button
          type="button"
          variant={showFilters || activeFilters ? "secondary" : "outline"}
          className="h-12 gap-1.5 px-3"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Filtros</span>
          {activeFilters > 0 && <span className="text-xs">{activeFilters}</span>}
        </Button>
      </form>

      {showFilters && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="desde">Desde</Label>
              <Input
                id="desde"
                type="date"
                value={filters.from ?? ""}
                onChange={(e) => set({ from: e.target.value || null })}
                className="h-12 text-base"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="hasta">Hasta</Label>
              <Input
                id="hasta"
                type="date"
                value={filters.to ?? ""}
                onChange={(e) => set({ to: e.target.value || null })}
                className="h-12 text-base"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="plantilla">Actividad</Label>
            <select
              id="plantilla"
              value={filters.templateId ?? ""}
              onChange={(e) => set({ templateId: e.target.value || null })}
              className={selectClass}
            >
              <option value="">Todas</option>
              {templates.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-12 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.includeVoided}
              onChange={(e) => set({ includeVoided: e.target.checked })}
              className="size-5 accent-primary"
            />
            Incluir entradas anuladas
          </label>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              className="h-12"
              onClick={() => set({ from: null, to: null, templateId: null, includeVoided: false })}
            >
              <X className="size-4" aria-hidden />
              Quitar filtros
            </Button>
          )}
        </div>
      )}

      {isEmptySearch(filters) ? (
        <p className="text-sm text-muted-foreground">
          Busca palabras (sin importar acentos), frases entre comillas o un código de muestra para
          ver todas las entradas donde aparece.
        </p>
      ) : search.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : search.error ? (
        <p role="alert" className="text-sm text-destructive">
          No se pudo buscar: {search.error.message}
        </p>
      ) : (
        <>
          {search.data.samples.length > 0 && (
            <section aria-labelledby="r-muestras" className="flex flex-col gap-2">
              <h2 id="r-muestras" className="text-sm font-medium text-muted-foreground">
                Muestras
              </h2>
              <ul className="flex flex-wrap gap-2">
                {search.data.samples.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/muestras/${s.id}`}
                      className="flex h-12 items-center gap-2 rounded-xl border bg-card px-3 text-sm hover:bg-muted/50"
                    >
                      <FlaskConical className="size-4 text-muted-foreground" aria-hidden />
                      <span className="font-mono">{s.code}</span>
                      <span className="text-muted-foreground">
                        {SAMPLE_TYPE_LABELS[s.sample_type as SampleType] ?? s.sample_type}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            aria-labelledby="r-entradas"
            className="flex flex-col gap-2"
            aria-busy={search.isFetching}
          >
            <h2
              id="r-entradas"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              {search.data.entries.length === 0
                ? "Sin entradas"
                : `${search.data.entries.length}${search.data.truncated ? "+" : ""} ${search.data.entries.length === 1 ? "entrada" : "entradas"}`}
              {search.isFetching && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            </h2>
            <ol className="flex flex-col gap-2">
              {search.data.entries.map((e) => {
                const t = byTemplate.get(e.template_id);
                const hit = filters.q
                  ? snippet(
                      [
                        e.title,
                        e.objective,
                        ...flattenData(e.data),
                        e.observations,
                        e.results,
                        e.next_steps,
                        e.data_location,
                      ],
                      filters.q,
                    )
                  : null;
                return (
                  <li key={e.id}>
                    <Link
                      href={`/entrada/${e.id}`}
                      className="flex gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
                    >
                      <TemplateIcon
                        icon={t?.icon ?? null}
                        color={t?.color ?? null}
                        className="size-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.title || t?.name || "Sin título"}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge status={e.status} />
                          <span>{formatEntryDate(e.entry_date)}</span>
                          {t && <span className="truncate">{t.name}</span>}
                        </div>
                        {hit && (
                          <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">
                            {hit.before}
                            <mark className="rounded bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30">
                              {hit.match}
                            </mark>
                            {hit.after}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {search.data.truncated && (
              <p className="text-xs text-muted-foreground">
                Se muestran las 50 más recientes; agrega filtros para acotar.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
