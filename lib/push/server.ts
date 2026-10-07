import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import type { Tables } from "@/lib/supabase/database.types";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
type Subscription = Pick<Tables<"push_subscriptions">, "id" | "endpoint" | "p256dh" | "auth">;

let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("Faltan las claves VAPID.");
  // Apple y Google piden un contacto: un mailto: o una URL https.
  const subject = /^mailto:.+@.+/.test(process.env.VAPID_SUBJECT ?? "")
    ? process.env.VAPID_SUBJECT!
    : process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")
      ? process.env.NEXT_PUBLIC_SITE_URL
      : "mailto:bitacora@localhost";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Envía una notificación a varias suscripciones. Regresa los ids enviados y los que ya no
 * existen (404/410), que el llamador debe borrar (§8).
 */
export async function sendPush(subscriptions: Subscription[], payload: PushPayload) {
  configure();
  const sent: string[] = [];
  const gone: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 6 * 3600, urgency: "normal" },
        );
        sent.push(s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else {
          failed.push(s.id);
          console.warn("[push] falló", status, (e as Error).message);
        }
      }
    }),
  );
  return { sent, gone, failed };
}

/** Los crons (Vercel Cron o pg_cron) mandan `Authorization: Bearer ${CRON_SECRET}`. */
export function cronUnauthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}
