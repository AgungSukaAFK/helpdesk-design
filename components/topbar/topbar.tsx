"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { resolveNavRole, type NavRole } from "@/lib/sidebar/nav-config";
import { TopbarInbox } from "./topbar-inbox";
import { TopbarAppearance } from "./topbar-appearance";
import { TopbarProfile } from "./topbar-profile";

export type TopbarProfileData = {
  id: string;
  email: string;
  name: string | null;
  role: NavRole;
  avatarUrl: string | null;
};

type TopbarContextValue = {
  profile: TopbarProfileData | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const TopbarContext = createContext<TopbarContextValue | undefined>(undefined);

/** Dipancarkan halaman profil saat nama/foto berubah. */
export const PROFILE_UPDATED_EVENT = "profile-updated";

/**
 * Profil user diambil sekali lalu dibagi ke sidebar dan semua bagian top bar.
 */
export function TopbarProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<TopbarProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/auth/login");
        return;
      }
      const { data: row } = await supabase
        .from("user_profiles")
        .select("name, role, avatar_url")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!active) return;
      setProfile({
        id: data.user.id,
        email: data.user.email || "",
        name: row?.name || null,
        role: resolveNavRole(row?.role),
        avatarUrl: row?.avatar_url || null,
      });
      setLoading(false);
    })();

    const onProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; avatar_url?: string | null }>).detail || {};
      setProfile((current) => {
        if (!current) return current;
        return {
          ...current,
          ...("avatar_url" in detail ? { avatarUrl: detail.avatar_url || null } : {}),
          ...(detail.name ? { name: detail.name } : {}),
        };
      });
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    };
  }, [supabase, router]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }, [supabase, router]);

  return (
    <TopbarContext.Provider value={{ profile, loading, logout }}>{children}</TopbarContext.Provider>
  );
}

export function useTopbarProfileData() {
  const context = useContext(TopbarContext);
  if (context === undefined) {
    throw new Error("useTopbarProfileData must be used within a TopbarProvider");
  }
  return context;
}

export function getInitials(name: string | null | undefined, email: string) {
  return (
    (name && name !== "-" ? name : email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

/** Urutan sesuai panduan: Inbox → Tampilan → pemisah → Profil. */
export function TopbarActions() {
  return (
    <div className="flex items-center gap-1">
      <TopbarInbox />
      <TopbarAppearance />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <TopbarProfile />
    </div>
  );
}
