"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useProtocolDraft } from "@/lib/queries/protocols";
import { useSaveTemplate, useTemplate } from "@/lib/queries/templates";
import { emptyTemplateDraft, type TemplateDraft } from "@/lib/templates/editor";
import { cn } from "@/lib/utils";
import { PreviewSkeleton } from "./template-preview";
import { TemplateEditor } from "./template-editor";

function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-12 gap-1 self-start")}
    >
      <ChevronLeft className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

/**
 * Nueva plantilla: en blanco, `?desde=<id>` (duplicar) o `?sugerencia=<id>` (propuesta de la
 * IA a partir de un protocolo).
 */
export function NewTemplate() {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params.get("desde");
  const suggestionId = params.get("sugerencia");
  const source = useTemplate(fromId ?? "");
  const proposal = useProtocolDraft(suggestionId);
  const save = useSaveTemplate();

  if ((fromId && source.isPending) || (suggestionId && proposal.isPending))
    return <PreviewSkeleton />;

  let initial: TemplateDraft = emptyTemplateDraft();
  if (fromId && source.data) {
    const t = source.data;
    initial = {
      name: `${t.name} (copia)`,
      activity_type: t.activity_type,
      description: t.description ?? "",
      icon: t.icon ?? "notebook-pen",
      color: t.color ?? "slate",
      fields: t.fields,
      protocol_notes: t.protocolNotes ?? "",
      protocol_sources: t.protocolSources,
    };
  } else if (proposal.data) {
    initial = proposal.data.draft;
  }

  return (
    <div className="flex flex-col gap-4">
      <Back href="/plantillas" label="Plantillas" />
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Nueva plantilla</h1>
      {proposal.error && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo cargar la propuesta: {proposal.error.message}
        </p>
      )}
      <TemplateEditor
        initial={initial}
        saving={save.isPending}
        error={save.error}
        notice={
          proposal.data ? (
            <div className="flex gap-3 rounded-xl border-2 border-primary/40 bg-card p-4 text-sm">
              <Sparkles className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-medium">Propuesta de la IA a partir del protocolo</p>
                <p className="text-muted-foreground">
                  Revisa cada campo, unidad y valor esperado antes de crearla. {proposal.data.notes}
                </p>
              </div>
            </div>
          ) : null
        }
        onSave={(draft) =>
          save.mutate(
            { draft },
            {
              onSuccess: async (id) => {
                await proposal.markAccepted();
                router.replace(`/plantillas/${id}`);
              },
            },
          )
        }
      />
    </div>
  );
}

export function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const template = useTemplate(id);
  const save = useSaveTemplate();

  if (template.isPending) return <PreviewSkeleton />;
  if (!template.data) return <p>Esta plantilla no existe.</p>;
  const t = template.data;

  return (
    <div className="flex flex-col gap-4">
      <Back href={`/plantillas/${id}`} label={t.name} />
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Editar plantilla</h1>
      <TemplateEditor
        key={`${t.id}:${t.current_version}`}
        existing={t}
        initial={{
          name: t.name,
          activity_type: t.activity_type,
          description: t.description ?? "",
          icon: t.icon ?? "notebook-pen",
          color: t.color ?? "slate",
          fields: t.fields,
          protocol_notes: t.protocolNotes ?? "",
          protocol_sources: t.protocolSources,
        }}
        saving={save.isPending}
        error={save.error}
        onSave={(draft) =>
          save.mutate(
            { draft, existing: t },
            { onSuccess: () => router.replace(`/plantillas/${id}`) },
          )
        }
      />
    </div>
  );
}
