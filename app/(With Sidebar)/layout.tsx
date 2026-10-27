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
import { createClient } from "@/lib/supabase/client";
import { redirect, usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessCheckedPath, setAccessCheckedPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function verifyDesignerRoute() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/auth/login");
          return;
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "designer") {
          const isRequestWorkRoute = pathname === "/permintaan-desain" || (
            /^\/permintaan-desain\/[^/]+(?:\/edit)?$/.test(pathname) &&
            pathname !== "/permintaan-desain/buat"
          );
          const isAllowedRoute =
            pathname === "/dashboard" ||
            pathname === "/daily-activity" ||
            pathname === "/riwayat-pengerjaan" ||
            pathname === "/artikel-admin" ||
            pathname === "/notifikasi" ||
            pathname === "/profile" ||
            pathname === "/feedback" ||
            pathname === "/dokumentasi" ||
            pathname === "/tentang-app" ||
            pathname.startsWith("/artikel-admin/") ||
            isRequestWorkRoute;

          if (!isAllowedRoute) {
            router.replace("/dashboard");
            return;
          }
        }

        if (active) setAccessCheckedPath(pathname);
      } catch {
        if (active) setAccessCheckedPath(pathname);
      }
    }

    verifyDesignerRoute();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    async function fetch() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/auth/login");
      }
      const profileRes = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (!profileRes.data.name) {
        toast.warning("Anda belum melengkapi informasi akun.", {
          action: {
            label: "Lengkapi Profil",
            onClick: () => {
              redirect("/profile");
            },
          },
        });
      }
    }

    fetch();
  }, []);

  // TopbarProvider di luar pengecekan akses supaya profil tidak diambil ulang tiap pindah halaman.
  if (accessCheckedPath !== pathname) {
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
