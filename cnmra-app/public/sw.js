// Service worker de CNMRA: recibe las notificaciones push y las muestra,
// y abre la app cuando se toca la notificación.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let datos = { titulo: "CNMRA", mensaje: "Tenés una novedad nueva en la plataforma.", url: "/familia" };
  try {
    if (event.data) {
      datos = { ...datos, ...event.data.json() };
    }
  } catch {
    // Si el mensaje no viene en JSON, usamos el texto plano como mensaje.
    if (event.data) datos.mensaje = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.mensaje,
      icon: "/logo.jpg",
      badge: "/logo.jpg",
      data: { url: datos.url || "/familia" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/familia";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
