// Service Worker: Web Push + fallback offline sederhana (data selalu dari network).
const CACHE = "designdesk-v1";
const OFFLINE_URL = "/offline.html";
const ICON = "/icons/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, ICON])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Hanya navigasi halaman: kalau offline tampilkan offline.html, selain itu biarkan browser.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "DesignDesk", body: "Ada notifikasi baru." };
  if (event.data) {
    try { payload = event.data.json(); }
    catch { payload = { title: "DesignDesk", body: event.data.text() }; }
  }
  const title = payload.title || "DesignDesk";
  const url = payload.url || "/notifikasi";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "",
    icon: ICON,
    // Tag sama dengan notifikasi in-app supaya tidak dobel di desktop.
    tag: url,
    renotify: true,
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/notifikasi";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        return existing.navigate(target).then((client) => (client || existing).focus());
      }
      return self.clients.openWindow(target);
    })
  );
});
