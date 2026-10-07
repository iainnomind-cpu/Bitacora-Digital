"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { DynamicForm } from "@/components/entry/dynamic-form";
import {
  chipClass,
  DurationInput,
  fieldInputClass,
  NumberInput,
} from "@/components/entry/fields/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSignedUrls } from "@/lib/queries/attachments";
import { useSampleTypes } from "@/lib/queries/sample-types";
import { useTemplates, type TemplateWithFields } from "@/lib/queries/templates";
import {
  changeFieldType,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  fieldKey,
  newField,
  type TemplateDraft,
} from "@/lib/templates/editor";
import { fieldsSchema, type FieldDef, type FieldType } from "@/lib/templates/fields";
import { initialValues, type EntryData } from "@/lib/templates/values";
import { cn } from "@/lib/utils";
import { TEMPLATE_COLORS, TEMPLATE_ICONS, TemplateIcon } from "./template-icon";

const selectClass =
  "h-12 w-full rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30";

/**
 * Editor de plantillas (§5): datos generales, campos (tipo, unidad, opciones, valor esperado
 * del protocolo), texto del protocolo y vista previa. Guardar una plantilla existente con
 * campos distintos crea una versión nueva.
 */
export function TemplateEditor({
  initial,
  existing,
  saving,
  error,
  onSave,
  notice,
}: {
  initial: TemplateDraft;
  existing?: TemplateWithFields;
  saving: boolean;
  error: Error | null;
  onSave: (draft: TemplateDraft) => void;
  notice?: React.ReactNode;
}) {
  const templates = useTemplates();
  const [draft, setDraft] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [newType, setNewType] = useState<FieldType>("text");
  const [preview, setPreview] = useState(false);
  const [previewData, setPreviewData] = useState<EntryData>({});
  const [problem, setProblem] = useState<string | null>(null);

  const set = (patch: Partial<TemplateDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setField = (i: number, f: FieldDef) =>
    set({ fields: draft.fields.map((x, j) => (j === i ? f : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.fields.length) return;
    const fields = [...draft.fields];
    [fields[i], fields[j]] = [fields[j], fields[i]];
    set({ fields });
  };
  const addField = () => {
    const label = `${FIELD_TYPE_LABELS[newType]} ${draft.fields.length + 1}`;
    const key = fieldKey(
      label,
      draft.fields.map((f) => f.key),
    );
    set({ fields: [...draft.fields, newField(newType, label, key)] });
    setOpen(key);
  };

  const activities = [...new Set((templates.data ?? []).map((t) => t.activity_type))].sort();
  const keysInUse = new Set((existing?.fields ?? []).map((f) => f.key));

  const save = () => {
    setProblem(null);
    if (!draft.name.trim()) return setProblem("Escribe el nombre de la plantilla.");
    const parsed = fieldsSchema.safeParse(draft.fields);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const f = draft.fields[Number(issue.path[0])];
      return setProblem(`Revisa el campo «${f?.label ?? "?"}»: ${issue.message}`);
    }
    if (draft.fields.some((f) => !f.label.trim()))
      return setProblem("Todos los campos necesitan nombre.");
    // Claves legibles a partir del nombre para los campos nuevos; las que ya tienen datos no cambian.
    const taken: string[] = [];
    const fields = parsed.data.map((f) => {
      const key = keysInUse.has(f.key) ? f.key : fieldKey(f.label, [...taken, ...keysInUse]);
      taken.push(key);
      return { ...f, key };
    });
    onSave({ ...draft, fields });
  };

  return (
    <div className="flex flex-col gap-6">
      {notice}

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <TemplateIcon icon={draft.icon} color={draft.color} />
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="tpl-nombre">Nombre</Label>
            <Input
              id="tpl-nombre"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Ej. Western blot, ELISA, Campo abierto"
              className="h-12 text-lg font-medium"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tpl-desc">Descripción</Label>
          <Input
            id="tpl-desc"
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            className={fieldInputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tpl-actividad">Actividad</Label>
          <Input
            id="tpl-actividad"
            list="tpl-actividades"
            value={draft.activity_type}
            onChange={(e) =>
              set({ activity_type: e.target.value.toLowerCase().replace(/\s+/g, "_") })
            }
            placeholder="Ej. western_blot (agrupa plantillas para la IA y la búsqueda)"
            className={`${fieldInputClass} font-mono`}
          />
          <datalist id="tpl-actividades">
            {activities.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">Ícono y color</summary>
          <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-9">
            {Object.entries(TEMPLATE_ICONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={draft.icon === name}
                onClick={() => set({ icon: name })}
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl border",
                  draft.icon === name && "border-primary ring-2 ring-primary/30",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(TEMPLATE_COLORS).map(([name, cls]) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={draft.color === name}
                onClick={() => set({ color: name })}
                className={cn(
                  "size-12 rounded-xl",
                  cls,
                  draft.color === name &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              />
            ))}
          </div>
        </details>
      </section>

      <section aria-labelledby="tpl-campos" className="flex flex-col gap-3">
        <h2 id="tpl-campos" className="border-b pb-2 font-heading text-lg font-semibold">
          Campos
        </h2>
        <p className="text-sm text-muted-foreground">
          Objetivo, observaciones, resultados, siguiente paso y ubicación de datos ya vienen en toda
          entrada. Aquí van solo los de esta actividad.
        </p>
        <ol className="flex flex-col gap-2">
          {draft.fields.map((f, i) => (
            <li key={f.key}>
              <FieldEditor
                field={f}
                expanded={open === f.key}
                lockedKey={keysInUse.has(f.key)}
                onToggle={() => setOpen(open === f.key ? null : f.key)}
                onChange={(nf) => setField(i, nf)}
                onRemove={() => set({ fields: draft.fields.filter((_, j) => j !== i) })}
                onMove={(dir) => move(i, dir)}
                first={i === 0}
                last={i === draft.fields.length - 1}
              />
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as FieldType)}
            aria-label="Tipo del campo nuevo"
            className={selectClass}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" className="h-12 shrink-0" onClick={addField}>
            <Plus className="size-4" aria-hidden />
            Campo
          </Button>
        </div>
      </section>

      <section aria-labelledby="tpl-protocolo" className="flex flex-col gap-3">
        <h2
          id="tpl-protocolo"
          className="flex items-center gap-2 border-b pb-2 font-heading text-lg font-semibold"
        >
          <FileText className="size-5" aria-hidden />
          Protocolo
        </h2>
        <p className="text-sm text-muted-foreground">
          El protocolo estándar. La IA lo usa para detectar desviaciones y datos faltantes.
        </p>
        <Textarea
          value={draft.protocol_notes}
          onChange={(e) => set({ protocol_notes: e.target.value })}
          placeholder="Pega o escribe el protocolo…"
          aria-label="Texto del protocolo"
          className="min-h-40 font-mono text-sm"
        />
        {draft.protocol_sources.length > 0 && <ProtocolSources paths={draft.protocol_sources} />}
      </section>

      <section className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          className="h-12"
          onClick={() => {
            setPreviewData(initialValues(draft.fields));
            setPreview(!preview);
          }}
        >
          <Eye className="size-4" aria-hidden />
          {preview ? "Ocultar vista previa" : "Ver cómo queda el formulario"}
        </Button>
        {preview && fieldsSchema.safeParse(draft.fields).success && (
          <div className="rounded-xl border p-4">
            <DynamicForm fields={draft.fields} value={previewData} onChange={setPreviewData} />
          </div>
        )}
      </section>

      {(problem || error) && (
        <p role="alert" className="text-sm text-destructive">
          {problem ?? error?.message}
        </p>
      )}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-1 rounded-xl border bg-background p-3 shadow-lg">
        <Button className="h-12 text-base" disabled={saving} onClick={save}>
          {saving ? "Guardando…" : existing ? "Guardar cambios" : "Crear plantilla"}
        </Button>
        {existing && (
          <p className="text-center text-xs text-muted-foreground">
            Si cambias campos o protocolo se crea la versión {existing.current_version + 1}; las
            entradas anteriores conservan la suya.
          </p>
        )}
      </div>
    </div>
  );
}

function ProtocolSources({ paths }: { paths: string[] }) {
  const urls = useSignedUrls(paths);
  return (
    <ul className="flex flex-wrap gap-2">
      {paths.map((p, i) => {
        const url = urls.data?.get(p);
        const pdf = p.endsWith(".pdf");
        return (
          <li key={p}>
            <a
              href={url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center gap-2 rounded-xl border bg-card px-3 text-sm hover:bg-muted/50"
            >
              <FileText className="size-4" aria-hidden />
              {pdf ? `PDF ${i + 1}` : `Foto ${i + 1}`}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function FieldEditor({
  field,
  expanded,
  lockedKey,
  onToggle,
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  field: FieldDef;
  expanded: boolean;
  lockedKey: boolean;
  onToggle: () => void;
  onChange: (f: FieldDef) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  first: boolean;
  last: boolean;
}) {
  const sampleTypes = useSampleTypes();
  const patch = (p: Partial<FieldDef>) => onChange({ ...field, ...p } as FieldDef);

  return (
    <div className={cn("rounded-xl border bg-card", expanded && "border-primary/50")}>
      <div className="flex items-center gap-1 p-1 pl-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {field.label || "Sin nombre"}
              {field.required && <span className="text-destructive">*</span>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {FIELD_TYPE_LABELS[field.type]}
              {"unit" in field && field.unit ? ` · ${field.unit}` : ""}
              {field.type === "sample_ref" ? ` · ${sampleTypes.labelOf(field.sample_type)}` : ""}
            </span>
          </span>
          {expanded ? (
            <ChevronUp className="size-4 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          )}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label="Subir"
          disabled={first}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-12"
          aria-label="Bajar"
          disabled={last}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-4" aria-hidden />
        </Button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${field.key}-label`}>Nombre del campo</Label>
            <Input
              id={`${field.key}-label`}
              value={field.label}
              onChange={(e) => patch({ label: e.target.value })}
              className={fieldInputClass}
            />
            <span className="font-mono text-xs text-muted-foreground">
              clave: {field.key}
              {lockedKey && " (fija: ya hay entradas con este campo)"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${field.key}-type`}>Tipo</Label>
            <select
              id={`${field.key}-type`}
              value={field.type}
              onChange={(e) => onChange(changeFieldType(field, e.target.value as FieldType))}
              className={selectClass}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-12 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => patch({ required: e.target.checked })}
              className="size-5 accent-primary"
            />
            Obligatorio para cerrar la entrada
          </label>

          <TypeOptions
            field={field}
            patch={patch}
            onChange={onChange}
            sampleTypes={sampleTypes.active.map((t) => ({ key: t.key, label: t.label }))}
          />

          <div className="flex flex-col gap-1">
            <Label htmlFor={`${field.key}-help`}>Ayuda (opcional)</Label>
            <Input
              id={`${field.key}-help`}
              value={field.help ?? ""}
              onChange={(e) => patch({ help: e.target.value || undefined })}
              className={fieldInputClass}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-12 self-start text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden />
            Quitar campo
          </Button>
        </div>
      )}
    </div>
  );
}

/** Opciones propias de cada tipo de campo, incluido el valor esperado del protocolo. */
function TypeOptions({
  field,
  patch,
  onChange,
  sampleTypes,
}: {
  field: FieldDef;
  patch: (p: Partial<FieldDef>) => void;
  onChange: (f: FieldDef) => void;
  sampleTypes: { key: string; label: string }[];
}) {
  const id = field.key;
  switch (field.type) {
    case "number":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-unit`}>Unidad</Label>
            <Input
              id={`${id}-unit`}
              value={field.unit ?? ""}
              onChange={(e) => patch({ unit: e.target.value || undefined })}
              placeholder="µL, °C, %…"
              className={fieldInputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-exp`}>Esperado (protocolo)</Label>
            <NumberInput
              id={`${id}-exp`}
              value={field.expected ?? null}
              onChange={(n) => patch({ expected: n ?? undefined })}
            />
          </div>
        </div>
      );
    case "duration":
      return (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-exp`}>Duración esperada (protocolo)</Label>
          <DurationInput
            id={`${id}-exp`}
            value={field.expected ?? null}
            onChange={(n) => patch({ expected: n ?? undefined })}
          />
        </div>
      );
    case "select":
    case "multiselect":
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-opts`}>Opciones (una por línea)</Label>
          <Textarea
            id={`${id}-opts`}
            defaultValue={field.options.join("\n")}
            onBlur={(e) => {
              const options = [
                ...new Set(
                  e.target.value
                    .split("\n")
                    .map((o) => o.trim())
                    .filter(Boolean),
                ),
              ];
              onChange({
                ...field,
                options: options.length ? options : ["Opción 1"],
                ...(field.type === "select" && field.expected && !options.includes(field.expected)
                  ? { expected: undefined }
                  : {}),
              } as FieldDef);
            }}
            className="min-h-24 text-base"
          />
          {field.type === "select" && (
            <>
              <span className="text-sm font-medium">Esperado (protocolo)</span>
              <div className="flex flex-wrap gap-2">
                {field.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => patch({ expected: field.expected === o ? undefined : o })}
                    className={chipClass(field.expected === o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      );
    case "boolean":
      return (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Esperado (protocolo)</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                [true, "Sí"],
                [false, "No"],
                [undefined, "—"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={l}
                type="button"
                onClick={() => patch({ expected: v })}
                className={chipClass(field.expected === v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-exp`}>Esperado (protocolo, opcional)</Label>
          <Input
            id={`${id}-exp`}
            value={field.expected ?? ""}
            onChange={(e) => patch({ expected: e.target.value || undefined })}
            className={fieldInputClass}
          />
        </div>
      );
    case "sample_ref":
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-st`}>Tipo de muestra</Label>
            <select
              id={`${id}-st`}
              value={field.sample_type}
              onChange={(e) => patch({ sample_type: e.target.value })}
              className={selectClass}
            >
              {sampleTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => patch({ role: "usada" })}
              className={chipClass(field.role === "usada")}
            >
              Se usa
            </button>
            <button
              type="button"
              onClick={() => patch({ role: "producida" })}
              className={chipClass(field.role === "producida")}
            >
              Se produce
            </button>
          </div>
          <label className="flex min-h-12 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.multiple}
              onChange={(e) => patch({ multiple: e.target.checked })}
              className="size-5 accent-primary"
            />
            Varias muestras
          </label>
        </div>
      );
    case "reagent":
      return (
        <label className="flex min-h-12 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.multiple}
            onChange={(e) => patch({ multiple: e.target.checked })}
            className="size-5 accent-primary"
          />
          Varios reactivos
        </label>
      );
    case "steps":
      return <StepsEditor field={field} onChange={onChange} />;
    default:
      return null;
  }
}

function StepsEditor({
  field,
  onChange,
}: {
  field: Extract<FieldDef, { type: "steps" }>;
  onChange: (f: FieldDef) => void;
}) {
  const steps = field.expected ?? [];
  const set = (next: typeof steps) => onChange({ ...field, expected: next });
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Pasos del protocolo</span>
      {steps.map((s, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2">
          <div className="flex gap-2">
            <Input
              value={s.label}
              onChange={(e) =>
                set(steps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
              placeholder={`Paso ${i + 1}`}
              aria-label={`Paso ${i + 1}`}
              className={fieldInputClass}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-12 shrink-0"
              aria-label={`Quitar paso ${i + 1}`}
              onClick={() => set(steps.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
          <DurationInput
            label={`Paso ${i + 1} planificado`}
            value={s.planned_seconds ?? null}
            onChange={(n) =>
              set(steps.map((x, j) => (j === i ? { ...x, planned_seconds: n ?? undefined } : x)))
            }
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-12"
        onClick={() => set([...steps, { label: "" }])}
      >
        <Plus className="size-4" aria-hidden />
        Paso
      </Button>
    </div>
  );
}
