import { Suspense } from "react";
import * as React from "react";
import { redirect, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "./nav-user";
import {
  GalleryVerticalEnd,
  Bot,
  LayoutDashboard,
  FileBox,
  BookOpen,
  Info,
  Clock,
  Newspaper,
  CalendarCheck2,
  UserCheck,
  FolderKanban,
  ShieldCheck,
  BarChart3,
  Target,
  X,
  MessageSquareDot,
  Bell,
} from "lucide-react";
import Image from "next/image";

const data = {
  teams: [
    {
      name: "Lourdes Autoparts",
      logo: GalleryVerticalEnd,
      plan: "Versi 1.0.0",
    },
  ],
  navAdmin: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Attendance",
      url: "/attendance",
      icon: UserCheck,
    },
    {
      title: "Daily Activity",
      url: "/daily-activity",
      icon: CalendarCheck2,
    },
    {
      title: "Safety Toolbox Meeting HSE",
      url: "/safety-toolbox-meeting-hse",
      icon: ShieldCheck,
    },
    {
      title: "Program Kerja",
      url: "/program-kerja",
      icon: FolderKanban,
    },
    {
      title: "Permintaan Desain",
      url: "/permintaan-desain",
      icon: FileBox,
    },
    {
      title: "KPI",
      url: "/kpi",
      icon: Target,
    },
    {
      title: "Rekap Bulanan",
      url: "/rekap-bulanan",
      icon: BarChart3,
    },
    {
      title: "Riwayat Pengerjaan",
      url: "/riwayat-pengerjaan",
      icon: Clock,
    },
    {
      title: "Review & Rating",
      url: "/feedback",
      icon: MessageSquareDot,
    },
    {
      title: "Artikel",
      url: "/artikel-admin",
      icon: Newspaper,
    },
    {
      title: "User Management",
      url: "/user-management",
      icon: Bot,
    },
    {
      title: "Notifikasi",
      url: "/notifikasi",
      icon: Bell,
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Permintaan Desain",
      url: "/permintaan-desain",
      icon: FileBox,
    },
    {
      title: "Riwayat",
      url: "/riwayat",
      icon: Clock,
    },
    {
      title: "Review & Rating",
      url: "/feedback",
      icon: MessageSquareDot,
    },
    {
      title: "Artikel",
      url: "/artikel-admin",
      icon: Newspaper,
    },
    {
      title: "Notifikasi",
      url: "/notifikasi",
      icon: Bell,
    },
  ],
  navDesigner: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Daily Activity",
      url: "/daily-activity",
      icon: CalendarCheck2,
    },
    {
      title: "Permintaan Desain",
      url: "/permintaan-desain",
      icon: FileBox,
    },
    {
      title: "Riwayat Pengerjaan",
      url: "/riwayat-pengerjaan",
      icon: Clock,
    },
    {
      title: "Artikel",
      url: "/artikel-admin",
      icon: Newspaper,
    },
    {
      title: "Notifikasi",
      url: "/notifikasi",
      icon: Bell,
    },
  ],
  navSecondary: [
    {
      title: "Dokumentasi",
      url: "/dokumentasi",
      icon: BookOpen,
    },
    // {
    //   title: "Feedback",
    //   url: "/feedback",
    //   icon: MessageSquareShare,
    // },
    {
      title: "Tentang App",
      url: "/tentang-app",
      icon: Info,
    },
  ],
};

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
        {/* <span className={isMobile ? "text-sm font-semibold truncate inline" : "hidden text-sm font-semibold truncate group-data-[state=expanded]:inline"}>
          Lourdes Autoparts
        </span> */}
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

function UserAvatarFallback({ name }: { name: string }) {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)}
    </div>
  );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const currentPath = usePathname();
  const supabase = createClient();

  const [user, setUser] = React.useState<any>(null);
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) setUser(data.user);
      if (!data.user) redirect("auth/login");
      const profileRes = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profileRes.data) setProfile(profileRes.data);
    };
    getUser();
  }, [supabase]);

  const markActive = (items: readonly { title: string; url: string; icon: typeof LayoutDashboard }[]) =>
    items.map((item) => ({
      ...item,
      isActive: currentPath.includes(item.url),
    }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent>
        {profile?.role === "admin" ? (
          <NavMain label="Menu" items={markActive(data.navAdmin)} />
        ) : profile?.role === "designer" ? (
          <NavMain label="Menu" items={markActive(data.navDesigner)} />
        ) : (
          <NavMain label="Menu" items={markActive(data.navMain)} />
        )}
        {profile?.role !== "designer" && (
          <NavMain label="About" items={markActive(data.navSecondary)} />
        )}
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              avatar: `https://ui-avatars.com/api/?name=${user.email}`,
              email: user.email || "",
              name: profile?.name || "-",
            }}
          />
        )}
      </SidebarFooter>

      <SidebarRail className="bg-transparent" />
    </Sidebar>
  );
}
