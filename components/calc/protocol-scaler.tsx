"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  Camera,
  Check,
  FileText,
  HelpCircle,
  ImagePlus,
  Loader2,
  ScanText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReadRecipeOutput } from "@/lib/ai/recipe-read";
import { scaleSolution, toRecipeComponents, type ReadSolution } from "@/lib/chem/scale";
import { fmt, toLiters, VOLUME, type VolumeUnit } from "@/lib/chem/units";
import { useReadRecipe, useSaveRecipe, useSolutionQuestion } from "@/lib/queries/solutions";
import { NumberWithUnit, Result, tryCalc } from "./calc-inputs";

const VOLUMES = Object.keys(VOLUME) as VolumeUnit[];
const MAX_FILES = 8;

/**
 * Calculadora desde un protocolo: la IA lee las soluciones (foto, PDF o texto) y la app calcula
 * cuánto usar de cada componente para el volumen que quieres, mostrando el procedimiento.
 */
export function ProtocolScaler() {
  const read = useReadRecipe();
  const [items, setItems] = useState<{ file: File; url: string }[]>([]);
  const [text, setText] = useState("");
  const urls = useRef<string[]>([]);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const add = (input: HTMLInputElement) => {
    const added = Array.from(input.files ?? [])
      .slice(0, MAX_FILES - items.length)
      .map((file) => ({
        file,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      }));
    urls.current.push(...added.map((a) => a.url).filter(Boolean));
    setItems((prev) => [...prev, ...added]);
    input.value = "";
  };

  const ready = items.length > 0 || text.trim().length > 10;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Cámara", icon: Camera, ref: camera },
            { label: "Fotos", icon: ImagePlus, ref: gallery },
            { label: "PDF", icon: FileText, ref: pdf },
          ].map(({ label, icon: Icon, ref }) => (
            <button
              key={label}
              type="button"
              disabled={read.isPending || items.length >= MAX_FILES}
              onClick={() => ref.current?.click()}
              className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border bg-card text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => add(e.currentTarget)}
        />
        <input
          ref={gallery}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => add(e.currentTarget)}
        />
        <input
          ref={pdf}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => add(e.currentTarget)}
        />
        {items.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {items.map((it, i) => (
              <li key={i} className="relative size-20 overflow-hidden rounded-lg border bg-muted">
                {it.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt={`Página ${i + 1}`} className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <FileText className="size-6" aria-hidden />
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Quitar ${i + 1}`}
                  onClick={() => {
                    if (it.url) URL.revokeObjectURL(it.url);
                    setItems(items.filter((_, j) => j !== i));
                  }}
                  className="absolute top-0.5 right-0.5 flex size-8 items-center justify-center rounded-full bg-background/90"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…o pega aquí la receta: «Para 100 mL: NaCl 0.8 g, KCl 20 mg…»"
          aria-label="Texto del protocolo o receta"
          className="min-h-20 text-base"
        />
        {read.error && (
          <p role="alert" className="text-sm text-destructive">
            {read.error.message}
          </p>
        )}
        <Button
          className="h-12"
          disabled={!ready || read.isPending}
          onClick={() => read.mutate({ files: items.map((i) => i.file), text })}
        >
          {read.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ScanText className="size-4" aria-hidden />
          )}
          {read.isPending ? "Leyendo el protocolo…" : "Leer soluciones del protocolo"}
        </Button>
      </section>

      {read.data && (
        <>
          {read.data.solutions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No encontré soluciones con cantidades en este protocolo.
            </p>
          )}
          {read.data.general_notes && (
            <p className="flex gap-2 rounded-lg bg-amber-500/10 p-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              {read.data.general_notes}
            </p>
          )}
          {read.data.solutions.map((s, i) => (
            <SolutionCard key={`${s.name}-${i}`} solution={s as ReadSolution} />
          ))}
        </>
      )}

      <QuestionBox recipe={read.data ?? null} />
    </div>
  );
}

function SolutionCard({ solution }: { solution: ReadSolution }) {
  const save = useSaveRecipe();
  const [origVol, setOrigVol] = useState<number | null>(solution.original_volume);
  const [origUnit, setOrigUnit] = useState<VolumeUnit>(solution.original_volume_unit ?? "mL");
  const [target, setTarget] = useState<number | null>(solution.original_volume);
  const [targetUnit, setTargetUnit] = useState<VolumeUnit>(solution.original_volume_unit ?? "mL");
  const [saved, setSaved] = useState<string | null>(null);

  const s: ReadSolution = {
    ...solution,
    original_volume: origVol,
    original_volume_unit: origVol ? origUnit : null,
  };
  const r = target ? tryCalc(() => scaleSolution(s, target, targetUnit)) : null;

  const saveRecipe = () => {
    const { components, skipped } = toRecipeComponents(s);
    if (!origVol) return;
    save.mutate(
      {
        name: solution.name,
        final_volume_ml: toLiters(origVol, origUnit) * 1000,
        components,
        ph: null,
        instructions: [solution.instructions, solution.notes].filter(Boolean).join("\n") || null,
      },
      {
        onSuccess: () =>
          setSaved(
            skipped.length
              ? `Guardada en Mis soluciones (sin: ${skipped.join(", ")}).`
              : "Guardada en Mis soluciones.",
          ),
      },
    );
  };

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 className="font-heading text-lg font-semibold">{solution.name}</h3>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Lo que dice el protocolo</summary>
        <ul className="mt-2 list-disc pl-5">
          {solution.components.map((c, i) => (
            <li key={i}>
              {c.name}: {c.as_written || "—"}
            </li>
          ))}
        </ul>
        {solution.instructions && (
          <p className="mt-2 whitespace-pre-line">{solution.instructions}</p>
        )}
      </details>
      {solution.notes && (
        <p className="flex gap-2 rounded-lg bg-amber-500/10 p-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          {solution.notes}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberWithUnit
          label="Volumen del protocolo"
          value={origVol}
          onChange={setOrigVol}
          unit={origUnit}
          units={VOLUMES}
          onUnit={setOrigUnit}
        />
        <NumberWithUnit
          label="Quiero preparar"
          value={target}
          onChange={setTarget}
          unit={targetUnit}
          units={VOLUMES}
          onUnit={setTargetUnit}
        />
      </div>

      <Result error={r?.error}>
        {r?.value && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{r.value.explanation}</p>
            <ul className="flex flex-col gap-2">
              {r.value.lines.map((l, i) => (
                <li key={i} className="flex flex-col">
                  <span className="flex justify-between gap-2">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-right font-semibold tabular-nums">{l.scaled ?? "—"}</span>
                  </span>
                  {l.math && !l.solvent && (
                    <span className="font-mono text-xs text-muted-foreground">{l.math}</span>
                  )}
                  {l.note && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">{l.note}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Factor ×{fmt(r.value.factor)}. Verifica con tu protocolo antes de preparar.
            </p>
          </div>
        )}
      </Result>

      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
      {saved ? (
        <p
          role="status"
          className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <Check className="size-4" aria-hidden />
          {saved}
        </p>
      ) : (
        <Button
          variant="outline"
          className="h-12"
          disabled={save.isPending || !origVol}
          onClick={saveRecipe}
        >
          <BookmarkPlus className="size-4" aria-hidden />
          Guardar en Mis soluciones
        </Button>
      )}
    </article>
  );
}

/** Resumen de la receta leída, para que la respuesta a una duda se base en ella. */
function recipeContext(r: ReadRecipeOutput | null) {
  if (!r?.solutions.length) return undefined;
  return r.solutions
    .map(
      (s) =>
        `${s.name} (${s.original_volume ?? "?"} ${s.original_volume_unit ?? ""}): ` +
        s.components.map((c) => `${c.name} ${c.as_written}`).join("; "),
    )
    .join("\n");
}

function QuestionBox({ recipe }: { recipe: ReadRecipeOutput | null }) {
  const ask = useSolutionQuestion();
  const [question, setQuestion] = useState("");

  return (
    <section
      aria-labelledby="duda"
      className="flex flex-col gap-3 rounded-xl border-2 border-primary/30 bg-card p-4"
    >
      <Label id="duda" htmlFor="duda-texto" className="flex items-center gap-2 text-base">
        <HelpCircle className="size-5" aria-hidden />
        ¿Tienes una duda?
      </Label>
      <Textarea
        id="duda-texto"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={
          recipe
            ? "Ej. ¿Cómo preparo solo 25 mL? ¿Puedo usar Na2HPO4·7H2O en lugar del anhidro?"
            : "Ej. ¿Cuánto Tris base peso para 500 mL de Tris-HCl 50 mM pH 7.4?"
        }
        className="min-h-20 text-base"
      />
      {recipe && (
        <p className="text-xs text-muted-foreground">
          La respuesta usa el protocolo que leíste arriba.
        </p>
      )}
      <Button
        className="h-12"
        disabled={ask.isPending || question.trim().length < 3}
        onClick={() => ask.mutate({ question: question.trim(), context: recipeContext(recipe) })}
      >
        {ask.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <HelpCircle className="size-4" aria-hidden />
        )}
        {ask.isPending ? "Pensando…" : "Preguntar"}
      </Button>
      {ask.error && <p className="text-sm text-destructive">{ask.error.message}</p>}
      {ask.data && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-lg font-semibold">{ask.data.answer}</p>
          {ask.data.steps.length > 0 && (
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
              {ask.data.steps.map((st, i) => (
                <li key={i}>{st}</li>
              ))}
            </ol>
          )}
          {ask.data.suggested_tool && (
            <Link
              href={`/calculadora?herramienta=${ask.data.suggested_tool}`}
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Comprobarlo en la calculadora →
            </Link>
          )}
          <p className="text-xs text-muted-foreground">
            Respuesta de IA: verifica las cantidades con la calculadora y tu protocolo.
          </p>
        </div>
      )}
    </section>
  );
}
