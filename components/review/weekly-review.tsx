"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileDown, Loader2, Save, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDays, isoWeekday } from "@/lib/calendar/dates";
import { dateInTimeZone, formatEntryDate } from "@/lib/datetime";
import { useMounted } from "@/lib/hooks/use-mounted";
import { postJson } from "@/lib/queries/ai";
import { useTimeZone } from "@/lib/queries/profile";
import { zonedToUtc } from "@/lib/push/schedule";
import { useEntriesBetween, useTasksBetween } from "@/lib/queries/tasks";
import { useTemplates } from "@/lib/queries/templates";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Revisión semanal (§7.4, §9.11): lo de la semana en números y un resumen editable con IA. */
export function WeeklyReview() {
  const mounted = useMounted();
  const timeZone = useTimeZone();
  if (!mounted) return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  const today = dateInTimeZone(new Date(), timeZone);
  return <Review thisWeek={addDays(today, 1 - isoWeekday(today))} timeZone={timeZone} />;
}

function Review({ thisWeek, timeZone }: { thisWeek: string; timeZone: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const requested = params.get("semana");
  const week =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? addDays(requested, 1 - isoWeekday(requested))
      : thisWeek;
  const end = addDays(week, 6);
  const go = (w: string) => router.replace(`${pathname}?semana=${w}`, { scroll: false });

  const templates = useTemplates();
  const entries = useEntriesBetween(week, end);
  const tasks = useTasksBetween(
    zonedToUtc(week, "00:00", timeZone).toISOString(),
    zonedToUtc(end, "23:59", timeZone).toISOString(),
  );
  const samples = useQuery({
    queryKey: ["samples", "week", week],
    queryFn: async () => {
      const { count } = await createClient()
        .from("samples")
        .select("id", { count: "exact", head: true })
        .gte("created_at", zonedToUtc(week, "00:00", timeZone).toISOString())
        .lte("created_at", zonedToUtc(end, "23:59", timeZone).toISOString());
      return count ?? 0;
    },
  });
  const review = useQuery({
    queryKey: ["weekly_reviews", week],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("weekly_reviews")
        .select("*")
        .eq("week_start", week)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const generate = useMutation({
    mutationFn: () => postJson<{ summary: string }>("/api/ai/weekly-summary", { week_start: week }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weekly_reviews", week] }),
  });

  const byTemplate = new Map<string, number>();
  for (const e of entries.data ?? [])
    byTemplate.set(e.template_id, (byTemplate.get(e.template_id) ?? 0) + 1);
  const name = new Map(templates.data?.map((t) => [t.id, t.name]));
  const closed = (entries.data ?? []).filter((e) => e.status === "cerrada").length;
  const drafts = (entries.data ?? []).filter((e) => e.status === "borrador").length;
  const tasksDone = (tasks.data ?? []).filter((t) => t.status === "hecha").length;
  const tasksPending = (tasks.data ?? []).filter((t) => t.status === "pendiente").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label="Semana anterior"
          onClick={() => go(addDays(week, -7))}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <p className="text-center font-medium">
          {formatEntryDate(week)} – {formatEntryDate(end)}
          {week === thisWeek && (
            <span className="block text-xs text-muted-foreground">Esta semana</span>
          )}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label="Semana siguiente"
          disabled={week >= thisWeek}
          onClick={() => go(addDays(week, 7))}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Entradas", entries.data?.length ?? "…"],
          ["Cerradas", entries.data ? `${closed}${drafts ? ` · ${drafts} borr.` : ""}` : "…"],
          ["Muestras nuevas", samples.data ?? "…"],
          [
            "Tareas hechas",
            tasks.data ? `${tasksDone}${tasksPending ? ` · ${tasksPending} pend.` : ""}` : "…",
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {byTemplate.size > 0 && (
        <ul className="flex flex-wrap gap-2">
          {[...byTemplate]
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => (
              <li key={id} className="rounded-full bg-muted px-3 py-1 text-sm">
                {name.get(id) ?? "Plantilla"} · {n}
              </li>
            ))}
        </ul>
      )}

      <Button
        className="h-12"
        disabled={generate.isPending || entries.data?.length === 0}
        onClick={() => generate.mutate()}
      >
        {generate.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {generate.isPending
          ? "Escribiendo el resumen…"
          : review.data?.summary
            ? "Volver a generar con IA"
            : "Generar resumen con IA"}
      </Button>
      {generate.error && <p className="text-sm text-destructive">{generate.error.message}</p>}

      {review.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <ReviewEditor
          key={`${week}:${review.data?.updated_at ?? "nuevo"}`}
          week={week}
          summary={review.data?.summary ?? ""}
          notes={review.data?.notes ?? ""}
        />
      )}

      <Link
        href={`/imprimir?desde=${week}&hasta=${end}&semana=1`}
        className={cn(buttonVariants({ variant: "outline" }), "h-12 gap-2")}
      >
        <FileDown className="size-4" aria-hidden />
        Exportar la semana (PDF)
      </Link>
    </div>
  );
}

function ReviewEditor({ week, summary, notes }: { week: string; summary: string; notes: string }) {
  const queryClient = useQueryClient();
  const [s, setS] = useState(summary);
  const [n, setN] = useState(notes);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await createClient()
        .from("weekly_reviews")
        .upsert(
          { week_start: week, summary: s || null, notes: n || null },
          { onConflict: "user_id,week_start" },
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weekly_reviews", week] }),
  });
  const dirty = s !== summary || n !== notes;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="resumen">Resumen</Label>
        <Textarea
          id="resumen"
          value={s}
          onChange={(e) => setS(e.target.value)}
          placeholder="Genera el resumen con IA o escríbelo tú."
          className="min-h-56 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="notas-semana">Notas propias</Label>
        <Textarea
          id="notas-semana"
          value={n}
          onChange={(e) => setN(e.target.value)}
          placeholder="Ideas, acuerdos con tu asesor, lo que hay que comprar…"
          className="min-h-24 text-base"
        />
      </div>
      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
      <Button
        variant={dirty ? "default" : "outline"}
        className="h-12"
        disabled={!dirty || save.isPending}
        onClick={() => save.mutate()}
      >
        <Save className="size-4" aria-hidden />
        {save.isPending ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
      </Button>
    </div>
  );
}
