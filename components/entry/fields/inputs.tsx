"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { joinDuration, splitDuration } from "@/lib/templates/duration";
import { cn } from "@/lib/utils";

// Controles base reutilizados por los campos del formulario dinámico. Todos ≥ 48 px de alto.

export const fieldInputClass = "h-12 text-base";

/** Botón tipo "chip" para opciones (select, multiselect, sí/no). */
export function chipClass(selected: boolean) {
  return cn(
    "inline-flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-xl border bg-card px-4 text-sm font-medium transition-colors",
    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
    selected && "border-primary bg-primary text-primary-foreground",
  );
}

function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Número con coma o punto decimal. Guarda el texto mientras se escribe ("0," o "-") y solo
 * propaga valores válidos; si el valor cambia desde fuera (p. ej. la IA), se actualiza el texto.
 */
export function NumberInput({
  value,
  onChange,
  integer = false,
  className,
  ...props
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  integer?: boolean;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "type">) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if (parseNumber(text) !== value) setText(value == null ? "" : String(value));
  }
  const parsed = parseNumber(text);
  const invalid = text.trim() !== "" && (parsed == null || (integer && !Number.isInteger(parsed)));

  return (
    <Input
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseNumber(e.target.value);
        if (e.target.value.trim() === "") onChange(null);
        else if (n != null && (!integer || Number.isInteger(n))) onChange(n);
      }}
      className={cn(fieldInputClass, className)}
    />
  );
}

/** Duración como h / min / s; el valor es en segundos. */
export function DurationInput({
  id,
  value,
  onChange,
  disabled,
  invalid,
  label,
}: {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
}) {
  const { h, m, s } = splitDuration(value);
  const parts = [
    { key: "h", unit: "h", value: h },
    { key: "m", unit: "min", value: m },
    { key: "s", unit: "s", value: s },
  ] as const;

  const update = (key: "h" | "m" | "s", n: number | null) => {
    const next = { h, m, s, [key]: n };
    onChange(joinDuration(next.h, next.m, next.s));
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {parts.map((p, i) => (
        <label key={p.key} className="relative">
          <span className="sr-only">
            {label ? `${label}: ` : ""}
            {p.unit}
          </span>
          <NumberInput
            id={i === 0 ? id : undefined}
            integer
            value={p.value}
            onChange={(n) => update(p.key, n == null ? null : Math.max(0, n))}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            placeholder="0"
            className="pr-10"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {p.unit}
          </span>
        </label>
      ))}
    </div>
  );
}
