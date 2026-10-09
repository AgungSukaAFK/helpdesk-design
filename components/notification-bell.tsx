"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/components/providers/notification-provider";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead: markRead, markAllRead } = useNotifications();
  const router = useRouter();

  const markAsRead = async (id: string, link: string | null) => {
    await markRead(id);
    if (link) router.push(link);
  };

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    void markAllRead();
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
