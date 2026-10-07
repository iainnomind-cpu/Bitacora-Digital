"use client";

import { useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMMON_REAGENTS } from "@/lib/chem/common-reagents";
import {
  useDeleteReagent,
  useReagentLibrary,
  useSaveReagent,
  type LibraryReagent,
} from "@/lib/queries/solutions";
import { PlainNumber } from "./calc-inputs";

/** Biblioteca de reactivos: los tuyos (editables) y los comunes de referencia. */
export function ReagentLibrary() {
  const library = useReagentLibrary();
  const remove = useDeleteReagent();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<LibraryReagent | "nuevo" | null>(null);
  const q = query.trim().toLowerCase();
  const match = (name: string, formula?: string | null) =>
    !q || name.toLowerCase().includes(q) || (formula ?? "").toLowerCase().includes(q);

  return (
    <div className="flex flex-col gap-4">
      {editing === "nuevo" ? (
        <ReagentForm onDone={() => setEditing(null)} />
      ) : (
        <Button className="h-12" onClick={() => setEditing("nuevo")}>
          <Plus className="size-4" aria-hidden />
          Agregar reactivo
        </Button>
      )}
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o fórmula"
          aria-label="Buscar reactivo"
          className="h-12 pl-10 text-base"
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading font-semibold">Mis reactivos</h2>
        {!library.data?.filter((r) => match(r.name, r.formula)).length ? (
          <p className="text-sm text-muted-foreground">
            Guarda aquí los tuyos con su peso molecular (el del frasco que usas).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {library.data
              .filter((r) => match(r.name, r.formula))
              .map((r) =>
                editing !== "nuevo" && editing?.id === r.id ? (
                  <li key={r.id}>
                    <ReagentForm reagent={r} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <li
                    key={r.id}
                    className="flex items-center gap-1 rounded-xl border bg-card p-1 pl-3"
                  >
                    <div className="min-w-0 flex-1 py-2">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          r.formula,
                          r.molecular_weight && `${r.molecular_weight} g/mol`,
                          r.cas && `CAS ${r.cas}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-12"
                      aria-label={`Editar ${r.name}`}
                      onClick={() => setEditing(r)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-12"
                      aria-label={`Borrar ${r.name}`}
                      onClick={() => remove.mutate(r.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ),
              )}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading font-semibold">Comunes</h2>
        <p className="text-xs text-muted-foreground">
          Las sales hidratadas pesan distinto: verifica la forma exacta en la etiqueta.
        </p>
        <ul className="divide-y rounded-xl border bg-card">
          {COMMON_REAGENTS.filter((r) => match(r.name, r.formula)).map((r) => (
            <li
              key={`${r.name}-${r.formula}`}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate">{r.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{r.formula}</span>
              </span>
              <span className="shrink-0 font-mono tabular-nums">{r.mw}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ReagentForm({ reagent, onDone }: { reagent?: LibraryReagent; onDone: () => void }) {
  const save = useSaveReagent();
  const [name, setName] = useState(reagent?.name ?? "");
  const [formula, setFormula] = useState(reagent?.formula ?? "");
  const [mw, setMw] = useState<number | null>(
    reagent?.molecular_weight ? Number(reagent.molecular_weight) : null,
  );
  const [cas, setCas] = useState(reagent?.cas ?? "");
  const [notes, setNotes] = useState(reagent?.notes ?? "");

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border-2 border-primary/40 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        save.mutate(
          {
            id: reagent?.id,
            name: name.trim(),
            formula: formula.trim() || null,
            molecular_weight: mw,
            cas: cas.trim() || null,
            notes: notes.trim() || null,
          },
          { onSuccess: onDone },
        );
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="r-nombre">Nombre</Label>
        <Input
          id="r-nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 text-base"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="r-formula">Fórmula</Label>
          <Input
            id="r-formula"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            className="h-12 font-mono text-base"
          />
        </div>
        <PlainNumber label="PM (g/mol)" value={mw} onChange={setMw} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="r-cas">CAS</Label>
          <Input
            id="r-cas"
            value={cas}
            onChange={(e) => setCas(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="r-notas">Notas</Label>
          <Input
            id="r-notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Marca, lote…"
            className="h-12 text-base"
          />
        </div>
      </div>
      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="h-12" disabled={save.isPending || !name.trim()}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
