"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FieldOf, FieldType } from "@/lib/templates/fields";
import { cn } from "@/lib/utils";
import { chipClass, DurationInput, fieldInputClass, NumberInput } from "./inputs";

export type FieldProps<T extends FieldType> = {
  id: string;
  field: FieldOf<T>;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  invalid?: boolean;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : null);
const emptyToNull = (v: string) => (v === "" ? null : v);

export function TextField({ id, value, onChange, disabled, invalid }: FieldProps<"text">) {
  return (
    <Input
      id={id}
      value={str(value)}
      onChange={(e) => onChange(emptyToNull(e.target.value))}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={fieldInputClass}
    />
  );
}

export function LongTextField({ id, value, onChange, disabled, invalid }: FieldProps<"longtext">) {
  return (
    <Textarea
      id={id}
      value={str(value)}
      onChange={(e) => onChange(emptyToNull(e.target.value))}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className="min-h-24 text-base"
    />
  );
}

export function NumberField({
  id,
  field,
  value,
  onChange,
  disabled,
  invalid,
}: FieldProps<"number">) {
  return (
    <div className="relative">
      <NumberInput
        id={id}
        value={num(value)}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(field.unit && "pr-16")}
      />
      {field.unit && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {field.unit}
        </span>
      )}
    </div>
  );
}

export function DurationField({
  id,
  field,
  value,
  onChange,
  disabled,
  invalid,
}: FieldProps<"duration">) {
  return (
    <DurationInput
      id={id}
      label={field.label}
      value={num(value)}
      onChange={onChange}
      disabled={disabled}
      invalid={invalid}
    />
  );
}

// datetime-local trabaja en la zona horaria del dispositivo; se guarda en UTC (ISO 8601).
function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function DateTimeField({ id, value, onChange, disabled, invalid }: FieldProps<"datetime">) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="datetime-local"
        value={typeof value === "string" ? toLocalInput(value) : ""}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={fieldInputClass}
      />
      <Button
        type="button"
        variant="outline"
        className="h-12 px-4"
        disabled={disabled}
        onClick={() => onChange(new Date().toISOString())}
      >
        Ahora
      </Button>
    </div>
  );
}

export function TimeField({ id, value, onChange, disabled, invalid }: FieldProps<"time">) {
  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="time"
        value={str(value)}
        onChange={(e) => onChange(emptyToNull(e.target.value))}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={fieldInputClass}
      />
      <Button
        type="button"
        variant="outline"
        className="h-12 px-4"
        disabled={disabled}
        onClick={() => onChange(now())}
      >
        Ahora
      </Button>
    </div>
  );
}

// Opciones como chips grandes (más fáciles con guantes que un menú desplegable).
// Tocar de nuevo la opción elegida la quita (vuelve a null).
export function SelectField({ id, field, value, onChange, disabled }: FieldProps<"select">) {
  return (
    <div id={id} role="radiogroup" className="flex flex-wrap gap-2">
      {field.options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(selected ? null : option)}
            className={chipClass(selected)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function MultiSelectField({
  id,
  field,
  value,
  onChange,
  disabled,
}: FieldProps<"multiselect">) {
  const current = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div id={id} className="flex flex-wrap gap-2">
      {field.options.map((option) => {
        const selected = current.includes(option);
        return (
          <button
            key={option}
            type="button"
            role="checkbox"
            aria-checked={selected}
            disabled={disabled}
            onClick={() =>
              onChange(
                selected
                  ? current.filter((o) => o !== option)
                  : field.options.filter((o) => o === option || current.includes(o)),
              )
            }
            className={chipClass(selected)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function BooleanField({ id, value, onChange, disabled }: FieldProps<"boolean">) {
  return (
    <div id={id} role="radiogroup" className="grid grid-cols-2 gap-2">
      {(
        [
          [true, "Sí"],
          [false, "No"],
        ] as const
      ).map(([option, label]) => {
        const selected = value === option;
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(selected ? null : option)}
            className={chipClass(selected)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function RatingField({ id, value, onChange, disabled }: FieldProps<"rating">) {
  const current = num(value);
  return (
    <div id={id} role="radiogroup" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = current != null && n <= current;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={`${n} de 5`}
            disabled={disabled}
            onClick={() => onChange(current === n ? null : n)}
            className="flex size-12 items-center justify-center rounded-xl transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Star
              className={cn(
                "size-7",
                filled ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
