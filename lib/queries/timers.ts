"use client";

import { createClient } from "@/lib/supabase/client";

// Temporizadores de pasos (§6.2): un recordatorio único que el cron envía como notificación push
// al terminar el tiempo, aunque la app esté cerrada. Al terminar el paso antes, se cancela.

export async function scheduleTimer(opts: {
  entryId: string;
  title: string;
  body: string;
  fireAt: Date;
}): Promise<string | null> {
  const { data, error } = await createClient()
    .from("reminders")
    .insert({
      kind: "temporizador",
      title: opts.title,
      body: opts.body,
      fire_at: opts.fireAt.toISOString(),
      entry_id: opts.entryId,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("No se pudo programar el temporizador", error);
    return null;
  }
  return data.id;
}

export async function cancelTimer(id: string | null | undefined) {
  if (!id) return;
  await createClient().from("reminders").update({ enabled: false }).eq("id", id);
}
