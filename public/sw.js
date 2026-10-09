// Service Worker khusus Web Push, tanpa caching.
self.addEventListener("push", (event) => {
  let payload = { title: "DesignDesk", body: "Ada notifikasi baru." };
  if (event.data) {
    try { payload = event.data.json(); }
    catch { payload = { title: "DesignDesk", body: event.data.text() }; }
  }
  const title = payload.title || "DesignDesk";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "",
    icon: "/lourdes.png",
    badge: "/lourdes.png",
    data: { url: payload.url || "/notifikasi" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/notifikasi";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        return existing.navigate(target).then(() => existing.focus());
      }
      return self.clients.openWindow(target);
    })
  );
});
