"use client";

import { useEffect } from "react";

/** Daftarkan /sw.js di setiap halaman agar app bisa di-install & menerima push. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[SW] Register failed:", err);
    });
  }, []);
  return null;
}
