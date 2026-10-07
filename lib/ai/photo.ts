import "server-only";
import { z } from "zod";
import type { Tables } from "@/lib/supabase/database.types";
import { PHOTO_INSTRUCTIONS } from "./prompts";
import { AiError, structuredCall, type requireUser } from "./server";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

export const ACTIVITY_TYPES = [
  "perfusion_fijacion",
  "postfijacion",
  "inclusion_resina",
  "navaja_vidrio",
  "corte_semifino",
  "corte_fino",
  "tincion",
  "contraste_rejillas",
  "microct",
  "tratamiento_farmaco",
] as const;

const photoJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["description", "extracted_text", "activity", "object_type", "sample_codes"],
  properties: {
    description: { type: "string", description: "Qué se ve, en una o dos frases" },
    extracted_text: {
      type: ["string", "null"],
      description: "Texto legible: etiquetas, pantallas de equipos, escritura a mano",
    },
    activity: { type: ["string", "null"], enum: [...ACTIVITY_TYPES, null] },
    object_type: {
      type: ["string", "null"],
      description: "rejilla, bloque, corte, navaja, laminilla, animal, equipo, pantalla, etiqueta…",
    },
    sample_codes: { type: "array", items: { type: "string" } },
  },
};

const photoSchema = z.object({
  description: z.string(),
  extracted_text: z.string().nullable(),
  activity: z.enum(ACTIVITY_TYPES).nullable(),
  object_type: z.string().nullable(),
  sample_codes: z.array(z.string()),
});

/**
 * Describe una foto, lee su texto y la etiqueta (§7.6). Guarda ai_description,
 * ai_extracted_text y ai_tags ("actividad:…", "objeto:…", "muestra:…") en el adjunto.
 * La imagen va por URL firmada de corta duración y en detalle bajo para controlar costo.
 */
export async function analyzePhoto(
  supabase: Supabase,
  userId: string,
  attachment: Pick<Tables<"attachments">, "id" | "storage_path" | "caption">,
) {
  if (!attachment.storage_path) throw new AiError("La foto no tiene archivo.", 400);
  const signed = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, 300);
  if (signed.error) throw new AiError("No se pudo leer la foto de Storage.", 502);

  try {
    const { json } = await structuredCall({
      kind: "analisis_foto",
      userId,
      modelKind: "vision",
      name: "analisis_foto",
      schema: photoJsonSchema,
      instructions: PHOTO_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: attachment.caption
                ? `Pie de foto del usuario: ${attachment.caption}`
                : "Foto tomada durante el trabajo en el laboratorio.",
            },
            { type: "input_image", image_url: signed.data.signedUrl, detail: "low" },
          ],
        },
      ],
    });
    const parsed = photoSchema.parse(json);
    const tags = [
      parsed.activity && `actividad:${parsed.activity}`,
      parsed.object_type && `objeto:${parsed.object_type.toLowerCase()}`,
      ...parsed.sample_codes.map((c) => `muestra:${c}`),
    ].filter((t): t is string => Boolean(t));

    const { data, error } = await supabase
      .from("attachments")
      .update({
        ai_description: parsed.description,
        ai_extracted_text: parsed.extracted_text,
        ai_tags: tags,
        ai_status: "procesado",
      })
      .eq("id", attachment.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    await supabase.from("attachments").update({ ai_status: "error" }).eq("id", attachment.id);
    throw e;
  }
}
