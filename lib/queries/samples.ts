"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SampleType } from "@/lib/templates/fields";

/** Códigos de muestras de un tipo, para autocompletar campos sample_ref. */
export function useSampleCodes(sampleType: SampleType) {
  return useQuery({
    queryKey: ["samples", "codes", sampleType],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("samples")
        .select("code")
        .eq("sample_type", sampleType)
        .eq("status", "activa")
        .order("code");
      if (error) throw error;
      return data.map((s) => s.code);
    },
  });
}
