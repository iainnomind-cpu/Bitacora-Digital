"use client";

import { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { chipClass, fieldInputClass } from "@/components/entry/fields/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDays, MAX_OCCURRENCES, occurrenceDays, type Repeat } from "@/lib/calendar/dates";
import { formatEntryDate } from "@/lib/datetime";
import { useTimeZone } from "@/lib/queries/profile";
import { useActiveProject, useProjects } from "@/lib/queries/projects";
import { useSampleTypes } from "@/lib/queries/sample-types";
import { useSamples } from "@/lib/queries/samples";
import { useCreateTask } from "@/lib/queries/tasks";
import { useTemplates } from "@/lib/queries/templates";
import { cn } from "@/lib/utils";

const selectClass =
  "h-12 w-full rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30";
const REMINDERS = [
  { label: "Sin aviso", value: null },
  { label: "A la hora", value: 0 },
  { label: "15 min antes", value: 15 },
  { label: "1 h antes", value: 60 },
  { label: "1 día antes", value: 24 * 60 },
] as const;
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** Programar una tarea en el calendario (con repetición y aviso por notificación). */
export function TaskForm({ day, onDone }: { day: string; onDone: () => void }) {
  const timeZone = useTimeZone();
  const templates = useTemplates();
  const projects = useProjects();
  const active = useActiveProject();
  const create = useCreateTask();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(day);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState<string>("");
  const [templateId, setTemplateId] = useState("");
  const [projectId, setProjectId] = useState(active.id ?? "");
  const [samples, setSamples] = useState<string[]>([]);
  const [remind, setRemind] = useState<number | null>(15);
  const [repeatKind, setRepeatKind] = useState<Repeat["kind"]>("no");
  const [every, setEvery] = useState("2");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState(addDays(day, 27));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const repeat: Repeat =
    repeatKind === "no"
      ? { kind: "no" }
      : repeatKind === "cada_dias"
        ? { kind: "cada_dias", every: Math.max(1, Number(every) || 1), until }
        : { kind: "semanal", weekdays, until };
  const count = occurrenceDays(date, repeat).length;
  const template = templates.data?.find((t) => t.id === templateId);

  const submit = () => {
    setError(null);
    const finalTitle = title.trim() || template?.name || "";
    if (!finalTitle) return setError("Escribe qué vas a hacer o elige una plantilla.");
    create.mutate(
      {
        title: finalTitle,
        notes: notes.trim() || null,
        template_id: templateId || null,
        project_id: projectId || null,
        sample_codes: samples,
        day: date,
        time,
        duration_minutes: Number(duration) > 0 ? Math.round(Number(duration)) : null,
        remind_before: remind,
        repeat,
        timeZone,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-card p-4">
      <h3 className="font-heading text-lg font-semibold">Programar tarea</h3>
      <div className="flex flex-col gap-1">
        <Label htmlFor="tarea-titulo">Qué vas a hacer</Label>
        <Input
          id="tarea-titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={template?.name ?? "Ej. Corte fino del bloque B-014-A"}
          className={fieldInputClass}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="tarea-dia">Día</Label>
          <Input
            id="tarea-dia"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={fieldInputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tarea-hora">Hora</Label>
          <Input
            id="tarea-hora"
            type="time"
            value={time}
            onChange={(e) => e.target.value && setTime(e.target.value)}
            className={fieldInputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="tarea-plantilla">Plantilla</Label>
          <select
            id="tarea-plantilla"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className={selectClass}
          >
            <option value="">Ninguna</option>
            {templates.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tarea-duracion">Duración (min)</Label>
          <Input
            id="tarea-duracion"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
            placeholder="Opcional"
            className={fieldInputClass}
          />
        </div>
      </div>
      {projects.data && projects.data.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="tarea-proyecto">Proyecto</Label>
          <select
            id="tarea-proyecto"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={selectClass}
          >
            <option value="">Sin proyecto</option>
            {projects.data
              .filter((p) => p.status === "activo")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      )}
      <SampleChooser value={samples} onChange={setSamples} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Aviso</legend>
        <div className="flex flex-wrap gap-2">
          {REMINDERS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRemind(r.value)}
              className={chipClass(remind === r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Repetir</legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["no", "No"],
              ["cada_dias", "Cada N días"],
              ["semanal", "Semanal"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRepeatKind(k)}
              className={chipClass(repeatKind === k)}
            >
              {l}
            </button>
          ))}
        </div>
        {repeatKind === "cada_dias" && (
          <div className="flex items-center gap-2 text-sm">
            Cada
            <Input
              inputMode="numeric"
              value={every}
              onChange={(e) => setEvery(e.target.value.replace(/\D/g, ""))}
              aria-label="Cada cuántos días"
              className="h-12 w-20 text-center text-base"
            />
            días
          </div>
        )}
        {repeatKind === "semanal" && (
          <div className="grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
            {WEEKDAYS.map((l, i) => {
              const n = i + 1;
              const on = weekdays.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setWeekdays(on ? weekdays.filter((d) => d !== n) : [...weekdays, n])
                  }
                  className={cn(
                    "flex h-12 items-center justify-center rounded-xl border text-sm font-medium",
                    on && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {l}
                </button>
              );
            })}
          </div>
        )}
        {repeatKind !== "no" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="tarea-hasta">Hasta</Label>
            <Input
              id="tarea-hasta"
              type="date"
              value={until}
              min={date}
              onChange={(e) => e.target.value && setUntil(e.target.value)}
              className={fieldInputClass}
            />
            <p className="text-xs text-muted-foreground">
              {count} {count === 1 ? "vez" : "veces"} · {formatEntryDate(date)} a{" "}
              {formatEntryDate(until)}
              {count >= MAX_OCCURRENCES && ` (máximo ${MAX_OCCURRENCES})`}
            </p>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <Label htmlFor="tarea-notas">Notas / objetivo</Label>
        <Textarea
          id="tarea-notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-16 text-base"
        />
      </div>

      {(error || create.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? create.error?.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" onClick={onDone}>
          Cancelar
        </Button>
        <Button className="h-12" disabled={create.isPending} onClick={submit}>
          {create.isPending ? "Guardando…" : count > 1 ? `Programar ${count}` : "Programar"}
        </Button>
      </div>
    </div>
  );
}

/** Elegir muestras de cualquier tipo (búsqueda + casillas). */
function SampleChooser({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const samples = useSamples();
  const types = useSampleTypes();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = (samples.data ?? [])
    .filter(
      (s) =>
        s.status === "activa" &&
        (!q.trim() || s.code.toLowerCase().includes(q.trim().toLowerCase())),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 40);

  if (!samples.data?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Muestras</span>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((c) => (
            <li
              key={c}
              className="flex h-10 items-center gap-1 rounded-lg border bg-background pr-1 pl-2.5 font-mono text-sm"
            >
              {c}
              <button
                type="button"
                aria-label={`Quitar ${c}`}
                onClick={() => onChange(value.filter((x) => x !== c))}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-12 justify-start gap-2"
        onClick={() => setOpen(!open)}
      >
        <Search className="size-4" aria-hidden />
        {open ? "Ocultar muestras" : "Elegir muestras"}
      </Button>
      {open && (
        <div className="flex flex-col gap-1.5">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar código"
            aria-label="Buscar muestra"
            className="h-12 font-mono text-base"
          />
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {list.map((s) => {
              const on = value.includes(s.code);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(on ? value.filter((c) => c !== s.code) : [...value, s.code])
                    }
                    className={cn(
                      "flex min-h-12 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm",
                      on ? "border-primary bg-primary/5" : "bg-background",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded border-2",
                        on && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {on && <Check className="size-3.5" aria-hidden />}
                    </span>
                    <span className="font-mono">{s.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {types.labelOf(s.sample_type)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
