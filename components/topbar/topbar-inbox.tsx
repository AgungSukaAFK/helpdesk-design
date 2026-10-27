"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/components/providers/notification-provider";
import { findNavItem } from "@/lib/sidebar/nav-config";
import { cn } from "@/lib/utils";
import { TopbarIconButton } from "./topbar-icon-button";

export const INBOX_MAX_AGE_DAYS = 7;
export const INBOX_MAX_ITEMS = 20;

type InboxFilter = "all" | "unread";

export function TopbarInbox() {
  const router = useRouter();
  const { notifications, unreadCount, loading, markAsRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");

  const recent = useMemo(() => {
    const cutoff = Date.now() - INBOX_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    return notifications
      .filter((n) => new Date(n.created_at).getTime() >= cutoff)
      .slice(0, INBOX_MAX_ITEMS);
  }, [notifications]);
  const recentUnread = recent.filter((n) => !n.is_read).length;
  const items = filter === "unread" ? recent.filter((n) => !n.is_read) : recent;

  const openItem = (id: string, link: string | null) => {
    void markAsRead(id);
    setOpen(false);
    router.push(link || "/notifikasi");
  };

  const chips: { value: InboxFilter; label: string; count: number }[] = [
    { value: "all", label: "Semua", count: recent.length },
    { value: "unread", label: "Belum dibaca", count: recentUnread },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TopbarIconButton label="Inbox" badge={unreadCount}>
          <Inbox />
        </TopbarIconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="flex w-[min(24rem,calc(100vw-1rem))] flex-col p-0"
      >
        <div className="flex items-center gap-2 px-3 pt-3">
          <h4 className="text-sm font-semibold">Inbox</h4>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {unreadCount} baru
            </span>
          )}
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs"
              onClick={() => void markAllRead()}
            >
              <CheckCheck />
              Tandai semua dibaca
            </Button>
          )}
        </div>

        <div className="scrollbar-none flex gap-1.5 overflow-x-auto border-b px-3 py-2">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={filter === chip.value}
              onClick={() => setFilter(chip.value)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent",
                filter === chip.value && "border-primary bg-primary/10 text-primary hover:bg-primary/15",
              )}
            >
              {chip.label}
              <span className="tabular-nums text-muted-foreground">{chip.count}</span>
            </button>
          ))}
        </div>

        <div className="max-h-[min(26rem,calc(100dvh-12rem))] overflow-y-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Memuat…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <Inbox className="size-8 opacity-50" />
              <p className="text-sm">{filter === "unread" ? "Semua sudah dibaca" : "Inbox kosong"}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const source = n.link ? findNavItem(n.link.split("?")[0]) : null;
                const SourceIcon = source?.icon ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n.id, n.link)}
                      className={cn(
                        "relative flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
                        !n.is_read && "bg-primary/[0.06]",
                      )}
                    >
                      {!n.is_read && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <SourceIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span
                            className={cn(
                              "flex-1 text-sm leading-snug",
                              n.is_read ? "text-muted-foreground" : "font-semibold text-foreground",
                            )}
                          >
                            {n.title}
                          </span>
                          {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                        </span>
                        {n.message && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.message}</span>
                        )}
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {source?.title ?? "Notifikasi"} ·{" "}
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: localeId })}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            {INBOX_MAX_AGE_DAYS} hari terakhir, maks. {INBOX_MAX_ITEMS} item
          </span>
          <Link
            href="/notifikasi"
            onClick={() => setOpen(false)}
            className="font-medium text-primary hover:underline"
          >
            Semua notifikasi
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
