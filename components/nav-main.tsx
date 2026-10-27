"use client";

import { type LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function NavMain({
  items,
  label = "Menu",
}: {
  label?: string;
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    badge?: number;
  }[];
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarGroup className="py-1">
      <SidebarGroupLabel className="uppercase tracking-wide text-[0.7rem]">{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton tooltip={item.title} asChild>
              <Link
                href={item.url}
                aria-current={item.isActive ? "page" : undefined}
                onClick={() => {
                  if (isMobile) {
                    setOpenMobile(false);
                  }
                }}
                className={cn(
                  "w-full flex gap-4 items-center rounded-md px-3 py-2 transition-colors hover:bg-accent",
                  item.isActive && "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary",
                  !!item.badge && "pr-8"
                )}
              >
                {item.icon && <item.icon />}
                <span className="grow text-left truncate">{item.title}</span>
              </Link>
            </SidebarMenuButton>
            {!!item.badge && (
              <SidebarMenuBadge className="rounded-full bg-red-600 text-white peer-hover/menu-button:text-white">
                {item.badge > 99 ? "99+" : item.badge}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
