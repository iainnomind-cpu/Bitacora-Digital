"use client";

import { useQuery } from "@tanstack/react-query";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await createClient().from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Zona horaria del usuario (la del diseño mientras carga el perfil). */
export function useTimeZone() {
  return useProfile().data?.timezone ?? DEFAULT_TIMEZONE;
}
