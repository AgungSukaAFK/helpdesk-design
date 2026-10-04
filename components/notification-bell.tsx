"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { playNotificationAudio } from "@/lib/notification-audio";
import { readNotificationPreferences } from "@/lib/notification-preferences";
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

let userIdPromise: Promise<string> | null = null;

function resolveUserId(): Promise<string> {
  if (!userIdPromise) {
    userIdPromise = createClient()
      .auth.getUser()
      .then(({ data }) => data.user?.id ?? "")
      .catch(() => "");
  }
  return userIdPromise;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const prevUnreadCount = useRef(0);
  const isFirstLoad = useRef(true);

  const playNotificationSound = async () => {
    try {
      const userId = await resolveUserId();
      await playNotificationAudio(readNotificationPreferences(userId));
    } catch (e) {
      console.error("Failed to play notification sound", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Polling every minute
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) {
        const newUnread = json.data.filter((n: Notification) => !n.is_read).length;
        
        // If unread count increased and it's not the first load, play sound
        if (!isFirstLoad.current && newUnread > prevUnreadCount.current) {
          void playNotificationSound();
        }
        
        setNotifications(json.data);
        setUnreadCount(newUnread);
        
        prevUnreadCount.current = newUnread;
        isFirstLoad.current = false;
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  const markAsRead = async (id: string, link: string | null) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      // Update local state immediately
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      if (link) {
        router.push(link);
      }
    } catch (e) {
      console.error("Failed to mark as read", e);
    }
  };

  const markAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read_all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all as read", e);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-background z-10">
          <h4 className="font-semibold text-sm">Notifikasi</h4>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead} 
              className="text-xs text-primary hover:underline font-medium"
            >
              Tandai semua dibaca
            </button>
          )}
        </div>
        <div className="flex flex-col">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Belum ada notifikasi.
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem 
                key={n.id} 
                className={cn(
                  "flex flex-col items-start p-3 gap-1 border-b last:border-0 cursor-pointer focus:bg-muted/50",
                  !n.is_read && "bg-primary/5"
                )}
                onClick={() => markAsRead(n.id, n.link)}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className={cn("text-xs font-semibold", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                    {n.title}
                  </span>
                  {!n.is_read && (
                    <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1"></span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {n.message}
                </p>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString("id-ID", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
