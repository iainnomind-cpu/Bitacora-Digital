"use client";

import { useId, type ComponentType } from "react";
import { Label } from "@/components/ui/label";
import type { FieldDef, FieldType } from "@/lib/templates/fields";
import type { EntryData } from "@/lib/templates/values";
import {
  BooleanField,
  DateTimeField,
  DurationField,
  LongTextField,
  MultiSelectField,
  NumberField,
  RatingField,
  SelectField,
  TextField,
  TimeField,
  type FieldProps,
} from "./fields/basic-fields";
import { ReagentField, SampleRefField, StepsField } from "./fields/group-fields";

const CONTROLS: { [T in FieldType]: ComponentType<FieldProps<T>> } = {
  text: TextField,
  longtext: LongTextField,
  number: NumberField,
  duration: DurationField,
  datetime: DateTimeField,
  time: TimeField,
  select: SelectField,
  multiselect: MultiSelectField,
  boolean: BooleanField,
  rating: RatingField,
  sample_ref: SampleRefField,
  reagent: ReagentField,
  steps: StepsField,
};

/** Formulario generado a partir de `template_versions.fields` (§5). Controlado: no guarda nada. */
export function DynamicForm({
  fields,
  value,
  onChange,
  errors = {},
  disabled,
}: {
  fields: FieldDef[];
  value: EntryData;
  onChange: (next: EntryData) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  const formId = useId();

  return (
    <div className="flex flex-col gap-6">
      {fields.map((field) => {
        const id = `${formId}-${field.key}`;
        const error = errors[field.key];
        const Control = CONTROLS[field.type] as ComponentType<FieldProps<FieldType>>;
        return (
          <div
            key={field.key}
            role="group"
            aria-labelledby={`${id}-label`}
            className="flex flex-col gap-2"
          >
            <Label id={`${id}-label`} htmlFor={id} className="text-base">
              {field.label}
              {field.required && (
                <span className="text-destructive" aria-label="obligatorio">
                  *
                </span>
              )}
            </Label>
            {field.help && <p className="-mt-1 text-sm text-muted-foreground">{field.help}</p>}
            <Control
              id={id}
              field={field}
              value={value[field.key] ?? null}
              onChange={(v) => onChange({ ...value, [field.key]: v })}
              disabled={disabled}
              invalid={Boolean(error)}
              form={{ fields, data: value }}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
