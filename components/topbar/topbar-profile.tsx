"use client";

import { useState } from "react";
import Link from "next/link";
import { Image as ImageIcon, LogOut, SquareUserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { getInitials, useTopbarProfileData } from "./topbar";

export function TopbarProfile() {
  const { profile, loading, logout } = useTopbarProfileData();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  if (loading || !profile) {
    return <Skeleton className="size-8 shrink-0 rounded-full sm:size-9" />;
  }

  const displayName = profile.name || profile.email;
  const initials = getInitials(profile.name, profile.email);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={displayName}
            aria-label={`Menu profil ${displayName}`}
            className="flex shrink-0 items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent lg:pr-3"
          >
            <Avatar className="size-7 sm:size-8">
              <AvatarImage src={profile.avatarUrl || undefined} alt={displayName} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium lg:inline">{displayName}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="w-[min(16rem,calc(100vw-1rem))]"
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="size-9">
                <AvatarImage src={profile.avatarUrl || undefined} alt={displayName} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 leading-tight">
                <span className="truncate font-medium">{profile.name || "-"}</span>
                <span className="truncate text-xs text-muted-foreground">{profile.email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile" className="cursor-pointer">
              <SquareUserRound />
              My Profile
            </Link>
          </DropdownMenuItem>
          {profile.avatarUrl && (
            <DropdownMenuItem className="cursor-pointer" onSelect={() => setPhotoOpen(true)}>
              <ImageIcon />
              Lihat Foto Profil
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
            onSelect={() => setLogoutOpen(true)}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Keluar dari akun?"
        description="Anda perlu login lagi untuk membuka DesignDesk."
        confirmText="Log out"
        destructive
        onConfirm={logout}
      />

      {profile.avatarUrl && (
        <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
          <DialogContent className="max-w-sm p-3 sm:max-w-md">
            <DialogTitle className="sr-only">Foto profil {displayName}</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.avatarUrl} alt={`Foto profil ${displayName}`} className="w-full rounded-md object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
