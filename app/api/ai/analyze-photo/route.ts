import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { analyzePhoto, photoContext } from "@/lib/ai/photo";
import { AiError, enforceDailyLimit, errorResponse, requireUser } from "@/lib/ai/server";

export const maxDuration = 60;

const bodySchema = z.object({ attachment_id: z.uuid() });

/** Describe una foto, lee su texto y la etiqueta (§7.6). */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireUser();
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new AiError("Falta attachment_id.");

    const { data: attachment } = await supabase
      .from("attachments")
      .select("id, kind, storage_path, caption")
      .eq("id", body.data.attachment_id)
      .maybeSingle();
    if (!attachment || attachment.kind !== "foto")
      throw new AiError("No se encontró la foto.", 404);

    await enforceDailyLimit(supabase);
    const updated = await analyzePhoto(supabase, userId, attachment, await photoContext(supabase));
    return NextResponse.json({ attachment: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
