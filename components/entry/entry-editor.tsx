"use client";

import { useQueryClient } from "@tanstack/react-query";
import { use, useCallback, useState } from "react";
import { AlertCircle, Check, CloudUpload, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMMON_TEXT_FIELDS, type CommonTextKey } from "@/lib/entries/common";
import { useAutosave, type AutosaveStatus } from "@/lib/hooks/use-autosave";
import {
  entryKeys,
  saveEntryDraft,
  useEntry,
  useSetEntryStatus,
  type Entry,
  type EntryDraft,
} from "@/lib/queries/entries";
import { useTemplateVersion, type TemplateWithFields } from "@/lib/queries/templates";
import { validateEntryData, type EntryData } from "@/lib/templates/values";
import { DynamicForm } from "./dynamic-form";
import { EntryHeader } from "./entry-header";
import { EntryReadView } from "./entry-read-view";
import { DateTimeInput, fieldInputClass } from "./fields/inputs";
import { VoidEntry } from "./void-entry";

export function EntryEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const entry = useEntry(id);
  const template = useTemplateVersion(entry.data?.template_id, entry.data?.template_version);

  if (entry.isPending || (entry.data && template.isPending)) return <EntrySkeleton />;
  const error = entry.error ?? template.error;
  if (error) {
    return (
      <p className="text-sm text-destructive">No se pudo cargar la entrada: {error.message}</p>
    );
  }
  if (!entry.data || !template.data) return <p>Esta entrada no existe.</p>;

  if (entry.data.status === "borrador") {
    return <DraftEditor key={entry.data.id} entry={entry.data} template={template.data} />;
  }
  return <EntryReadView entry={entry.data} template={template.data} />;
}

export function EntrySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function toDraft(entry: Entry): EntryDraft {
  return {
    title: entry.title,
    objective: entry.objective,
    observations: entry.observations,
    results: entry.results,
    next_steps: entry.next_steps,
    data_location: entry.data_location,
    started_at: entry.started_at,
    ended_at: entry.ended_at,
    data: (entry.data ?? {}) as EntryData,
  };
}

