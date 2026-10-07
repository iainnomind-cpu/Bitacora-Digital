"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCreateSample, useSamples } from "@/lib/queries/samples";
import { safeNext } from "@/lib/safe-next";
import { useSampleTypes } from "@/lib/queries/sample-types";
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
  const sampleTypes = useSampleTypes();
  const back = params.get("volver");

  if (samples.isPending || sampleTypes.isPending) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }
  const type =
    sampleTypes.active.find((t) => t.key === tipo)?.key ?? sampleTypes.active[0]?.key ?? "otro";
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
