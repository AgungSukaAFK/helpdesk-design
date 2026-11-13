"use client";

import { createClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

export type PushSubscriptionStatus = "subscribed" | "unsubscribed" | "unsupported";

/**
 * Aktif hanya kalau browser punya subscription DAN server menyimpannya untuk
 * user ini. Cek browser saja menyesatkan: barisnya bisa sudah dihapus server
 * (endpoint kedaluwarsa) atau pindah ke akun lain yang login di browser yang sama.
 */
export async function getPushSubscriptionStatus(userId?: string | null): Promise<PushSubscriptionStatus> {
  if (!isPushSupported()) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "unsubscribed";
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return "unsubscribed";
    if (!userId) return "subscribed";
    return (await isSavedForUser(userId, subscription.endpoint)) ? "subscribed" : "unsubscribed";
  } catch {
    return "unsubscribed";
  }
}

async function isSavedForUser(userId: string, endpoint: string): Promise<boolean> {
  const { data, error } = await createClient()
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function saveSubscription(userId: string, subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Gagal membuat subscription push (data tidak lengkap).");
  }
  const { error } = await createClient().from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

function newSubscription(registration: ServiceWorkerRegistration) {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
  });
}

/**
 * Dipanggil otomatis tiap user login/membuka app. Kalau perangkat ini sudah
 * mengaktifkan Notifikasi HP tapi server tidak punya barisnya untuk user ini
 * (dihapus karena kedaluwarsa, atau terakhir dipakai akun lain), buat
 * subscription baru lalu simpan untuk user yang sedang login.
 * Tidak meminta izin apa pun: hanya jalan kalau izin sudah "granted".
 */
export async function syncPushSubscription(userId: string): Promise<void> {
  if (!isPushSupported() || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const current = await registration.pushManager.getSubscription();
  // Belum pernah diaktifkan / sengaja dimatikan user: hormati pilihannya.
  if (!current) return;
  if (await isSavedForUser(userId, current.endpoint)) return;

  // Endpoint lama mungkin sudah mati (server menghapusnya karena 404/410),
  // jadi ganti dengan subscription baru alih-alih menyimpan ulang yang lama.
  await current.unsubscribe().catch(() => {});
  await saveSubscription(userId, await newSubscription(registration));
}

/** HARUS dipanggil dari klik tombol (requestPermission butuh user gesture). */
export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notification tidak didukung di browser ini. Di iPhone, tambahkan dulu situs ini ke Home Screen lewat Safari (Share > Add to Home Screen), lalu buka dari ikonnya.");
  }
  // iOS: Push hanya aktif sebagai home-screen app; di tab Safari biasa izin selalu "denied" diam-diam.
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIOS && !isStandalone) {
    throw new Error("Di iPhone, notifikasi cuma bisa aktif kalau web ini sudah di-install ke Home Screen. Install dulu lewat tombol Install di atas, buka dari ikonnya, baru aktifkan Notifikasi HP.");
  }
  if (Notification.permission === "denied") {
    throw new Error("Notifikasi diblokir di browser ini. Buka pengaturan situs (ikon gembok/info di address bar) > Notifications > Allow, lalu coba lagi.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Izin notifikasi ditolak.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  // Subscription lama yang tidak tercatat untuk user ini bisa saja sudah mati: buat baru.
  if (subscription && !(await isSavedForUser(userId, subscription.endpoint))) {
    await subscription.unsubscribe().catch(() => {});
    subscription = null;
  }
  if (!subscription) subscription = await newSubscription(registration);
  await saveSubscription(userId, subscription);
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await createClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
}
