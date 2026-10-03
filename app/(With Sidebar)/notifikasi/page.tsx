"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Bell, Check, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotifikasiPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string, link: string | null) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      if (link) {
        router.push(link);
      }
    } catch (e) {
      console.error("Failed to mark as read", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read_all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error("Failed to mark all as read", e);
    }
  };

  return (
    <Content title="Notifikasi" size="lg">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Semua Notifikasi
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pemberitahuan aktivitas dan update status terbaru Anda.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
            <Check className="h-4 w-4" />
            Tandai Semua Dibaca
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Memuat notifikasi...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-primary/50" />
            </div>
            <h3 className="text-lg font-semibold">Belum Ada Notifikasi</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Anda tidak memiliki notifikasi baru saat ini.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => markAsRead(n.id, n.link)}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:border-primary/50 hover:shadow-sm",
                  !n.is_read ? "bg-primary/5 border-primary/20" : "bg-card border-border"
                )}
              >
                <div className={cn(
                  "h-10 w-10 shrink-0 rounded-full flex items-center justify-center mt-0.5",
                  !n.is_read ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <Bell className="h-5 w-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className={cn("text-base font-semibold truncate", !n.is_read ? "text-foreground" : "text-foreground/80")}>
                      {n.title}
                    </h4>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(n.created_at).toLocaleString("id-ID", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {n.message}
                  </p>
                </div>

                {n.link && (
                  <div className="hidden sm:flex shrink-0 items-center justify-center self-center text-muted-foreground">
                    <ArrowRight className="h-5 w-5 opacity-50 transition-opacity group-hover:opacity-100" />
                  </div>
                )}
                
                {!n.is_read && (
                  <div className="shrink-0 self-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-sm shadow-primary/50"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Content>
  );
}
