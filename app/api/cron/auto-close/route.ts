import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { isExpiredDraft } from "@/lib/push/schedule";
import { cronUnauthorized } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Cierra los borradores vencidos (§3): `profiles.auto_close_hours` (48 h por defecto) después
 * del inicio del día de la entrada, en la zona horaria del usuario. El trigger de la base
 * pone closed_at y deja la revisión. Lo llama Vercel Cron una vez al día (vercel.json).
 */
async function handle(request: NextRequest) {
  const denied = cronUnauthorized(request);
  if (denied) return denied;

  const db = createAdminClient();
  const now = new Date();
  const [{ data: drafts, error }, { data: profiles }] = await Promise.all([
    db.from("entries").select("id, user_id, entry_date").eq("status", "borrador"),
    db.from("profiles").select("user_id, timezone, auto_close_hours"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const expired = (drafts ?? []).filter((d) => {
    const p = byUser.get(d.user_id);
    return isExpiredDraft(
      d.entry_date,
      p?.auto_close_hours ?? 48,
      p?.timezone ?? DEFAULT_TIMEZONE,
      now,
    );
  });

  let closed = 0;
  for (const d of expired) {
    const { error: e } = await db
      .from("entries")
      .update({ status: "cerrada" })
      .eq("id", d.id)
      .eq("status", "borrador");
    if (e) console.warn("[auto-close]", d.id, e.message);
    else closed++;
  }
  return NextResponse.json({ checked: drafts?.length ?? 0, closed });
}

export const GET = handle;
export const POST = handle;
