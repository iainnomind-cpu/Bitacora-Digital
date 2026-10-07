// Campos faltantes y desviaciones, deterministas (§7.3: "determinista primero, sin IA").
import { formatDuration } from "./duration";
import type { FieldDef, Step } from "./fields";
import { isEmptyValue, type EntryData } from "./values";

export type EntryFlag = {
  key: string;
  label: string;
  kind: "faltante" | "desviacion";
  message: string;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Diferencia de tiempo relevante: más de 1 min y más del 10 % de lo planificado. */
function timeDiffers(planned: number, actual: number) {
  return Math.abs(actual - planned) > Math.max(60, planned * 0.1);
}

export function checkEntry(fields: FieldDef[], data: EntryData): EntryFlag[] {
  const flags: EntryFlag[] = [];
  for (const f of fields) {
    const v = data[f.key];
    if (f.required && isEmptyValue(f, v)) {
      flags.push({
        key: f.key,
        label: f.label,
        kind: "faltante",
        message: "Obligatorio para cerrar.",
      });
      continue;
    }
    if (v == null) continue;

    switch (f.type) {
      case "number":
        if (f.expected !== undefined && typeof v === "number" && v !== f.expected) {
          const u = f.unit ? ` ${f.unit}` : "";
          flags.push({
            key: f.key,
            label: f.label,
            kind: "desviacion",
            message: `Protocolo: ${f.expected}${u} · registrado: ${v}${u}.`,
          });
        }
        break;
      case "duration":
        if (f.expected !== undefined && typeof v === "number" && timeDiffers(f.expected, v)) {
          flags.push({
            key: f.key,
            label: f.label,
            kind: "desviacion",
            message: `Protocolo: ${formatDuration(f.expected)} · real: ${formatDuration(v)}.`,
          });
        }
        break;
      case "select":
      case "text":
        if (f.expected && typeof v === "string" && v.trim() && fold(v) !== fold(f.expected)) {
          flags.push({
            key: f.key,
            label: f.label,
            kind: "desviacion",
            message: `Protocolo: ${f.expected} · registrado: ${v}.`,
          });
        }
        break;
      case "boolean":
        if (f.expected !== undefined && typeof v === "boolean" && v !== f.expected) {
          flags.push({
            key: f.key,
            label: f.label,
            kind: "desviacion",
            message: `Protocolo: ${f.expected ? "sí" : "no"} · registrado: ${v ? "sí" : "no"}.`,
          });
        }
        break;
      case "steps":
        (Array.isArray(v) ? (v as Step[]) : []).forEach((s, i) => {
          if (
            s.planned_seconds != null &&
            s.actual_seconds != null &&
            timeDiffers(s.planned_seconds, s.actual_seconds)
          ) {
            flags.push({
              key: `${f.key}.${i}`,
              label: `${f.label}: ${s.label || `paso ${i + 1}`}`,
              kind: "desviacion",
              message: `Planificado: ${formatDuration(s.planned_seconds)} · real: ${formatDuration(s.actual_seconds)}.`,
            });
          }
        });
        break;
    }
  }
  return flags;
}
