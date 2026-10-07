"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCreateSample, useSamples } from "@/lib/queries/samples";
import { safeNext } from "@/lib/safe-next";
import { SAMPLE_TYPES, type SampleType } from "@/lib/templates/fields";
import { SampleForm } from "./sample-form";

/**
 * Nueva muestra. Parámetros opcionales: ?tipo=bloque&padre=CÓDIGO&codigo=…&volver=/ruta
 * (p. ej. desde una muestra para registrar una derivada).
 */
export function NewSample() {
  const router = useRouter();
  const params = useSearchParams();
  const samples = useSamples();
  const create = useCreateSample();

  const tipo = params.get("tipo");
  const type: SampleType = SAMPLE_TYPES.includes(tipo as SampleType)
    ? (tipo as SampleType)
    : "animal";
  const back = params.get("volver");

  if (samples.isPending) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  const parent = samples.data?.find((s) => s.code === params.get("padre"));

  return (
    <SampleForm
      initial={{
        sample_type: type,
        code: params.get("codigo") ?? "",
        parent_id: parent?.id ?? null,
      }}
      submitLabel="Registrar muestra"
      pending={create.isPending}
      error={create.error}
      onCancel={() => router.back()}
      onSubmit={(input) =>
        create.mutate(input, {
          onSuccess: (s) => router.replace(back ? safeNext(back) : `/muestras/${s.id}`),
        })
      }
    />
  );
}
