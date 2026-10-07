import { NextResponse } from "next/server";
import { AiError, errorResponse, requireUser } from "@/lib/ai/server";
import { sendPush } from "@/lib/push/server";

/** Envía una notificación de prueba a todos los dispositivos del usuario (§10). */
export async function POST() {
  try {
    const { supabase } = await requireUser();
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (error) throw error;
    if (!subs.length)
      throw new AiError("Activa las notificaciones en este dispositivo primero.", 404);

    const result = await sendPush(subs, {
      title: "Bitácora",
      body: "Notificación de prueba: los recordatorios llegarán así.",
      url: "/ajustes",
      tag: "prueba",
    });
    if (result.gone.length)
      await supabase.from("push_subscriptions").delete().in("id", result.gone);
    if (result.sent.length) {
      await supabase
        .from("push_subscriptions")
        .update({ last_success_at: new Date().toISOString() })
        .in("id", result.sent);
    }
    return NextResponse.json({ sent: result.sent.length, removed: result.gone.length });
  } catch (e) {
    return errorResponse(e);
  }
}
