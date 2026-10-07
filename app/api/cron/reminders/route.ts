import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { isDue, localDayAndWeekday, parseSchedule } from "@/lib/push/schedule";
import { cronUnauthorized, sendPush, type PushPayload } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const URLS: Record<string, string> = {
  inicio_dia: "/hoy",
  cierre_dia: "/hoy",
  revision_semanal: "/buscar",
  personalizado: "/hoy",
  temporizador: "/hoy",
};

/**
 * Envío programado de recordatorios (§8). Lo llama un cron cada 5–15 min (pg_cron en Supabase,
 * ver README) con `Authorization: Bearer ${CRON_SECRET}`. Calcula en la zona horaria de cada
 * usuario qué recordatorios tocan, los envía y marca last_sent_at para no repetir.
 */
async function handle(request: NextRequest) {
  const denied = cronUnauthorized(request);
  if (denied) return denied;

  const db = createAdminClient();
  const now = new Date();
  const [{ data: reminders, error }, { data: profiles }, { data: subs }] = await Promise.all([
    db.from("reminders").select("*").eq("enabled", true),
    db.from("profiles").select("user_id, timezone"),
    db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tz = new Map((profiles ?? []).map((p) => [p.user_id, p.timezone || DEFAULT_TIMEZONE]));
  const due = (reminders ?? []).filter((r) =>
    isDue({
      now,
      timeZone: tz.get(r.user_id) ?? DEFAULT_TIMEZONE,
      schedule: parseSchedule(r.schedule),
      fireAt: r.fire_at,
      lastSentAt: r.last_sent_at,
    }),
  );

  let sent = 0;
  const gone: string[] = [];
  for (const r of due) {
    const userSubs = (subs ?? []).filter((s) => s.user_id === r.user_id);
    const payload: PushPayload = {
      title: r.title,
      body: r.body ?? "",
      url: r.entry_id ? `/entrada/${r.entry_id}` : (URLS[r.kind] ?? "/hoy"),
      tag: r.kind,
    };

    // Cierre del día: avisar también de borradores sin cerrar de días anteriores (§8).
    if (r.kind === "cierre_dia") {
      const { day } = localDayAndWeekday(now, tz.get(r.user_id) ?? DEFAULT_TIMEZONE);
      const { count } = await db
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", r.user_id)
        .eq("status", "borrador")
        .lt("entry_date", day);
      if (count) {
        payload.body += ` Tienes ${count} ${count === 1 ? "borrador" : "borradores"} de días anteriores sin cerrar.`;
      }
    }

    // Se marca aunque no haya dispositivos: el recordatorio "ya tocó" en esta ventana.
    // Los temporizadores y recordatorios únicos se desactivan al dispararse.
    await db
      .from("reminders")
      .update({ last_sent_at: now.toISOString(), ...(r.fire_at ? { enabled: false } : {}) })
      .eq("id", r.id);
    if (!userSubs.length) continue;
    const result = await sendPush(userSubs, payload);
    sent += result.sent.length;
    gone.push(...result.gone);
    if (result.sent.length) {
      await db
        .from("push_subscriptions")
        .update({ last_success_at: now.toISOString() })
        .in("id", result.sent);
    }
  }
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);

  return NextResponse.json({ due: due.length, sent, removed: gone.length });
}

export const GET = handle;
export const POST = handle;
