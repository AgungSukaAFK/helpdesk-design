"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { loadNotifSettings } from "@/lib/notifications/settings";
import { playCustomSound, playSound, unlockAudio } from "@/lib/notifications/sound";

export interface AppNotification {
  id: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  userId: string | null;
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const INITIAL_LIMIT = 50;
const NOTIF_ICON = "/lourdes.png";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  // Dibuat sekali: kalau dibuat ulang tiap render, channel subscribe ulang & suara dobel.
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  // Alert tidak dibunyikan sebelum fetch awal selesai.
  const isInitialLoad = useRef(true);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, link, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(INITIAL_LIMIT);
    if (error) console.error("[Notif] fetch failed:", error.message);
    else setNotifications(data ?? []);
    setLoading(false);
    isInitialLoad.current = false;
  }, [supabase, userId]);

  // Ikuti status login (provider dipasang di root layout, termasuk halaman auth).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Gesture pertama: minta izin notifikasi browser & buka kunci audio.
  useEffect(() => {
    const onGesture = () => {
      if ("Notification" in window && Notification.permission === "default" && loadNotifSettings().browser) {
        Notification.requestPermission().catch(() => {});
      }
      unlockAudio();
      window.removeEventListener("click", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    window.addEventListener("click", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("click", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  const alertNotification = useCallback((n: AppNotification) => {
    const s = loadNotifSettings();
    if (!s.enabled) return;
    if (s.sound) {
      if (s.soundType === "custom") {
        playCustomSound(s.volume).then((ok) => { if (!ok) playSound("tritone", s.volume); });
      } else {
        playSound(s.soundType, s.volume);
      }
    }
    if (s.browser && "Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
      try {
        const notif = new Notification(n.title, {
          body: n.message ?? "",
          icon: NOTIF_ICON,
          badge: NOTIF_ICON,
          tag: n.link ?? n.id,
        });
        notif.onclick = () => {
          window.focus();
          if (n.link) router.push(n.link);
          notif.close();
        };
      } catch {}
    }
    toast.info(n.title, {
      description: n.message ?? undefined,
      action: n.link ? { label: "Lihat", onClick: () => router.push(n.link!) } : undefined,
    });
  }, [router]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    isInitialLoad.current = true;
    setLoading(true);

    (async () => {
      await refreshNotifications();
      // Tanpa setAuth websocket konek sebagai anon dan RLS memblokir semua event.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`realtime-notifications-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            const n = payload.new as AppNotification;
            setNotifications((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
            if (!isInitialLoad.current) alertNotification(n);
          },
        )
        .subscribe((status) => {
          console.info("[Notif] realtime status:", status);
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, userId, refreshNotifications, alertNotification]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) console.error("[Notif] mark read failed:", error.message);
  }, [supabase]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) console.error("[Notif] mark all read failed:", error.message);
  }, [supabase, userId]);

  return (
    <NotificationContext.Provider
      value={{ userId, notifications, unreadCount, loading, refreshNotifications, markAsRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
