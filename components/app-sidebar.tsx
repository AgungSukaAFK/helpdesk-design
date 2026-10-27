"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "./nav-user";
import { useTopbarProfileData } from "@/components/topbar/topbar";
import { useNotifications } from "@/components/providers/notification-provider";
import { buildNavGroups, findActiveUrl } from "@/lib/sidebar/nav-config";
import { X } from "lucide-react";
import Image from "next/image";

function SidebarLogo() {
  const { isMobile, setOpenMobile } = useSidebar();
  const [imgError, setImgError] = React.useState(false);

  return (
    <div className="flex min-h-12 items-center justify-between px-0  w-full">
      <div className="flex h-full justify-center items-center gap-2 overflow-hidden w-full">
        {!imgError ? (
          <Image
            src="/lourdes.png"
            width={320}
            height={320}
            alt="Lourdes Autoparts"
            className="w-full max-w-[80%] shrink-0 object-contain"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs shrink-0">
            L
          </div>
        )}
      </div>
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setOpenMobile(false)}
          title="Tutup menu"
        >
          <X className="size-4" />
          <span className="sr-only">Tutup menu</span>
        </Button>
      )}
    </div>
  );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const currentPath = usePathname();
  const { profile, loading } = useTopbarProfileData();
  const { unreadCount } = useNotifications();

  const groups = React.useMemo(() => buildNavGroups(profile?.role), [profile?.role]);
  const activeUrl = findActiveUrl(
    currentPath,
    groups.flatMap((g) => g.items.map((i) => i.url)),
  );
  const badges: Record<string, number | undefined> = {
    "/notifikasi": unreadCount || undefined,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent className="gap-1">
        {loading ? (
          // Menu bergantung role, jadi jangan tampilkan menu user biasa sebelum profil siap.
          <SidebarGroup>
            <SidebarMenu>
              {Array.from({ length: 8 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          groups.map((group) => (
            <NavMain
              key={group.label}
              label={group.label}
              items={group.items.map((item) => ({
                ...item,
                isActive: item.url === activeUrl,
                badge: badges[item.url],
              }))}
            />
          ))
        )}
      </SidebarContent>

      <SidebarFooter>
        {profile && (
          <NavUser
            user={{
              avatar: profile.avatarUrl || "",
              email: profile.email,
              name: profile.name || "-",
            }}
          />
        )}
      </SidebarFooter>

      <SidebarRail className="bg-transparent" />
    </Sidebar>
  );
}
