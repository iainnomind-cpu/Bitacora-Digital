"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatEntryDate, formatTime } from "@/lib/datetime";
import { COMMON_TEXT_FIELDS } from "@/lib/entries/common";
import { useTimeZone } from "@/lib/queries/profile";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/templates/duration";
import { parseFields } from "@/lib/templates/fields";
import { formatFieldValue } from "@/lib/templates/format";

const STATUS: Record<string, string> = {
  borrador: "Borrador",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

/**
 * Versión para imprimir / guardar en PDF (§6.2 "Exportar a PDF"): una entrada (`?entrada=`), o
 * las de un rango (`?desde=&hasta=`, con la revisión semanal si `semana=1`).
 */
export function PrintView() {
  const params = useSearchParams();
  const router = useRouter();
  const timeZone = useTimeZone();
  const entryId = params.get("entrada");
  const from = params.get("desde");
  const to = params.get("hasta");
  const withWeek = params.get("semana") === "1";

  const doc = useQuery({
    queryKey: ["imprimir", entryId, from, to, withWeek],
    queryFn: async () => {
      const db = createClient();
      let q = db.from("entries").select("*").neq("status", "anulada");
      if (entryId) q = db.from("entries").select("*").eq("id", entryId);
      else if (from && to) q = q.gte("entry_date", from).lte("entry_date", to);
      else throw new Error("Falta qué imprimir.");
      const { data: entries, error } = await q
        .order("entry_date")
        .order("started_at", { nullsFirst: false });
      if (error) throw error;
      const ids = entries.map((e) => e.id);
      const tids = [...new Set(entries.map((e) => e.template_id))];
      const [templates, versions, attachments, addenda, links, profile, review] = await Promise.all(
        [
          db.from("templates").select("id, name").in("id", tids),
          db
            .from("template_versions")
            .select("template_id, version, fields")
            .in("template_id", tids),
          db.from("attachments").select("*").in("entry_id", ids).order("captured_at"),
          db.from("entry_addenda").select("*").in("entry_id", ids).order("created_at"),
          db.from("entry_samples").select("entry_id, role, sample_id").in("entry_id", ids),
          db.from("profiles").select("display_name, lab_name").maybeSingle(),
          withWeek && from
            ? db
                .from("weekly_reviews")
                .select("summary, notes")
                .eq("week_start", from)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ],
      );
      const sampleIds = [...new Set((links.data ?? []).map((l) => l.sample_id))];
      const audioIds = (attachments.data ?? []).filter((a) => a.kind === "audio").map((a) => a.id);
      const photoPaths = (attachments.data ?? [])
        .filter((a) => a.kind === "foto" && a.storage_path)
        .map((a) => a.storage_path!);
      const [samples, transcripts, urls] = await Promise.all([
        sampleIds.length
          ? db.from("samples").select("id, code").in("id", sampleIds)
          : Promise.resolve({ data: [] as { id: string; code: string }[] }),
        audioIds.length
          ? db
              .from("transcriptions")
              .select("attachment_id, text, created_at")
              .in("attachment_id", audioIds)
              .eq("status", "lista")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as { attachment_id: string; text: string | null }[] }),
        photoPaths.length
          ? db.storage.from("attachments").createSignedUrls(photoPaths, 3600)
          : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
      ]);
      return {
        entries,
        templateName: new Map((templates.data ?? []).map((t) => [t.id, t.name])),
        versions: versions.data ?? [],
        attachments: attachments.data ?? [],
        addenda: addenda.data ?? [],
        links: links.data ?? [],
        sampleCode: new Map((samples.data ?? []).map((s) => [s.id, s.code])),
        transcript: new Map((transcripts.data ?? []).map((t) => [t.attachment_id, t.text])),
        photoUrl: new Map((urls.data ?? []).map((u) => [u.path ?? "", u.signedUrl])),
        profile: profile.data,
        review: review.data,
      };
    },
  });

  if (doc.isPending) return <p className="p-6 text-muted-foreground">Preparando el documento…</p>;
  if (doc.error) return <p className="p-6 text-destructive">{doc.error.message}</p>;
  const d = doc.data;
  const period = entryId
    ? null
    : from === to
      ? formatEntryDate(from!)
      : `${formatEntryDate(from!)} – ${formatEntryDate(to!)}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" className="h-12 gap-1" onClick={() => router.back()}>
          <ChevronLeft className="size-5" aria-hidden />
          Volver
        </Button>
        <Button className="h-12" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Imprimir / Guardar PDF
        </Button>
      </div>

      <header className="mb-6 border-b pb-3">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          Bitácora de laboratorio
        </p>
        <h1 className="text-2xl font-semibold">
          {entryId ? d.entries[0]?.title || "Entrada" : `Registro ${period}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {[d.profile?.display_name, d.profile?.lab_name].filter(Boolean).join(" · ")}
          {` · Generado ${formatDateTime(new Date().toISOString(), timeZone)}`}
        </p>
      </header>

      {d.review?.summary && (
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-2 text-lg font-semibold">Revisión semanal</h2>
          <p className="text-sm whitespace-pre-line">{d.review.summary}</p>
          {d.review.notes && (
            <p className="mt-2 text-sm whitespace-pre-line">
              <strong>Notas:</strong> {d.review.notes}
            </p>
          )}
        </section>
      )}

      {d.entries.length === 0 && (
        <p className="text-muted-foreground">No hay entradas en este periodo.</p>
      )}

      {d.entries.map((e) => {
        const v = d.versions.find(
          (x) => x.template_id === e.template_id && x.version === e.template_version,
        );
        const fields = v ? parseFields(v.fields) : [];
        const data = (e.data ?? {}) as Record<string, unknown>;
        const atts = d.attachments.filter((a) => a.entry_id === e.id);
        const adds = d.addenda.filter((a) => a.entry_id === e.id);
        const used = d.links.filter((l) => l.entry_id === e.id);
        return (
          <article
            key={e.id}
            className="mb-8 border-b pb-6 last:border-b-0 print:break-inside-auto"
          >
            <header className="mb-3">
              <h2 className="text-lg font-semibold">
                {e.title || d.templateName.get(e.template_id)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatEntryDate(e.entry_date)} · {formatTime(e.started_at, timeZone)}–
                {formatTime(e.ended_at, timeZone)} · {d.templateName.get(e.template_id)} v
                {e.template_version} · {STATUS[e.status] ?? e.status}
                {e.closed_at && ` el ${formatDateTime(e.closed_at, timeZone)}`}
              </p>
              {e.status === "anulada" && <p className="text-sm">Anulada: {e.void_reason}</p>}
            </header>
            <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
              {e.objective && (
                <>
                  <dt className="text-muted-foreground">Objetivo</dt>
                  <dd className="whitespace-pre-line">{e.objective}</dd>
                </>
              )}
              {fields.map((f) => {
                const val = formatFieldValue(f, data[f.key], timeZone);
                if (val === "—") return null;
                return (
                  <div key={f.key} className="contents">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="whitespace-pre-line">{val}</dd>
                  </div>
                );
              })}
              {COMMON_TEXT_FIELDS.filter((c) => c.key !== "objective" && e[c.key]).map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd className="whitespace-pre-line">{e[c.key]}</dd>
                </div>
              ))}
              {used.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Muestras</dt>
                  <dd className="font-mono">
                    {used
                      .map((l) => `${d.sampleCode.get(l.sample_id) ?? "?"} (${l.role})`)
                      .join(", ")}
                  </dd>
                </>
              )}
            </dl>

            {atts.length > 0 && (
              <section className="mt-3">
                <h3 className="mb-1 text-sm font-semibold">Adjuntos</h3>
                <div className="grid grid-cols-3 gap-2">
                  {atts
                    .filter((a) => a.kind === "foto")
                    .map((a) => (
                      <figure key={a.id} className="break-inside-avoid">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.photoUrl.get(a.storage_path ?? "") ?? undefined}
                          alt={a.caption ?? "Foto"}
                          className="aspect-square w-full rounded border object-cover"
                        />
                        <figcaption className="text-xs">
                          {formatTime(a.captured_at, timeZone)}{" "}
                          {a.caption ?? a.ai_description ?? ""}
                        </figcaption>
                      </figure>
                    ))}
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {atts
                    .filter((a) => a.kind !== "foto")
                    .map((a) => (
                      <li key={a.id}>
                        <span className="text-muted-foreground">
                          {formatTime(a.captured_at, timeZone)} ·{" "}
                          {a.kind === "audio"
                            ? `Audio ${formatDuration(Math.round(Number(a.duration_seconds ?? 0)))}`
                            : "Nota"}
                          :
                        </span>{" "}
                        {a.kind === "audio"
                          ? (d.transcript.get(a.id) ?? "(sin transcripción)")
                          : a.text_content}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {adds.length > 0 && (
              <section className="mt-3">
                <h3 className="mb-1 text-sm font-semibold">Adendas</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {adds.map((a) => (
                    <li key={a.id}>
                      <span className="text-muted-foreground">
                        {formatDateTime(a.created_at, timeZone)}:
                      </span>{" "}
                      {a.content}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        );
      })}
    </div>
  );
}
