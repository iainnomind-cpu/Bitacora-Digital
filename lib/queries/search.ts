"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fold, looksLikeCode } from "@/lib/search/text";
import { createClient } from "@/lib/supabase/client";

export type SearchFilters = {
  q: string;
  from: string | null;
  to: string | null;
  templateId: string | null;
  projectId: string | null;
  includeVoided: boolean;
};

const COLUMNS =
  "id, title, status, entry_date, started_at, template_id, objective, observations, results, next_steps, data_location, data";
const LIMIT = 50;

export const isEmptySearch = (f: SearchFilters) =>
  !f.q.trim() && !f.from && !f.to && !f.templateId && !f.projectId;

// Escapa comodines de LIKE para buscar el código literal.
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Búsqueda de entradas (§6.1.12): texto completo en español sin acentos (el mismo
 * search_vector que llena el trigger) + fecha, plantilla y estado. Si la consulta parece un
 * código de muestra, también trae las entradas vinculadas a esa muestra aunque el código no
 * esté en el texto. Además regresa las muestras cuyo código coincide.
 */
export function useEntrySearch(filters: SearchFilters) {
  return useQuery({
    queryKey: ["search", filters],
    enabled: !isEmptySearch(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const supabase = createClient();
      const q = filters.q.trim();

      const filtered = () => {
        let query = supabase.from("entries").select(COLUMNS);
        if (filters.from) query = query.gte("entry_date", filters.from);
        if (filters.to) query = query.lte("entry_date", filters.to);
        if (filters.templateId) query = query.eq("template_id", filters.templateId);
        if (filters.projectId) query = query.eq("project_id", filters.projectId);
        if (!filters.includeVoided) query = query.neq("status", "anulada");
        return query;
      };

      const textQuery = async () => {
        let query = filtered();
        if (q)
          query = query.textSearch("search_vector", fold(q), {
            config: "spanish",
            type: "websearch",
          });
        const { data, error } = await query
          .order("entry_date", { ascending: false })
          .order("started_at", { ascending: false, nullsFirst: false })
          .limit(LIMIT);
        if (error) throw error;
        return data;
      };

      const samplesQuery = async () => {
        if (q.length < 2) return [];
        const { data, error } = await supabase
          .from("samples")
          .select("id, code, sample_type, status")
          .ilike("code", `%${likeLiteral(q)}%`)
          .order("code")
          .limit(8);
        if (error) throw error;
        return data;
      };

      const [byText, samples] = await Promise.all([textQuery(), samplesQuery()]);

      // Código exacto → entradas vinculadas por entry_samples.
      let byLink: typeof byText = [];
      const exact = looksLikeCode(q)
        ? samples.find((s) => s.code.toLowerCase() === q.toLowerCase())
        : undefined;
      if (exact) {
        const { data: links, error } = await supabase
          .from("entry_samples")
          .select("entry_id")
          .eq("sample_id", exact.id);
        if (error) throw error;
        const ids = [...new Set(links.map((l) => l.entry_id))].filter(
          (id) => !byText.some((e) => e.id === id),
        );
        if (ids.length) {
          const { data, error: e2 } = await filtered().in("id", ids).limit(LIMIT);
          if (e2) throw e2;
          byLink = data;
        }
      }

      const entries = [...byText, ...byLink].sort(
        (a, b) =>
          b.entry_date.localeCompare(a.entry_date) ||
          (b.started_at ?? "").localeCompare(a.started_at ?? ""),
      );
      return { entries, samples, truncated: byText.length >= LIMIT };
    },
  });
}
