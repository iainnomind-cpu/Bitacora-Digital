import { z } from "zod";

// Definiciones de campo de una plantilla (template_versions.fields, docs/design.md §5).
// Valores que guarda cada tipo en entries.data (null = no se registró; la IA nunca inventa):
//   text, longtext, select → string        number, rating → number
//   duration → segundos (entero)           datetime → ISO 8601 · time → "HH:MM"
//   multiselect → string[]                 boolean → boolean
//   sample_ref → código (string), o string[] si multiple
//   reagent → Reagent, o Reagent[] si multiple
//   steps → Step[]

// Tipos de muestra iniciales. El usuario puede crear los suyos (tabla sample_types), así que
// en los campos sample_ref el tipo es cualquier clave válida.
export const SAMPLE_TYPES = [
  "animal",
  "tejido",
  "bloque",
  "navaja",
  "rejilla",
  "laminilla",
  "muestra_microct",
  "otro",
] as const;
export type SampleType = string;

export const SAMPLE_TYPE_LABELS: Record<string, string> = {
  animal: "Animal",
  tejido: "Tejido",
  bloque: "Bloque",
  navaja: "Navaja",
  rejilla: "Rejilla",
  laminilla: "Laminilla",
  muestra_microct: "Muestra de microCT",
  otro: "Otro",
};

/** Etiqueta de un tipo de muestra cuando no se tiene la tabla a mano ("linea_celular" → "Linea celular"). */
export function sampleTypeLabel(key: string) {
  return SAMPLE_TYPE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const base = {
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, "Clave en minúsculas, números y guion bajo."),
  label: z.string().trim().min(1),
  required: z.boolean().default(false),
  help: z.string().optional(),
};

const options = z.array(z.string().trim().min(1)).min(1);

export const fieldDefSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("text"),
    default: z.string().optional(),
    expected: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("longtext"), default: z.string().optional() }),
  z.object({
    ...base,
    type: z.literal("number"),
    unit: z.string().optional(),
    default: z.number().optional(),
    expected: z.number().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("duration"),
    default: z.number().int().nonnegative().optional(),
    expected: z.number().int().nonnegative().optional(),
  }),
  z.object({ ...base, type: z.literal("datetime") }),
  z.object({
    ...base,
    type: z.literal("time"),
    default: z.string().regex(TIME_PATTERN).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("select"),
    options,
    default: z.string().optional(),
    expected: z.string().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("multiselect"),
    options,
    default: z.array(z.string()).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("boolean"),
    default: z.boolean().optional(),
    expected: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("rating"),
    default: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("sample_ref"),
    sample_type: z.string().regex(/^[a-z][a-z0-9_]*$/),
    multiple: z.boolean().default(false),
    role: z.enum(["usada", "producida"]).default("usada"),
  }),
  z.object({ ...base, type: z.literal("reagent"), multiple: z.boolean().default(false) }),
  z.object({
    ...base,
    type: z.literal("steps"),
    expected: z
      .array(
        z.object({
          label: z.string().trim().min(1),
          planned_seconds: z.number().int().nonnegative().optional(),
        }),
      )
      .optional(),
  }),
]);

export type FieldDef = z.infer<typeof fieldDefSchema>;
export type FieldType = FieldDef["type"];
export type FieldOf<T extends FieldType> = Extract<FieldDef, { type: T }>;

export const fieldsSchema = z.array(fieldDefSchema).superRefine((fields, ctx) => {
  const seen = new Set<string>();
  fields.forEach((f, i) => {
    if (seen.has(f.key)) {
      ctx.addIssue({ code: "custom", path: [i, "key"], message: `Clave repetida: ${f.key}` });
    }
    seen.add(f.key);
  });
});

/** Lee `template_versions.fields`; lanza si la definición no es válida. */
export function parseFields(json: unknown): FieldDef[] {
  return fieldsSchema.parse(json);
}

export const reagentSchema = z.object({
  nombre: z.string().nullable(),
  marca: z.string().nullable(),
  lote: z.string().nullable(),
  concentracion: z.string().nullable(),
});
export type Reagent = z.infer<typeof reagentSchema>;
export const REAGENT_PARTS = [
  { key: "nombre", label: "Nombre" },
  { key: "marca", label: "Marca" },
  { key: "lote", label: "Lote" },
  { key: "concentracion", label: "Concentración / dilución" },
] as const satisfies readonly { key: keyof Reagent; label: string }[];

export const stepSchema = z.object({
  label: z.string(),
  planned_seconds: z.number().int().nonnegative().nullable(),
  actual_seconds: z.number().int().nonnegative().nullable(),
  note: z.string().nullable(),
});
export type Step = z.infer<typeof stepSchema>;

export const emptyReagent = (): Reagent => ({
  nombre: null,
  marca: null,
  lote: null,
  concentracion: null,
});
export const emptyStep = (label = "", planned: number | null = null): Step => ({
  label,
  planned_seconds: planned,
  actual_seconds: null,
  note: null,
});
