// Genera lib/supabase/database.types.ts a partir del esquema OpenAPI que expone la API de
// Supabase (PostgREST), sin necesitar la CLI ni la contraseña de la base de datos.
// Uso: npm run db:types   (lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local)
import { writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`No se pudo leer el esquema: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const spec = await res.json();

// PostgREST no reporta los defaults de columnas jsonb ni de arreglos; estas sí tienen default
// en supabase/migrations, así que son opcionales al insertar.
const HIDDEN_DEFAULTS = new Set([
  "entries.data",
  "entries.ai_flags",
  "template_versions.fields",
  "samples.metadata",
  "ai_suggestions.input_ref",
  "attachments.ai_tags",
]);

function tsType(prop) {
  if (prop.type === "array") return `${tsType(prop.items ?? {})}[]`;
  if (prop.format === "jsonb" || prop.format === "json") return "Json";
  if (prop.enum) return prop.enum.map((v) => JSON.stringify(v)).join(" | ");
  switch (prop.type) {
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    default:
      return "Json";
  }
}

const tables = Object.keys(spec.definitions ?? {}).sort();
const out = [];
for (const table of tables) {
  const def = spec.definitions[table];
  const required = new Set(def.required ?? []);
  const row = [];
  const insert = [];
  const update = [];
  const relationships = [];
  for (const [col, prop] of Object.entries(def.properties ?? {})) {
    const t = tsType(prop);
    const nullable = !required.has(col);
    const optionalOnInsert =
      nullable || prop.default !== undefined || HIDDEN_DEFAULTS.has(`${table}.${col}`);
    const full = nullable ? `${t} | null` : t;
    row.push(`          ${col}: ${full};`);
    insert.push(`          ${col}${optionalOnInsert ? "?" : ""}: ${full};`);
    update.push(`          ${col}?: ${full};`);
    const fk = /<fk table='([^']+)' column='([^']+)'\/>/.exec(prop.description ?? "");
    if (fk) {
      relationships.push(
        `          {\n            foreignKeyName: "${table}_${col}_fkey";\n            columns: ["${col}"];\n            isOneToOne: false;\n            referencedRelation: "${fk[1]}";\n            referencedColumns: ["${fk[2]}"];\n          },`,
      );
    }
  }
  out.push(`      ${table}: {
        Row: {
${row.join("\n")}
        };
        Insert: {
${insert.join("\n")}
        };
        Update: {
${update.join("\n")}
        };
        Relationships: [
${relationships.join("\n")}
        ];
      };`);
}

const file = `// Generado por scripts/gen-db-types.mjs (npm run db:types). No editar a mano.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${out.join("\n")}
    };
    Views: { [_ in never]: never };
    Functions: {
      unaccent_es: { Args: { value: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
`;

writeFileSync(new URL("../lib/supabase/database.types.ts", import.meta.url), file);
console.log(`lib/supabase/database.types.ts: ${tables.length} tablas`);
