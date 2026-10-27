"use client";

import { ChevronsUpDown, LogOut, Moon, SquareUserRound, Sun } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTopbarProfileData } from "@/components/topbar/topbar";
import { originFromEvent, runViewTransition } from "@/lib/view-transition";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const [logoutDialog, setLogoutDialog] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const { setTheme, resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark" || resolvedTheme === "soft-dark";

  const { isMobile, setOpenMobile } = useSidebar();
  const { logout } = useTopbarProfileData();

  const initials =
    (user.name && user.name !== "-" ? user.name : user.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <ConfirmDialog
        open={logoutDialog}
        onOpenChange={setLogoutDialog}
        title="Keluar dari akun?"
        description="Anda perlu login lagi untuk membuka DesignDesk."
        confirmText="Log out"
        destructive
        onConfirm={logout}
      />

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} className="object-cover" />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar || undefined} alt={user.name} className="object-cover" />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link
                    href="/profile"
                    className="w-full flex items-center gap-2 cursor-pointer"
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                    }}
                  >
                    <SquareUserRound className="size-4" />
                    <span>My Profile</span>
                  </Link>
                </DropdownMenuItem>
                {mounted && (
                  <DropdownMenuItem
                    className="w-full flex items-center gap-2 cursor-pointer"
                    onClick={(e) =>
                      runViewTransition(() => setTheme(isDarkTheme ? "light" : "dark"), {
                        mode: "reveal",
                        origin: originFromEvent(e),
                      })
                    }
                  >
                    {isDarkTheme ? (
                      <>
                        <Sun className="size-4 text-amber-500" />
                        <span>Mode Terang (Light)</span>
                      </>
                    ) : (
                      <>
                        <Moon className="size-4 text-sky-400" />
                        <span>Mode Gelap (Dark)</span>
                      </>
                    )}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
                onClick={() => setLogoutDialog(true)}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
