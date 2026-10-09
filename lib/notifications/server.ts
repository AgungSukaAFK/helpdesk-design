import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

export interface NotificationRow {
  user_id: string;
  title: string;
  message?: string | null;
  link?: string | null;
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

/**
 * Simpan notifikasi in-app lalu kirim Web Push ke semua device penerima.
 * `admin` harus client service role (insert notifications & baca semua
 * push_subscriptions bypass RLS). Penerima = actor dilewati.
 */
export async function createNotifications(
  admin: SupabaseClient,
  rows: NotificationRow[],
  options: { actorId?: string } = {},
) {
  const seen = new Set<string>();
  const filtered = rows.filter((row) => {
    if (!row.user_id || row.user_id === options.actorId || seen.has(row.user_id)) return false;
    seen.add(row.user_id);
    return true;
  });
  if (filtered.length === 0) return;

  const { error } = await admin.from("notifications").insert(
    filtered.map((row) => ({
      user_id: row.user_id,
      title: row.title,
      message: row.message ?? null,
      link: row.link ?? null,
    })),
  );
  if (error) {
    console.error("[Notification] Insert failed:", error.message);
    return;
  }

  try {
    await sendPush(admin, filtered);
  } catch (err) {
    console.error("[Notification] Push channel failed:", err);
  }
}

async function sendPush(admin: SupabaseClient, rows: NotificationRow[]) {
  if (!pushConfigured) return;

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", rows.map((row) => row.user_id));
  if (error) throw error;
  if (!subs || subs.length === 0) return;

  const rowByUser = new Map(rows.map((row) => [row.user_id, row]));
  const staleIds: number[] = [];
  await Promise.all(subs.map(async (sub) => {
    const row = rowByUser.get(sub.user_id);
    if (!row) return;
    const body = JSON.stringify({ title: row.title, body: row.message || "", url: row.link || "/notifikasi" });
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) staleIds.push(sub.id);
      else console.error("[push] Send failed:", (err as Error)?.message || err);
    }
  }));
  if (staleIds.length > 0) await admin.from("push_subscriptions").delete().in("id", staleIds);
}
