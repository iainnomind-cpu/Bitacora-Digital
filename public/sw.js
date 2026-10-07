// Service worker de la Bitácora (§8). Etapa 9: notificaciones push.
// (La caché para trabajar sin conexión se agrega en la etapa 10.)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// El servidor manda { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Bitácora", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      lang: "es-MX",
      data: { url: data.url || "/hoy" },
    }),
  );
});

// Al tocar la notificación: enfocar una ventana abierta de la app o abrir la vista indicada.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/hoy", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.navigate(target).then((c) => (c || w).focus());
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
