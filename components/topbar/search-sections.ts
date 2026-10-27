// Penyusun hasil global search (fungsi murni, tanpa state/efek).
import {
  ArrowRight,
  FileBox,
  History,
  LogOut,
  Newspaper,
  PenSquare,
  Plus,
  SquareUserRound,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { THEME_OPTIONS } from "@/components/theme-switcher";
import { STATUS_META, normalizeStatus } from "@/lib/permintaan-workflow";
import type { NavGroup, NavRole } from "@/lib/sidebar/nav-config";
import { GROUP_KEYWORDS, MENU_KEYWORDS, MIN_LOCAL_SCORE, scoreMenuItem } from "@/lib/sidebar/menu-search";
import { SEARCH_GROUP_LIMIT, type PendingResponse, type SearchHit, type SearchHitKind } from "@/lib/global-search";

export type SearchRun =
  | { type: "navigate"; href: string }
  | { type: "theme"; value: string }
  | { type: "logout" }
  /** Isi ulang kotak search (item "Pencarian terakhir"). */
  | { type: "fill"; query: string };

export type SearchItem = {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Teks kecil di kanan, mis. nama grup menu. */
  meta?: string;
  pill?: { label: string; className: string };
  /** Item redup "Lihat semua …". */
  muted?: boolean;
  run: SearchRun;
  /** Dokumen yang disimpan ke riwayat "Terakhir dibuka" saat dibuka. */
  hit?: SearchHit;
};

export type SearchSection = { id: string; label: string; items: SearchItem[] };

export type SearchHistory = { docs: SearchHit[]; queries: string[] };

export const KIND_META: Record<SearchHitKind, { label: string; icon: LucideIcon; listHref?: (q: string) => string }> = {
  permintaan: {
    label: "Permintaan Desain",
    icon: FileBox,
    listHref: (q) => `/permintaan-desain?month=all&search=${encodeURIComponent(q)}`,
  },
  artikel: {
    label: "Artikel",
    icon: Newspaper,
    listHref: (q) => `/artikel-admin?search=${encodeURIComponent(q)}`,
  },
  user: { label: "User", icon: UserRound },
};

const ARTIKEL_STATUS: Record<string, { label: string; className: string }> = {
  published: { label: "Terbit", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  archived: { label: "Arsip", className: "bg-muted text-muted-foreground border-border" },
};

const ROLE_LABEL: Record<string, string> = { admin: "Admin", designer: "Designer", user: "User" };

type QuickAction = {
  id: string;
  title: string;
  icon: LucideIcon;
  keywords: string[];
  /** Tampil juga saat query kosong. */
  featured?: boolean;
  /** Harus sama dengan aturan tombol aslinya di halaman. */
  visible: (role: NavRole) => boolean;
  run: SearchRun;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "buat-permintaan",
    title: "Buat Permintaan Desain",
    icon: Plus,
    keywords: ["ajukan", "tiket baru", "request baru", "order desain", "minta desain"],
    featured: true,
    // Tombol "Buat" di list permintaan: userRole !== "designer".
    visible: (role) => role !== "designer",
    run: { type: "navigate", href: "/permintaan-desain/buat" },
  },
  {
    id: "tulis-artikel",
    title: "Tulis Artikel",
    icon: PenSquare,
    keywords: ["buat artikel", "artikel baru", "posting", "blog"],
    featured: true,
    // canManageArticles di artikel-admin: admin || designer.
    visible: (role) => role !== "user",
    run: { type: "navigate", href: "/artikel-admin/buat" },
  },
  {
    id: "profil",
    title: "Profil Saya",
    icon: SquareUserRound,
    keywords: ["akun", "foto profil", "ganti nama", "password", "pengaturan notifikasi"],
    visible: () => true,
    run: { type: "navigate", href: "/profile" },
  },
  {
    id: "logout",
    title: "Keluar",
    icon: LogOut,
    keywords: ["logout", "log out", "sign out"],
    visible: () => true,
    run: { type: "logout" },
  },
];

const THEME_KEYWORDS: Record<string, string[]> = {
  light: ["terang", "light mode", "siang"],
  "soft-light": ["terang lembut", "soft"],
  dark: ["gelap", "dark mode", "malam"],
  "soft-dark": ["gelap lembut", "soft"],
  system: ["sistem", "otomatis", "auto", "ikut perangkat"],
};

function pillFor(hit: SearchHit): SearchItem["pill"] {
  if (!hit.status) return undefined;
  if (hit.kind === "permintaan") {
    const meta = STATUS_META[normalizeStatus(hit.status)];
    return { label: meta.short, className: meta.badgeClass };
  }
  if (hit.kind === "artikel") return ARTIKEL_STATUS[hit.status];
  return undefined;
}

export function hitToItem(hit: SearchHit, keyPrefix: string): SearchItem {
  return {
    key: `${keyPrefix}:${hit.kind}:${hit.id}`,
    icon: KIND_META[hit.kind].icon,
    title: hit.title,
    subtitle: hit.subtitle || undefined,
    meta: hit.kind === "user" ? ROLE_LABEL[hit.status ?? ""] : undefined,
    pill: pillFor(hit),
    run: { type: "navigate", href: hit.href },
    hit,
  };
}

function quickActionItems(role: NavRole, theme: string | undefined): QuickAction[] {
  const themeActions: QuickAction[] = THEME_OPTIONS.filter((o) => o.value !== theme).map((o) => ({
    id: `theme-${o.value}`,
    title: `Tema: ${o.label}`,
    icon: o.icon,
    keywords: ["tema", "mode", "tampilan", ...(THEME_KEYWORDS[o.value] ?? [])],
    visible: () => true,
    run: { type: "theme", value: o.value },
  }));
  return [...QUICK_ACTIONS, ...themeActions].filter((a) => a.visible(role));
}

function actionToItem(a: QuickAction): SearchItem {
  return { key: `action:${a.id}`, icon: a.icon, title: a.title, meta: "Aksi", run: a.run };
}

export type BuildSectionsInput = {
  query: string;
  role: NavRole;
  navGroups: NavGroup[];
  theme: string | undefined;
  /** Hasil server untuk query ini (atau query sebelumnya selama memuat); null = belum ada. */
  hits: SearchHit[] | null;
  pending: PendingResponse | null;
  history: SearchHistory;
};

export function buildSections({ query, role, navGroups, theme, hits, pending, history }: BuildSectionsInput): SearchSection[] {
  const q = query.trim();
  const actions = quickActionItems(role, theme);

  if (!q) {
    const sections: SearchSection[] = [];
    if (pending && pending.items.length > 0) {
      const items = pending.items.map((h) => hitToItem(h, "pending"));
      if (pending.total > pending.items.length) {
        items.push({
          key: "pending:more",
          icon: ArrowRight,
          title: `Lihat ${pending.total - pending.items.length} permintaan lainnya`,
          muted: true,
          run: { type: "navigate", href: "/permintaan-desain?month=all" },
        });
      }
      sections.push({ id: "pending", label: "Perlu aksi Anda", items });
    }
    if (history.docs.length > 0) {
      sections.push({ id: "recent-docs", label: "Terakhir dibuka", items: history.docs.map((h) => hitToItem(h, "recent")) });
    }
    if (history.queries.length > 0) {
      sections.push({
        id: "recent-queries",
        label: "Pencarian terakhir",
        items: history.queries.map((text) => ({
          key: `recent-query:${text}`,
          icon: History,
          title: text,
          run: { type: "fill", query: text },
        })),
      });
    }
    sections.push({
      id: "actions",
      label: "Aksi cepat",
      items: actions.filter((a) => a.featured).map(actionToItem),
    });
    return sections.filter((s) => s.items.length > 0);
  }

  const menuItems: SearchItem[] = navGroups
    .flatMap((g) =>
      g.items.map((item) => ({
        item,
        group: g.label,
        score: scoreMenuItem(q, {
          title: item.title,
          keywords: MENU_KEYWORDS[item.url],
          group: g.label,
          groupKeywords: GROUP_KEYWORDS[g.label],
        }),
      })),
    )
    .filter((m) => m.score >= MIN_LOCAL_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ item, group }) => ({
      key: `menu:${item.url}`,
      icon: item.icon,
      title: item.title,
      meta: group,
      run: { type: "navigate", href: item.url },
    }));

  const actionItems: SearchItem[] = actions
    .map((a) => ({ a, score: scoreMenuItem(q, { title: a.title, keywords: a.keywords }) }))
    .filter((x) => x.score >= MIN_LOCAL_SCORE)
    .sort((x, y) => y.score - x.score)
    .slice(0, 4)
    .map(({ a }) => actionToItem(a));

  const exact = (hits ?? []).filter((h) => h.exact);
  const dataSection = (kind: SearchHitKind): SearchSection => {
    const rows = (hits ?? []).filter((h) => h.kind === kind && !h.exact);
    const items = rows.map((h) => hitToItem(h, "data"));
    const meta = KIND_META[kind];
    const total = rows.length + exact.filter((h) => h.kind === kind).length;
    if (total >= SEARCH_GROUP_LIMIT && meta.listHref) {
      items.push({
        key: `more:${kind}`,
        icon: ArrowRight,
        title: `Lihat semua hasil ${meta.label}`,
        muted: true,
        run: { type: "navigate", href: meta.listHref(q) },
      });
    }
    return { id: kind, label: meta.label, items };
  };

  const best: SearchSection = { id: "best", label: "Paling cocok", items: exact.map((h) => hitToItem(h, "best")) };
  const menu: SearchSection = { id: "menu", label: "Menu", items: menuItems };
  const action: SearchSection = { id: "action", label: "Aksi", items: actionItems };
  const data = [dataSection("permintaan"), dataSection("artikel"), dataSection("user")];

  // Query mirip kode (ada angka atau "/") → data didahulukan.
  const looksLikeCode = /[\d/]/.test(q);
  const ordered = looksLikeCode ? [best, ...data, menu, action] : [best, menu, action, ...data];
  return ordered.filter((s) => s.items.length > 0);
}
