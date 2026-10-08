import "server-only";
import type OpenAI from "openai";
import { AiError, type requireUser } from "./server";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Fotos y PDF que el usuario subió a su carpeta `protocolos/` → contenido para el modelo.
 * Las fotos van por URL firmada en detalle alto (hay que leer texto); los PDF, en base64.
 */
export async function protocolFilesContent(
  supabase: Supabase,
  userId: string,
  paths: string[],
): Promise<OpenAI.Responses.ResponseInputContent[]> {
  if (paths.some((p) => !p.startsWith(`${userId}/protocolos/`))) {
    throw new AiError("Archivo no válido.", 403);
  }
  const content: OpenAI.Responses.ResponseInputContent[] = [];
  for (const path of paths) {
    if (path.endsWith(".pdf")) {
      const file = await supabase.storage.from("attachments").download(path);
      if (file.error) throw new AiError("No se pudo leer el PDF.", 502);
      const base64 = Buffer.from(await file.data.arrayBuffer()).toString("base64");
      content.push({
        type: "input_file",
        filename: "protocolo.pdf",
        file_data: `data:application/pdf;base64,${base64}`,
      });
    } else {
      const signed = await supabase.storage.from("attachments").createSignedUrl(path, 600);
      if (signed.error) throw new AiError("No se pudo leer una foto.", 502);
      content.push({ type: "input_image", image_url: signed.data.signedUrl, detail: "high" });
    }
  }
  return content;
}
