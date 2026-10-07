"use client";

import { useState } from "react";
import { AlertTriangle, BookmarkPlus, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { chipClass } from "@/components/entry/fields/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeRecipe, type RecipeComponent } from "@/lib/chem/solutions";
import {
  CONC_UNITS,
  fmt,
  fmtMass,
  fmtVolume,
  type ConcUnit,
  type VolumeUnit,
  VOLUME,
} from "@/lib/chem/units";
import {
  useAiRecipe,
  useDeleteRecipe,
  useRecipes,
  useSaveRecipe,
  type SavedRecipe,
} from "@/lib/queries/solutions";
import { NumberWithUnit, PlainNumber, ReagentPicker, Result } from "./calc-inputs";

const VOLUMES = Object.keys(VOLUME) as VolumeUnit[];
const blank = (): RecipeComponent => ({
  name: "",
  final: 0,
  finalUnit: "mM",
  source: "solido",
  mw: null,
  stock: null,
  stockUnit: null,
  note: null,
});

type Draft = {
  id?: string;
  name: string;
  volume: number | null;
  volumeUnit: VolumeUnit;
  ph: number | null;
  instructions: string;
  components: RecipeComponent[];
};
const emptyDraft = (): Draft => ({
  name: "",
  volume: 1,
  volumeUnit: "L",
  ph: null,
  instructions: "",
  components: [blank()],
});

/**
 * Recetas de varios componentes (PBS, RIPA, Tris-HCl…): cada componente con su concentración
 * final, como sólido (con PM) o desde un stock. La app calcula cuánto pesar o pipetear para el
 * volumen elegido; la IA solo propone la composición.
 */
export function Recipes() {
  const recipes = useRecipes();
  const save = useSaveRecipe();
  const remove = useDeleteRecipe();
  const ai = useAiRecipe();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [askText, setAskText] = useState("");
  const [aiNotes, setAiNotes] = useState<{ instructions: string; warnings: string } | null>(null);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setComp = (i: number, patch: Partial<RecipeComponent>) =>
    set({ components: draft.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const valid = draft.components.filter((c) => c.name.trim() && c.final > 0);
  const result = draft.volume ? computeRecipe(valid, draft.volume, draft.volumeUnit) : null;

  const load = (r: SavedRecipe) => {
    setAiNotes(null);
    setDraft({
      id: r.id,
      name: r.name,
      volume: r.final_volume_ml ? Number(r.final_volume_ml) : 1000,
      volumeUnit: "mL",
      ph: r.ph != null ? Number(r.ph) : null,
      instructions: r.instructions ?? "",
      components: r.components.length ? r.components : [blank()],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        <Label htmlFor="pedir-receta" className="flex items-center gap-2">
          <Sparkles className="size-4" aria-hidden />
          Pedir la composición a la IA
        </Label>
        <div className="flex gap-2">
          <Input
            id="pedir-receta"
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder="Ej. RIPA 100 mL, PBS 10X 1 L, PFA 4 % 500 mL"
            className="h-12 text-base"
          />
          <Button
            className="h-12 shrink-0"
            disabled={ai.isPending || askText.trim().length < 3}
            onClick={() =>
              ai.mutate(askText.trim(), {
                onSuccess: (r) => {
                  setDraft({
                    name: r.name,
                    volume: r.final_volume_ml,
                    volumeUnit: "mL",
                    ph: r.ph,
                    instructions: r.instructions,
                    components: r.components.length ? r.components : [blank()],
                  });
                  setAiNotes({ instructions: r.instructions, warnings: r.warnings });
                },
              })
            }
          >
            {ai.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Pedir"}
          </Button>
        </div>
        {ai.error && <p className="text-sm text-destructive">{ai.error.message}</p>}
        {aiNotes?.warnings && (
          <p className="flex gap-2 rounded-lg bg-amber-500/10 p-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            {aiNotes.warnings}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          La IA solo propone componentes y concentraciones; los gramos y mililitros los calcula la
          app. Verifica la receta con tu protocolo.
        </p>
      </section>

      <div className="flex flex-col gap-1">
        <Label htmlFor="receta-nombre">Nombre</Label>
        <Input
          id="receta-nombre"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="PBS 1X"
          className="h-12 text-base"
        />
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <NumberWithUnit
          label="Volumen final"
          value={draft.volume}
          onChange={(v) => set({ volume: v })}
          unit={draft.volumeUnit}
          units={VOLUMES}
          onUnit={(u) => set({ volumeUnit: u })}
        />
        <PlainNumber label="pH" value={draft.ph} onChange={(v) => set({ ph: v })} />
      </div>

      <ol className="flex flex-col gap-3">
        {draft.components.map((c, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <ReagentPicker
                  label={`Componente ${i + 1}`}
                  name={c.name}
                  onName={(v) => setComp(i, { name: v })}
                  mw={c.mw ?? null}
                  onMw={(v) => setComp(i, { mw: v })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-12 shrink-0"
                aria-label={`Quitar componente ${i + 1}`}
                onClick={() => set({ components: draft.components.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
            <NumberWithUnit
              label="Concentración final"
              value={c.final || null}
              onChange={(v) => setComp(i, { final: v ?? 0 })}
              unit={c.finalUnit}
              units={CONC_UNITS}
              onUnit={(u) => setComp(i, { finalUnit: u })}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setComp(i, { source: "solido" })}
                className={chipClass(c.source === "solido")}
              >
                Sólido / puro
              </button>
              <button
                type="button"
                onClick={() =>
                  setComp(i, { source: "stock", stockUnit: c.stockUnit ?? c.finalUnit })
                }
                className={chipClass(c.source === "stock")}
              >
                Desde stock
              </button>
            </div>
            {c.source === "stock" && (
              <NumberWithUnit
                label="Concentración del stock"
                value={c.stock ?? null}
                onChange={(v) => setComp(i, { stock: v })}
                unit={(c.stockUnit ?? c.finalUnit) as ConcUnit}
                units={CONC_UNITS}
                onUnit={(u) => setComp(i, { stockUnit: u })}
              />
            )}
          </li>
        ))}
      </ol>
      <Button
        variant="outline"
        className="h-12"
        onClick={() => set({ components: [...draft.components, blank()] })}
      >
        <Plus className="size-4" aria-hidden />
        Componente
      </Button>

      <Result>
        {result && valid.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">
              Para {fmt(draft.volume!)} {draft.volumeUnit}
              {draft.ph != null && `, pH ${draft.ph}`}:
            </p>
            <ul className="flex flex-col gap-1">
              {result.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{l.name}</span>
                  {l.error ? (
                    <span className="text-right text-sm text-destructive">{l.error}</span>
                  ) : (
                    <span className="font-semibold tabular-nums">
                      {l.grams != null
                        ? `pesa ${fmtMass(l.grams)}`
                        : `mide ${fmtVolume(l.liters ?? 0)}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {result.overfilled ? (
              <p className="text-sm text-destructive">
                Los líquidos suman más que el volumen final.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Disuelve en ~80 % del volumen
                {draft.ph != null ? `, ajusta el pH a ${draft.ph}` : ""} y afora a{" "}
                {fmt(draft.volume!)} {draft.volumeUnit} (≈ {fmtVolume(result.fillLiters)} de agua).
              </p>
            )}
          </div>
        )}
      </Result>

      <div className="flex flex-col gap-1">
        <Label htmlFor="receta-instr">Instrucciones</Label>
        <Textarea
          id="receta-instr"
          value={draft.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
          className="min-h-20 text-base"
        />
      </div>

      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-12"
          onClick={() => {
            setDraft(emptyDraft());
            setAiNotes(null);
          }}
        >
          Nueva
        </Button>
        <Button
          className="h-12"
          disabled={save.isPending || !draft.name.trim() || !draft.volume || valid.length === 0}
          onClick={() =>
            save.mutate(
              {
                id: draft.id,
                name: draft.name.trim(),
                final_volume_ml: (draft.volume! * VOLUME[draft.volumeUnit]) / VOLUME.mL,
                components: valid,
                ph: draft.ph,
                instructions: draft.instructions.trim() || null,
              },
              { onSuccess: (id) => set({ id }) },
            )
          }
        >
          <BookmarkPlus className="size-4" aria-hidden />
          {draft.id ? "Guardar cambios" : "Guardar receta"}
        </Button>
      </div>

      <section aria-labelledby="mis-soluciones" className="flex flex-col gap-2">
        <h2 id="mis-soluciones" className="font-heading text-lg font-semibold">
          Mis soluciones
        </h2>
        {!recipes.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Las recetas que guardes aparecen aquí para volver a prepararlas en cualquier volumen.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recipes.data.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl border bg-card p-1 pl-3">
                <button
                  type="button"
                  onClick={() => load(r)}
                  className="flex min-h-12 min-w-0 flex-1 flex-col justify-center text-left"
                >
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.components.length} componentes · {fmt(Number(r.final_volume_ml))} mL
                    {r.ph != null ? ` · pH ${r.ph}` : ""}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-12"
                  aria-label={`Borrar ${r.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(r.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
