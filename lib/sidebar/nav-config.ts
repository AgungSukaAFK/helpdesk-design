// Satu sumber daftar menu: dipakai sidebar, breadcrumb top bar, dan global search,
// jadi menu yang muncul di search selalu sama dengan menu yang boleh dibuka user.
// Aturan role harus sejalan dengan pengecekan route di app/(With Sidebar)/layout.tsx.
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarCheck2,
  Clock,
  FileBox,
  FolderKanban,
  Info,
  LayoutDashboard,
  MessageSquareDot,
  Newspaper,
  ShieldCheck,
  Target,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export type NavRole = "admin" | "designer" | "user";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

type NavItemDef = NavItem & { visible: boolean };

export function resolveNavRole(role?: string | null): NavRole {
  return role === "admin" || role === "designer" ? role : "user";
}

export function buildNavGroups(role?: string | null): NavGroup[] {
  const r = resolveNavRole(role);
  const isAdmin = r === "admin";
  const isStaff = r === "admin" || r === "designer";

  const groups: { label: string; items: NavItemDef[] }[] = [
    {
      label: "Utama",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, visible: true },
        { title: "Notifikasi", url: "/notifikasi", icon: Bell, visible: true },
      ],
    },
    {
      label: "Permintaan Desain",
      items: [
        { title: "Permintaan Desain", url: "/permintaan-desain", icon: FileBox, visible: true },
        { title: "Riwayat Pengerjaan", url: "/riwayat-pengerjaan", icon: Clock, visible: isStaff },
        { title: "Riwayat", url: "/riwayat", icon: Clock, visible: !isStaff },
        { title: "Review & Rating", url: "/feedback", icon: MessageSquareDot, visible: true },
      ],
    },
    {
      label: "Aktivitas Tim",
      items: [
        { title: "Attendance", url: "/attendance", icon: UserCheck, visible: isAdmin },
        { title: "Daily Activity", url: "/daily-activity", icon: CalendarCheck2, visible: isStaff },
        { title: "Safety Toolbox Meeting HSE", url: "/safety-toolbox-meeting-hse", icon: ShieldCheck, visible: isAdmin },
        { title: "Program Kerja", url: "/program-kerja", icon: FolderKanban, visible: isAdmin },
      ],
    },
    {
      label: "Laporan & Kinerja",
      items: [
        { title: "KPI", url: "/kpi", icon: Target, visible: isAdmin },
        { title: "Rekap Bulanan", url: "/rekap-bulanan", icon: BarChart3, visible: isAdmin },
      ],
    },
    {
      label: "Konten",
      items: [{ title: "Artikel", url: "/artikel-admin", icon: Newspaper, visible: true }],
    },
    {
      label: "Administrasi",
      items: [{ title: "User Management", url: "/user-management", icon: Bot, visible: isAdmin }],
    },
    {
      label: "Bantuan",
      items: [
        { title: "Dokumentasi", url: "/dokumentasi", icon: BookOpen, visible: true },
        { title: "Tentang App", url: "/tentang-app", icon: Info, visible: true },
      ],
    },
  ];

  return groups
    .map((g) => ({
      label: g.label,
      items: g.items.filter((i) => i.visible).map(({ visible: _visible, ...rest }) => rest),
    }))
    .filter((g) => g.items.length > 0);
}

/** Cocok kalau path sama persis atau turunan dari url (bukan sekadar awalan string). */
export function pathMatches(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * URL menu yang aktif untuk pathname: kecocokan terpanjang menang, supaya
 * /riwayat-pengerjaan tidak ikut mengaktifkan /riwayat.
 */
export function findActiveUrl(pathname: string, urls: string[]) {
  let best: string | null = null;
  for (const url of urls) {
    if (pathMatches(pathname, url) && (!best || url.length > best.length)) best = url;
  }
  return best;
}

/** Semua menu tanpa filter role, untuk label breadcrumb dan ikon sumber notifikasi. */
export const ALL_NAV_ITEMS: NavItem[] = buildNavGroups("admin")
  .flatMap((g) => g.items)
  .concat(buildNavGroups("user").flatMap((g) => g.items))
  .filter((item, i, arr) => arr.findIndex((x) => x.url === item.url) === i);

export function findNavItem(pathname: string): NavItem | null {
  const url = findActiveUrl(
    pathname,
    ALL_NAV_ITEMS.map((i) => i.url),
  );
  return url ? ALL_NAV_ITEMS.find((i) => i.url === url) ?? null : null;
}
