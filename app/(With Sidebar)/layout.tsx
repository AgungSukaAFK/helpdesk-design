"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TopbarActions, TopbarProvider } from "@/components/topbar/topbar";
import { TopbarBreadcrumb } from "@/components/topbar/topbar-breadcrumb";
import { TopbarSearch } from "@/components/topbar/topbar-search";
import { getCurrentProfile, getCurrentUser, peekCurrentProfile } from "@/lib/supabase/current-user";
import { redirect, usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function isDesignerAllowedRoute(pathname: string) {
  const isRequestWorkRoute = pathname === "/permintaan-desain" || (
    /^\/permintaan-desain\/[^/]+(?:\/edit)?$/.test(pathname) &&
    pathname !== "/permintaan-desain/buat"
  );
  return (
    pathname === "/dashboard" ||
    pathname === "/daily-activity" ||
    pathname === "/riwayat-pengerjaan" ||
    pathname === "/artikel-admin" ||
    pathname === "/notifikasi" ||
    pathname === "/profile" ||
    pathname === "/feedback" ||
    pathname === "/qcc" ||
    pathname === "/dokumentasi" ||
    pathname === "/tentang-app" ||
    pathname.startsWith("/artikel-admin/") ||
    pathname === "/dokumen-desain" ||
    pathname.startsWith("/dokumen-desain/") ||
    pathname === "/bast" ||
    pathname.startsWith("/bast/") ||
    isRequestWorkRoute
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // undefined = role belum diketahui. Setelah diketahui, pindah halaman dicek tanpa request ulang.
  const [role, setRole] = useState<string | null | undefined>(
    () => {
      const cached = peekCurrentProfile();
      return cached === undefined ? undefined : (cached?.role ?? null);
    },
  );

  useEffect(() => {
    let active = true;
    getCurrentProfile().then(async (profile) => {
      if (!active) return;
      if (!profile) {
        // Session hilang -> login. Profil gagal dimuat -> tetap izinkan (perilaku lama).
        const { data: { user } } = await getCurrentUser().catch(() => ({ data: { user: null } }));
        if (!active) return;
        if (!user) router.replace("/auth/login");
        else setRole(null);
        return;
      }
      setRole(profile.role ?? null);
      if (!profile.name) {
        toast.warning("Anda belum melengkapi informasi akun.", {
          action: {
            label: "Lengkapi Profil",
            onClick: () => {
              redirect("/profile");
            },
          },
        });
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  const designerBlocked = role === "designer" && !isDesignerAllowedRoute(pathname);

  useEffect(() => {
    if (designerBlocked) router.replace("/dashboard");
  }, [designerBlocked, router]);

  // TopbarProvider di luar pengecekan akses supaya profil tidak diambil ulang tiap pindah halaman.
  if (role === undefined || designerBlocked) {
    return (
      <TopbarProvider>
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </TopbarProvider>
    );
  }

  return (
    <TopbarProvider>
      <SidebarProvider>
        <AppSidebar className="shadow-lg" />
        <SidebarInset className="min-w-0">
          <header
            className={[
              "sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-border/60 bg-background/90 backdrop-blur-md print:hidden",
              "transition-[height] ease-linear md:h-16 md:backdrop-blur-xl md:backdrop-saturate-150",
              "md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
              // Garis gradien aksen tipis di bawah header
              "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary/30 after:to-transparent",
            ].join(" ")}
          >
            <div className="flex w-full min-w-0 items-center gap-2 px-3 sm:px-4">
              <SidebarTrigger className="-ml-1 shrink-0" />
              <Separator
                orientation="vertical"
                className="mr-1 hidden data-[orientation=vertical]:h-4 sm:block"
              />
              <TopbarBreadcrumb />
              <div className="flex shrink-0 items-center lg:w-full lg:max-w-md">
                <TopbarSearch />
              </div>
              <div className="flex shrink-0 items-center justify-end lg:flex-1">
                <TopbarActions />
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 lg:p-6 pt-3 sm:pt-4 min-w-0">
            <div className="grid grid-cols-12 items-start gap-4 sm:gap-5 lg:gap-6 auto-rows-auto min-w-0">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TopbarProvider>
  );
}
