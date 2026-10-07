"use client";

import { createClient } from "@/lib/supabase/client";

// Suscripción a notificaciones push desde el navegador (§8). Nunca se pide permiso al abrir la
// app: solo cuando el usuario toca "Activar" en Ajustes.

export function pushSupport() {
  if (typeof window === "undefined") return { supported: false, needsInstall: false };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // En iOS el push solo existe con la app instalada en la pantalla de inicio (iOS 16.4+).
  return { supported, needsInstall: ios && !standalone, ios, standalone };
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function subscribePush() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "No diste permiso de notificaciones. Puedes activarlo en los ajustes del navegador.",
    );
  }
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  const json = sub.toJSON();
  const { error } = await createClient()
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
  return sub;
}

export async function unsubscribePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