function DraftEditor({ entry, template }: { entry: Entry; template: TemplateWithFields }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => toDraft(entry));
  const [triedToClose, setTriedToClose] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const setStatus = useSetEntryStatus(entry.id);

  const autosave = useAutosave(
    useCallback(
      async (value: EntryDraft) => {
        const saved = await saveEntryDraft(entry.id, value);
        queryClient.setQueryData(entryKeys.detail(entry.id), saved);
        void queryClient.invalidateQueries({ queryKey: ["entries", "day"] });
      },
      [entry.id, queryClient],
    ),
  );

  const update = (patch: Partial<EntryDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    autosave.schedule(next);
  };

  const closeErrors: Record<string, string> = {
    ...validateEntryData(template.fields, draft.data, "cierre"),
    ...(draft.title.trim() === "" ? { title: "Escribe un título." } : {}),
  };
  const errors = triedToClose ? closeErrors : {};
  const errorCount = Object.keys(errors).length;

  const askToClose = () => {
    setTriedToClose(true);
    if (Object.keys(closeErrors).length > 0) {
      setConfirmClose(false);
      requestAnimationFrame(() =>
        document.querySelector('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
      return;
    }
    setConfirmClose(true);
  };

  const close = async () => {
    try {
      await autosave.flush();
    } catch {
      return; // el indicador de guardado ya muestra el error
    }
    setStatus.mutate({ status: "cerrada" });
  };

  const voidEntry = async (reason: string) => {
    try {
      await autosave.flush();
    } catch {
      return;
    }
    setStatus.mutate({ status: "anulada", voidReason: reason });
  };

  return (
    <div className="flex flex-col gap-6">
      <EntryHeader
        entry={entry}
        template={template}
        aside={
          <SaveIndicator
            status={autosave.status}
            onRetry={() => void autosave.flush().catch(() => {})}
          />
        }
      />
      {autosave.status === "error" && autosave.error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No se pudo guardar: {autosave.error.message}. Tus cambios siguen aquí; toca “Reintentar”.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="entry-title" className="text-base">
          Título<span className="text-destructive">*</span>
        </Label>
        <Input
          id="entry-title"
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          aria-invalid={Boolean(errors.title) || undefined}
          className="h-12 text-lg font-medium"
        />
        {errors.title && (
          <p role="alert" className="text-sm text-destructive">
            {errors.title}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="entry-start" className="text-base">
            Inicio
          </Label>
          <DateTimeInput
            id="entry-start"
            value={draft.started_at}
            onChange={(v) => update({ started_at: v })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="entry-end" className="text-base">
            Fin
          </Label>
          <DateTimeInput
            id="entry-end"
            value={draft.ended_at}
            onChange={(v) => update({ ended_at: v })}
          />
        </div>
      </div>

      <CommonField
        k="objective"
        value={draft.objective}
        onChange={(v) => update({ objective: v })}
      />

      {template.fields.length > 0 && (
        <section aria-labelledby="campos-plantilla" className="flex flex-col gap-4">
          <h2 id="campos-plantilla" className="border-b pb-2 font-heading text-lg font-semibold">
            {template.name}
          </h2>
          <DynamicForm
            fields={template.fields}
            value={draft.data}
            onChange={(data) => update({ data })}
            errors={errors}
          />
        </section>
      )}

      <section aria-labelledby="cierre-dia" className="flex flex-col gap-4">
        <h2 id="cierre-dia" className="border-b pb-2 font-heading text-lg font-semibold">
          Resultados
        </h2>
        {(["observations", "results", "next_steps", "data_location"] as const).map((k) => (
          <CommonField key={k} k={k} value={draft[k]} onChange={(v) => update({ [k]: v })} />
        ))}
      </section>

      <div className="flex flex-col gap-3 border-t pt-6">
        {triedToClose && errorCount > 0 && (
          <p role="alert" className="text-sm text-destructive">
            Para cerrar, completa{" "}
            {errorCount === 1 ? "el campo marcado" : `los ${errorCount} campos marcados`}.
          </p>
        )}
        {confirmClose ? (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <p className="text-sm">
              Al cerrar la entrada ya no se podrá editar; solo podrás agregarle adendas.
            </p>
            {setStatus.error && (
              <p role="alert" className="text-sm text-destructive">
                {setStatus.error.message}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12" onClick={() => setConfirmClose(false)}>
                Cancelar
              </Button>
              <Button className="h-12" disabled={setStatus.isPending} onClick={close}>
                <Lock className="size-4" aria-hidden />
                {setStatus.isPending ? "Cerrando…" : "Cerrar"}
              </Button>
            </div>
          </div>
        ) : (
          <Button className="h-14 text-base" onClick={askToClose}>
            <Lock className="size-5" aria-hidden />
            Cerrar entrada
          </Button>
        )}
        <VoidEntry onConfirm={voidEntry} pending={setStatus.isPending} error={setStatus.error} />
      </div>
    </div>
  );
}

function CommonField({
  k,
  value,
  onChange,
}: {
  k: CommonTextKey;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const def = COMMON_TEXT_FIELDS.find((f) => f.key === k)!;
  const id = `entry-${k}`;
  const props = {
    id,
    value: value ?? "",
    onChange: (e: { target: { value: string } }) => onChange(e.target.value || null),
  };
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">
        {def.label}
      </Label>
      {def.multiline ? (
        <Textarea {...props} className="min-h-24 text-base" />
      ) : (
        <Input
          {...props}
          placeholder="Ej. Disco/Tesis/2026-10-07_IBA1/"
          className={`${fieldInputClass} font-mono`}
        />
      )}
    </div>
  );
}

function SaveIndicator({ status, onRetry }: { status: AutosaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <Button variant="destructive" className="h-10" onClick={onRetry}>
        <AlertCircle className="size-4" aria-hidden />
        Reintentar
      </Button>
    );
  }
  const content = {
    idle: null,
    pending: (
      <>
        <CloudUpload className="size-4" aria-hidden /> Sin guardar
      </>
    ),
    saving: (
      <>
        <Loader2 className="size-4 animate-spin" aria-hidden /> Guardando…
      </>
    ),
    saved: (
      <>
        <Check className="size-4" aria-hidden /> Guardado
      </>
    ),
  }[status];
  return (
    <span role="status" className="flex items-center gap-1 text-sm text-muted-foreground">
      {content}
    </span>
  );
}
