"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useProfile } from "@/lib/queries/profile";
import { parseVocabulary, useUpdateProfile } from "@/lib/queries/projects";

/**
 * Mi laboratorio: área, técnicas y vocabulario que la IA usa en todas las funciones
 * (transcripción, llenado, sugerencias, protocolos), y la zona horaria.
 */
export function LabCard() {
  const profile = useProfile();
  if (profile.isPending) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  return <LabForm key={profile.data?.updated_at} profile={profile.data} />;
}

function LabForm({ profile }: { profile: ReturnType<typeof useProfile>["data"] }) {
  const mounted = useMounted();
  const update = useUpdateProfile();
  const [context, setContext] = useState(profile?.ai_context ?? "");
  const [vocabulary, setVocabulary] = useState((profile?.vocabulary ?? []).join(", "));
  const [timezone, setTimezone] = useState(profile?.timezone ?? "America/Mexico_City");
  const [saved, setSaved] = useState(false);
  const zones = mounted && "supportedValuesOf" in Intl ? Intl.supportedValuesOf("timeZone") : [timezone];

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="lab-contexto">Área y técnicas</Label>
        <Textarea
          id="lab-contexto"
          value={context}
          onChange={(e) => {
            setContext(e.target.value);
            setSaved(false);
          }}
          placeholder="Ej. Laboratorio de biología molecular: clonación, qPCR y Western blot en células HEK293"
          className="min-h-24 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lab-vocab">Vocabulario (separado por comas)</Label>
        <Textarea
          id="lab-vocab"
          value={vocabulary}
          onChange={(e) => {
            setVocabulary(e.target.value);
            setSaved(false);
          }}
          className="min-h-20 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lab-zona">Zona horaria</Label>
        <select
          id="lab-zona"
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setSaved(false);
          }}
          className="h-12 w-full rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      {update.error && (
        <p role="alert" className="text-sm text-destructive">
          {update.error.message}
        </p>
      )}
      <Button
        className="h-12"
        disabled={update.isPending}
        onClick={() =>
          update.mutate(
            { ai_context: context.trim() || null, vocabulary: parseVocabulary(vocabulary), timezone },
            { onSuccess: () => setSaved(true) },
          )
        }
      >
        {saved ? <Check className="size-4" aria-hidden /> : null}
        {update.isPending ? "Guardando…" : saved ? "Guardado" : "Guardar"}
      </Button>
      <Link
        href="/proyectos"
        className="flex min-h-12 items-center gap-3 rounded-xl border px-4 transition-colors hover:bg-muted/50"
      >
        <FolderKanban className="size-5 text-muted-foreground" aria-hidden />
        <span className="flex-1 font-medium">Proyectos</span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
