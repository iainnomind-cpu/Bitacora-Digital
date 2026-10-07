"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronLeft, Loader2, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useInstallPack } from "@/lib/queries/packs";
import { useTemplates } from "@/lib/queries/templates";
import { TEMPLATE_PACKS, type TemplatePack } from "@/lib/templates/packs";
import { cn } from "@/lib/utils";
import { TEMPLATE_ICONS, TemplateIcon } from "./template-icon";

/** Paquetes de plantillas por disciplina: puntos de partida para cualquier laboratorio. */
export function PacksView() {
  const templates = useTemplates();
  const names = new Set((templates.data ?? []).map((t) => t.name.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/plantillas"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-12 gap-1 self-start")}
      >
        <ChevronLeft className="size-5" aria-hidden />
        Plantillas
      </Link>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Plantillas por disciplina
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agrega las de tu área. Los tiempos y valores son típicos: ajústalos a tu protocolo en el
          editor, o crea la tuya desde la foto del protocolo.
        </p>
      </div>
      {TEMPLATE_PACKS.map((p) => (
        <PackCard key={p.key} pack={p} have={names} />
      ))}
    </div>
  );
}

function PackCard({ pack, have }: { pack: TemplatePack; have: Set<string> }) {
  const install = useInstallPack();
  const [result, setResult] = useState<string | null>(null);
  const Icon = TEMPLATE_ICONS[pack.icon];
  const missing = pack.templates.filter((t) => !have.has(t.name.toLowerCase()));

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          {Icon && <Icon className="size-6" aria-hidden />}
        </span>
        <div>
          <h2 className="font-semibold">{pack.name}</h2>
          <p className="text-sm text-muted-foreground">{pack.description}</p>
        </div>
      </header>
      <ul className="flex flex-col gap-1.5">
        {pack.templates.map((t) => {
          const installed = have.has(t.name.toLowerCase());
          return (
            <li key={t.name} className="flex items-center gap-2 text-sm">
              <TemplateIcon
                icon={t.icon}
                color={t.color}
                className="size-8 rounded-lg [&_svg]:size-4"
              />
              <span className="flex-1">{t.name}</span>
              {installed && <Check className="size-4 text-emerald-600" aria-label="Ya la tienes" />}
            </li>
          );
        })}
      </ul>
      {pack.sampleTypes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tipos de muestra: {pack.sampleTypes.map((t) => t.label).join(", ")}
        </p>
      )}
      {install.error && <p className="text-sm text-destructive">{install.error.message}</p>}
      {result && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {result}
        </p>
      )}
      <Button
        className="h-12"
        variant={missing.length ? "default" : "outline"}
        disabled={install.isPending || missing.length === 0}
        onClick={() =>
          install.mutate(pack, {
            onSuccess: (r) =>
              setResult(
                r.sampleTypes
                  ? `Listo: se agregaron ${r.templates} plantillas y ${r.sampleTypes} tipos de muestra.`
                  : `Listo: se agregaron ${r.templates} plantillas.`,
              ),
          })
        }
      >
        {install.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : missing.length ? (
          <Plus className="size-4" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
        {missing.length ? `Agregar ${missing.length} plantillas` : "Ya tienes todas"}
      </Button>
    </section>
  );
}
