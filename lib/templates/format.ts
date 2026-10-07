import { formatDuration } from "./duration";
import { REAGENT_PARTS, type FieldDef, type Reagent, type Step } from "./fields";
import { isEmptyValue } from "./values";

// Texto legible del valor de un campo, para la vista de solo lectura y el historial.

function formatReagent(r: Reagent) {
  return REAGENT_PARTS.map((p) => r[p.key])
    .filter((v) => v != null && v.trim() !== "")
    .join(" · ");
}

function formatStep(s: Step, i: number) {
  const times = [
    s.planned_seconds != null && `plan. ${formatDuration(s.planned_seconds)}`,
    s.actual_seconds != null && `real ${formatDuration(s.actual_seconds)}`,
  ].filter(Boolean);
  return [`${i + 1}. ${s.label || "Paso"}`, times.join(", "), s.note].filter(Boolean).join(" — ");
}

export function formatFieldValue(field: FieldDef, value: unknown, timeZone?: string): string {
  if (isEmptyValue(field, value)) return "—";
  switch (field.type) {
    case "number":
      return field.unit ? `${value} ${field.unit}` : String(value);
    case "duration":
      return formatDuration(value as number);
    case "datetime":
      return new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value as string));
    case "boolean":
      return value ? "Sí" : "No";
    case "rating":
      return `${"★".repeat(value as number)}${"☆".repeat(5 - (value as number))}`;
    case "multiselect":
    case "sample_ref":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "reagent":
      return Array.isArray(value)
        ? (value as Reagent[]).map(formatReagent).filter(Boolean).join("\n")
        : formatReagent(value as Reagent);
    case "steps":
      return (value as Step[]).map(formatStep).join("\n");
    default:
      return String(value);
  }
}
