"use client";

import { useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEntryDate } from "@/lib/datetime";
import { useSampleTypes } from "@/lib/queries/sample-types";
import type { Sample } from "@/lib/queries/samples";
import { cn } from "@/lib/utils";

/**
 * Elegir la muestra de origen ("Viene de") de una lista, sin escribir el código: las muestras
 * registradas de los tipos permitidos, con búsqueda y las más recientes primero.
 */
export function ParentPicker({
  id,
  options,
  all,
  value,
  onChange,
}: {
  id: string;
  /** Posibles orígenes (ya filtrados por tipo). */
  options: Sample[];
  /** Todas las muestras (para mostrar de dónde viene cada opción). */
  all: Sample[];
  value: string;
  onChange: (code: string) => void;
}) {
  const types = useSampleTypes();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = options.find((s) => s.code === value);
  const codeOf = new Map(all.map((s) => [s.id, s.code]));
  const query = q.trim().toLowerCase();
  const list = options
    .filter((s) => s.status !== "descartada" || s.code === value)
    .filter(
      (s) =>
        !query ||
        s.code.toLowerCase().includes(query) ||
        JSON.stringify(s.metadata).toLowerCase().includes(query),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 60);

  const describe = (s: Sample) =>
    [
      types.labelOf(s.sample_type),
      s.parent_id && `de ${codeOf.get(s.parent_id) ?? "?"}`,
      ...Object.values((s.metadata ?? {}) as Record<string, unknown>)
        .filter(Boolean)
        .slice(0, 2)
        .map(String),
      formatEntryDate(s.created_at.slice(0, 10)),
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="flex flex-col gap-2">
      {selected ? (
        <div className="flex min-h-14 items-center gap-2 rounded-xl border border-primary bg-primary/5 pr-1 pl-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono font-medium">{selected.code}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {describe(selected)}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-12"
            aria-label="Quitar origen"
            onClick={() => onChange("")}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
      <Button
        id={id}
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="h-12 justify-between text-base"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" aria-hidden />
          {selected ? "Cambiar origen" : "Elegir de dónde viene"}
        </span>
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </Button>

      {open && (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-primary/30 bg-card p-3">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes muestras registradas de ese tipo. Regístrala primero o deja el origen
              vacío.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar código o dato"
                  aria-label="Buscar muestra de origen"
                  className="h-12 pl-9 font-mono text-base"
                />
              </div>
              <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                {list.map((s) => {
                  const on = s.code === value;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(on ? "" : s.code);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left",
                          on ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                            on && "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          {on && <Check className="size-4" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono font-medium">{s.code}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {describe(s)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {list.length === 0 && (
                  <li className="text-sm text-muted-foreground">Sin resultados.</li>
                )}
              </ul>
            </>
          )}
          <Button type="button" variant="ghost" className="h-12" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}
