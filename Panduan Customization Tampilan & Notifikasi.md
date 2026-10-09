# Panduan Customization Tampilan & Notifikasi

Oct 9, 2026 · @Ao

## Ringkasan

Semua preferensi tampilan disimpan per-browser di localStorage dan diterapkan sebagai class/atribut di tag `<html>`; tidak ada yang disimpan ke database kecuali subscription Web Push. Panduan ini menyalin implementasi Garuda Procure (ga-web) apa adanya, agar bisa ditiru 1:1 di proyek lain dengan stack yang sama.

**Stack yang diasumsikan:** Next.js 15 (App Router), React 19, Tailwind CSS v4 (`@theme`, `@custom-variant`), shadcn/ui (Radix), `next-themes`, `lucide-react`, `sonner`, Supabase (`@supabase/ssr`), `web-push`.

| Fitur | Pilihan | Disimpan di | Diterapkan sebagai |
| --- | --- | --- | --- |
| Tema | Light, Soft Light, Dark, Soft Dark, System | localStorage `theme` (next-themes) | class `.light` / `.soft-light` / `.dark` / `.soft-dark` di `<html>` |
| Warna aksen | 2 warna perusahaan + 16 warna umum | localStorage `accent-theme` | class `.theme-<nama>` di `<html>` (zinc = tanpa class) |
| Jenis font | 8 font (Geist default) | localStorage `font-family` | `html[data-font=<nama>]` → variabel `--font-app` |
| Ukuran font | Kecil 87.5%, Menengah 100%, Besar 112.5%, Sangat Besar 125% | localStorage `font-size` | `html[data-font-size=<nama>]` → `font-size` root (semua `rem` ikut) |
| Notifikasi (alert) | Master on/off, suara, volume, jenis suara, notifikasi browser | localStorage `ga-notif-settings` | dibaca `NotificationProvider` saat notif realtime masuk |
| Nada dering custom | Upload file audio sendiri | IndexedDB | preset suara `custom` |
| Notifikasi HP (Web Push) | Aktif/nonaktif per device | tabel `push_subscriptions` | Service Worker `public/sw.js` |

**Peta file sumber (ga-web):**

- `app/globals.css` — semua variabel warna tema, aksen, font, ukuran
- `lib/theme-provider.tsx` — `CustomThemeProvider` (bungkus next-themes + aksen + font) dan daftar `accentThemes`
- `lib/font-options.ts`, `lib/fonts.ts` — daftar font/ukuran, loader `next/font`, script anti-flash
- `components/theme-switcher.tsx`, `accent-theme-switcher.tsx`, `font-switcher.tsx` — tombol pengatur
- `lib/notifications/*`, `components/notification-settings.tsx`, `components/custom-ringtone-settings.tsx`, `components/providers/NotificationProvider.tsx`, `public/sw.js`, `app/api/push/send/route.ts` — notifikasi
- `app/layout.tsx` — pemasangan provider; `app/(With Sidebar)/profile/page.tsx` dan `components/auth/auth-shell.tsx` — tempat tombol pengatur ditampilkan

## Tema (Light, Soft Light, Dark, Soft Dark, System)

Tema memakai `next-themes` dengan `attribute="class"` dan 4 tema terdaftar; Soft Dark dihitung sebagai dark agar utility `dark:` tetap jalan. Setiap tema hanya mendefinisikan ulang variabel warna shadcn (`--background`, `--primary`, dst) dalam format HSL tanpa `hsl()`.

### 1. Pasang provider di `app/layout.tsx`

```tsx
<html lang="en" className={fontVariables} suppressHydrationWarning>
  <head>
    {/* Terapkan font & ukuran font tersimpan sebelum render (anti-flash) */}
    <script dangerouslySetInnerHTML={{ __html: fontInitScript }} />
  </head>
  <body className="antialiased">
    <CustomThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark", "soft-light", "soft-dark"]}
      disableTransitionOnChange
    >
      <NotificationProvider>{children}</NotificationProvider>
    </CustomThemeProvider>
    <Toaster richColors position="bottom-right" />
  </body>
</html>
```

### 2. Daftarkan token warna di `app/globals.css` (Tailwind v4)

```css
@import "tailwindcss";
@plugin 'tailwindcss-animate';

/* soft-dark ikut dihitung sebagai dark supaya utility `dark:` tetap jalan */
@custom-variant dark (&:is(.dark *, .soft-dark *));

@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-chart-1: hsl(var(--chart-1));
  /* ...chart-2 s/d chart-5 sama polanya */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

@theme inline {
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
```

### 3. Nilai warna per tema (di dalam `@layer base`)

| Variabel | Light (`:root`) | Dark (`.dark`) | Soft Light | Soft Dark |
| --- | --- | --- | --- | --- |
| `--background` | 0 0% 100% | 240 5.9% 10% | 40 14% 91.5% | 215 14% 16.5% |
| `--foreground` | 240 5.9% 10% | 0 0% 98% | 30 7% 23% | 210 16% 85% |
| `--card` / `--popover` | 0 0% 100% | 240 5.9% 10% | 40 16% 94% | 215 13% 19% |
| `--card-foreground` / `--popover-foreground` | 240 5.9% 10% | 0 0% 98% | 30 7% 23% | 210 16% 85% |
| `--primary` | 240 5.9% 10% | 0 0% 98% | 30 7% 25% | 210 16% 87% |
| `--primary-foreground` | 0 0% 98% | 240 5.9% 10% | 40 16% 94% | 215 14% 15% |
| `--secondary` / `--muted` | 240 4.8% 95.9% | 240 3.7% 15.9% | 38 12% 86.5% | 215 12% 24.5% |
| `--secondary-foreground` | 240 5.9% 10% | 0 0% 98% | 30 7% 23% | 210 16% 85% |
| `--muted-foreground` | 240 3.8% 46.1% | 240 5% 64.9% | 30 5% 42% | 213 9% 64% |
| `--accent` | 240 4.8% 95.9% | 240 3.7% 15.9% | 38 12% 85% | 215 12% 26% |
| `--accent-foreground` | 240 5.9% 10% | 0 0% 98% | 30 7% 23% | 210 16% 87% |
| `--destructive` | 0 84.2% 60.2% | 0 62.8% 30.6% | 0 70% 55% | 0 60% 45% |
| `--destructive-foreground` | 0 0% 98% | 0 0% 98% | 0 0% 98% | 0 0% 98% |
| `--border` | 240 5.9% 90% | 240 3.7% 15.9% | 38 9% 80.5% | 215 11% 23.5% |
| `--input` | 240 5.9% 90% | 240 3.7% 15.9% | 38 9% 80.5% | 215 11% 26% |
| `--ring` | 240 5.9% 10% | 240 4.9% 83.9% | 30 7% 25% | 213 14% 66% |
| `color-scheme` | — | — | light | dark |

`--radius: 0.5rem` hanya di `:root`. Chart: Light dan Soft Light memakai `oklch(0.646 0.222 41.116)`, `oklch(0.6 0.118 184.704)`, `oklch(0.398 0.07 227.392)`, `oklch(0.828 0.189 84.429)`, `oklch(0.769 0.188 70.08)`; Dark dan Soft Dark memakai `oklch(0.488 0.243 264.376)`, `oklch(0.696 0.17 162.48)`, `oklch(0.769 0.188 70.08)`, `oklch(0.627 0.265 303.9)`, `oklch(0.645 0.246 16.439)`.

### 4. Warna sidebar (di dalam `@layer utilities`, nilai sudah memakai `hsl()`)

| Variabel | Light | Dark | Soft Light | Soft Dark |
| --- | --- | --- | --- | --- |
| `--sidebar` | hsl(0 0% 98%) | hsl(240 5.9% 10%) | hsl(40 13% 89%) | hsl(215 14% 14.5%) |
| `--sidebar-foreground` | hsl(240 5.3% 26.1%) | hsl(0 0% 98%) | hsl(30 6% 28%) | hsl(210 16% 85%) |
| `--sidebar-primary` | hsl(240 5.9% 10%) | hsl(0 0% 98%) | hsl(30 7% 25%) | hsl(210 16% 87%) |
| `--sidebar-primary-foreground` | hsl(0 0% 98%) | hsl(240 5.9% 10%) | hsl(40 16% 94%) | hsl(215 14% 15%) |
| `--sidebar-accent` | hsl(240 4.8% 95.9%) | hsl(240 3.7% 15.9%) | hsl(38 12% 84%) | hsl(215 12% 23%) |
| `--sidebar-accent-foreground` | hsl(240 5.9% 10%) | hsl(0 0% 98%) | hsl(30 7% 23%) | hsl(210 16% 87%) |
| `--sidebar-border` | hsl(220 13% 91%) | hsl(240 3.7% 15.9%) | hsl(38 9% 80.5%) | hsl(215 11% 20.5%) |
| `--sidebar-ring` | hsl(217.2 91.2% 59.8%) | hsl(240 4.9% 83.9%) | hsl(217.2 91.2% 59.8%) | hsl(213 14% 66%) |

### 5. Warna border default per tema (di akhir `@layer base`)

```css
* { @apply border-border outline-ring/50; }
body { @apply bg-background text-foreground; font-family: var(--font-app); }

/* v3 Border Compatibility */
*, ::after, ::before, ::backdrop, ::file-selector-button {
  border-color: var(--color-gray-200, currentcolor);
}
/* Tema soft pakai --border tema, bukan gray-200 yang terlalu terang */
:is(.soft-light, .soft-dark) :is(*, ::after, ::before, ::backdrop, ::file-selector-button) {
  border-color: hsl(var(--border));
}
/* Dark utama: sedikit lebih lembut dari gray-200 (setara zinc-600) */
.dark :is(*, ::after, ::before, ::backdrop, ::file-selector-button) {
  border-color: hsl(240 5.2% 33.9%);
}
```

### 6. `components/theme-switcher.tsx`

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CloudMoon, Laptop, Moon, Sun, SunDim } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "soft-light", label: "Soft Light", icon: SunDim },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "soft-dark", label: "Soft Dark", icon: CloudMoon },
  { value: "system", label: "System", icon: Laptop },
] as const;

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const ICON_SIZE = 16;
  const ActiveIcon = THEME_OPTIONS.find((o) => o.value === theme)?.icon ?? Laptop;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={"sm"}>
          <ActiveIcon key={theme} size={ICON_SIZE} className={"text-muted-foreground"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-content" align="start">
        <DropdownMenuRadioGroup value={theme} onValueChange={(e) => setTheme(e)}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} className="flex gap-2" value={value}>
              <Icon size={ICON_SIZE} className="text-muted-foreground" /> <span>{label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { ThemeSwitcher };
```

## Warna Aksen

Aksen hanya mengganti 3 variabel (`--primary`, `--primary-foreground`, `--ring`) lewat class `.theme-<nama>` di `<html>`, sehingga bisa dikombinasikan bebas dengan tema mana pun. Zinc adalah default dan tidak memasang class apa pun.

### 1. Nilai CSS aksen (di dalam `@layer base`, setelah blok tema)

Nilai "Normal" berlaku untuk Light, Soft Light, dan Dark. Kolom "Soft Dark" ditulis sebagai `.soft-dark.theme-<nama>` dan memakai shade lebih terang (setara Tailwind 400) + teks gelap agar tetap kontras.

| Aksen | `--primary` normal (= `--ring`) | `--primary-foreground` normal | `--primary` Soft Dark (= `--ring`) | `--primary-foreground` Soft Dark |
| --- | --- | --- | --- | --- |
| blue | 217.2 91.2% 59.8% | 210 40% 98% | 213.1 93.9% 67.8% | 213.1 60% 12% |
| sky | 200.4 98% 39.4% | 204 100% 97.1% | 198.4 93.2% 59.6% | 198.4 60% 12% |
| cyan | 191.6 91.4% 36.5% | 183.2 100% 96.3% | 187.9 85.7% 53.3% | 187.9 60% 12% |
| teal | 174.7 83.9% 31.6% | 166.2 76.5% 96.7% | 172.5 66% 50.4% | 172.5 60% 12% |
| emerald | 161.4 93.5% 30.4% | 151.8 81% 95.9% | 158.1 64.4% 51.6% | 158.1 60% 12% |
| green | 142.1 76.2% 36.3% | 144.9 80.4% 97.3% | 141.9 69.2% 58% | 141.9 60% 12% |
| amber | 37.7 92.1% 50.2% | 26 83.3% 14.1% | 45.9 96.7% 64.5% | 45.9 60% 12% |
| orange | 20.5 90.2% 48.2% | 33.3 100% 96.5% | 27 96% 61% | 27 60% 12% |
| red | 0 72.2% 50.6% | 0 85.7% 97.3% | 0 90.6% 70.8% | 0 60% 12% |
| rose | 346.8 77.2% 49.8% | 355.7 100% 97.3% | 351.3 94.5% 71.4% | 351.3 60% 12% |
| pink | 333.3 71.4% 50.6% | 327.3 73.3% 97.1% | 328.6 85.5% 70.2% | 328.6 60% 12% |
| fuchsia | 292.2 84.1% 60.6% | 289.1 100% 97.8% | 292 91.4% 72.5% | 292 60% 12% |
| purple | 271.5 81.3% 55.9% | 270 100% 98% | 270 95.2% 75.3% | 270 60% 12% |
| violet | 262.1 83.3% 57.8% | 250 100% 97.6% | 255.1 91.7% 76.3% | 255.1 60% 12% |
| indigo | 243.4 75.4% 58.6% | 226.5 100% 96.9% | 234.5 89.5% 73.9% | 234.5 60% 12% |

Warna perusahaan aslinya gelap, jadi versi terangnya dipakai di **Dark dan Soft Dark** (`.dark.theme-x, .soft-dark.theme-x`). Ganti dengan warna brand website tujuan:

| Aksen | `--primary` normal | `--primary-foreground` normal | `--primary` Dark/Soft Dark | `--primary-foreground` Dark/Soft Dark |
| --- | --- | --- | --- | --- |
| gmi (navy #242365) | 240.9 48.6% 26.7% | 240 40% 98% | 241 50% 66% | 241 50% 10% |
| gis (hijau rgb 23 88 49) | 144 58.6% 21.8% | 144 60% 97% | 144 45% 45% | 144 60% 8% |

Contoh pola CSS satu aksen:

```css
.theme-blue {
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 210 40% 98%;
  --ring: 217.2 91.2% 59.8%;
}
.soft-dark.theme-blue {
  --primary: 213.1 93.9% 67.8%;
  --primary-foreground: 213.1 60% 12%;
  --ring: 213.1 93.9% 67.8%;
}

/* Warna perusahaan: versi terang di dark & soft-dark */
.theme-gmi {
  --primary: 240.9 48.6% 26.7%;
  --primary-foreground: 240 40% 98%;
  --ring: 240.9 48.6% 26.7%;
}
.dark.theme-gmi,
.soft-dark.theme-gmi {
  --primary: 241 50% 66%;
  --primary-foreground: 241 50% 10%;
  --ring: 241 50% 66%;
}
```

### 2. `lib/theme-provider.tsx` (provider gabungan tema + aksen + font)

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider, ThemeProviderProps } from "next-themes";
import {
  DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, FONT_FAMILY_STORAGE_KEY, FONT_SIZE_STORAGE_KEY,
  fontFamilies, fontSizes, type FontFamily, type FontSize,
} from "@/lib/font-options";

// `color` = warna primary mode terang, untuk swatch preview.
// `group: "company"` = warna khusus perusahaan, ditampilkan terpisah di atas.
export const accentThemes = [
  { name: "gmi", label: "GMI", color: "#242365", group: "company" },
  { name: "gis", label: "GIS", color: "rgb(23 88 49)", group: "company" },
  { name: "zinc", label: "Zinc (Default)", color: "hsl(240 5.9% 10%)", group: "general" },
  { name: "blue", label: "Blue", color: "hsl(217.2 91.2% 59.8%)", group: "general" },
  { name: "sky", label: "Sky", color: "hsl(200.4 98% 39.4%)", group: "general" },
  { name: "cyan", label: "Cyan", color: "hsl(191.6 91.4% 36.5%)", group: "general" },
  { name: "teal", label: "Teal", color: "hsl(174.7 83.9% 31.6%)", group: "general" },
  { name: "emerald", label: "Emerald", color: "hsl(161.4 93.5% 30.4%)", group: "general" },
  { name: "green", label: "Green", color: "hsl(142.1 76.2% 36.3%)", group: "general" },
  { name: "amber", label: "Amber", color: "hsl(37.7 92.1% 50.2%)", group: "general" },
  { name: "orange", label: "Orange", color: "hsl(20.5 90.2% 48.2%)", group: "general" },
  { name: "red", label: "Red", color: "hsl(0 72.2% 50.6%)", group: "general" },
  { name: "rose", label: "Rose", color: "hsl(346.8 77.2% 49.8%)", group: "general" },
  { name: "pink", label: "Pink", color: "hsl(333.3 71.4% 50.6%)", group: "general" },
  { name: "fuchsia", label: "Fuchsia", color: "hsl(292.2 84.1% 60.6%)", group: "general" },
  { name: "purple", label: "Purple", color: "hsl(271.5 81.3% 55.9%)", group: "general" },
  { name: "violet", label: "Violet", color: "hsl(262.1 83.3% 57.8%)", group: "general" },
  { name: "indigo", label: "Indigo", color: "hsl(243.4 75.4% 58.6%)", group: "general" },
] as const;

type AccentTheme = (typeof accentThemes)[number]["name"];

interface CustomThemeContextType {
  accent: AccentTheme;
  setAccent: (accent: AccentTheme) => void;
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const CustomThemeContext = createContext<CustomThemeContextType | undefined>(undefined);

export function CustomThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [accent, setAccent] = useState<AccentTheme>("zinc");
  // null = belum dibaca dari localStorage, supaya nilai dari script anti-flash
  // tidak tertimpa default dulu.
  const [fontFamily, setFontFamily] = useState<FontFamily | null>(null);
  const [fontSize, setFontSize] = useState<FontSize | null>(null);

  useEffect(() => {
    const storedAccent = localStorage.getItem("accent-theme") as AccentTheme;
    if (storedAccent && accentThemes.find((t) => t.name === storedAccent)) {
      setAccent(storedAccent);
    }
    const storedFont = localStorage.getItem(FONT_FAMILY_STORAGE_KEY);
    setFontFamily(fontFamilies.find((f) => f.name === storedFont)?.name ?? DEFAULT_FONT_FAMILY);
    const storedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    setFontSize(fontSizes.find((s) => s.name === storedSize)?.name ?? DEFAULT_FONT_SIZE);
  }, []);

  useEffect(() => {
    if (!fontFamily) return;
    const root = window.document.documentElement;
    if (fontFamily === DEFAULT_FONT_FAMILY) delete root.dataset.font;
    else root.dataset.font = fontFamily;
    localStorage.setItem(FONT_FAMILY_STORAGE_KEY, fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    if (!fontSize) return;
    const root = window.document.documentElement;
    if (fontSize === DEFAULT_FONT_SIZE) delete root.dataset.fontSize;
    else root.dataset.fontSize = fontSize;
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
  }, [fontSize]);

  useEffect(() => {
    const root = window.document.documentElement;
    accentThemes.forEach((theme) => root.classList.remove(`theme-${theme.name}`));
    if (accent !== "zinc") root.classList.add(`theme-${accent}`);
    localStorage.setItem("accent-theme", accent);
  }, [accent]);

  return (
    <CustomThemeContext.Provider
      value={{
        accent, setAccent,
        fontFamily: fontFamily ?? DEFAULT_FONT_FAMILY, setFontFamily,
        fontSize: fontSize ?? DEFAULT_FONT_SIZE, setFontSize,
      }}
    >
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </CustomThemeContext.Provider>
  );
}

export const useCustomTheme = () => {
  const context = useContext(CustomThemeContext);
  if (context === undefined) {
    throw new Error("useCustomTheme must be used within a CustomThemeProvider");
  }
  return context;
};
```

Catatan: aksen tidak punya script anti-flash seperti font, jadi pada load pertama warna zinc sempat terlihat sekejap sebelum aksen tersimpan diterapkan. Kalau ingin lebih rapi di website baru, tambahkan pembacaan `accent-theme` ke `fontInitScript` (lihat bagian Font).

### 3. `components/accent-theme-switcher.tsx`

```tsx
"use client";

import * as React from "react";
import { Check, Palette } from "lucide-react";
import { useCustomTheme, accentThemes } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const companyThemes = accentThemes.filter((t) => t.group === "company");
const generalThemes = accentThemes.filter((t) => t.group === "general");

export function AccentThemeSwitcher() {
  const { accent, setAccent } = useCustomTheme();
  const active = accentThemes.find((t) => t.name === accent);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="Warna aksen">
          <Palette className="text-muted-foreground" size={16} />
          {active && (
            <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: active.color }} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-2" align="start">
        <DropdownMenuLabel className="px-1 pb-1 pt-0 text-xs text-muted-foreground">
          Warna Perusahaan
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {companyThemes.map((theme) => {
            const selected = accent === theme.name;
            return (
              <DropdownMenuItem
                key={theme.name}
                onClick={() => setAccent(theme.name)}
                className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5", selected && "border-primary")}
              >
                <span className="h-5 w-5 shrink-0 rounded-full border" style={{ backgroundColor: theme.color }} />
                <span className="font-semibold">{theme.label}</span>
                {selected && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-2" />

        <DropdownMenuLabel className="px-1 pb-1 pt-0 text-xs text-muted-foreground">
          Warna Umum
        </DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1">
          {generalThemes.map((theme) => {
            const selected = accent === theme.name;
            return (
              <DropdownMenuItem
                key={theme.name}
                onClick={() => setAccent(theme.name)}
                title={theme.label}
                className={cn("flex flex-col items-center gap-1 rounded-md px-1 py-1.5", selected && "bg-accent")}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border",
                    selected && "ring-2 ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: theme.color, "--tw-ring-color": theme.color } as React.CSSProperties}
                >
                  {selected && <Check className="h-3.5 w-3.5 text-white" />}
                </span>
                <span className="w-full truncate text-center text-[10px] leading-tight">
                  {theme.name === "zinc" ? "Default" : theme.label}
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Font (Jenis dan Ukuran)

Semua font dimuat lewat `next/font/google` sebagai CSS variable; hanya Geist yang di-preload, sisanya diunduh browser saat dipilih. Ukuran font mengubah `font-size` di `<html>`, sehingga seluruh ukuran berbasis `rem` (Tailwind) ikut membesar/mengecil.

### 1. `lib/fonts.ts` (server, loader font)

```ts
import {
  Atkinson_Hyperlegible, Geist, Inter, Nunito, Plus_Jakarta_Sans, Poppins, Roboto,
} from "next/font/google";

// Font default di-preload; sisanya hanya diunduh browser kalau dipilih user.
const geist = Geist({ variable: "--font-geist-sans", display: "swap", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", display: "swap", subsets: ["latin"], preload: false });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", display: "swap", subsets: ["latin"], preload: false });
const poppins = Poppins({
  variable: "--font-poppins", display: "swap", subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"], preload: false,
});
const nunito = Nunito({ variable: "--font-nunito", display: "swap", subsets: ["latin"], preload: false });
const roboto = Roboto({ variable: "--font-roboto", display: "swap", subsets: ["latin"], preload: false });
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson", display: "swap", subsets: ["latin"], weight: ["400", "700"], preload: false,
});

export const fontVariables = [geist, inter, jakarta, poppins, nunito, roboto, atkinson]
  .map((f) => f.variable)
  .join(" ");
```

### 2. `lib/font-options.ts` (dipakai server & client)

File ini sengaja dipisah dari `theme-provider.tsx` (client module) supaya `fontInitScript` bisa diimpor oleh `app/layout.tsx` (server component).

```ts
// `preview` = font-family untuk contoh teks di menu. Penerapan ke seluruh
// app lewat html[data-font=<name>] di globals.css.
export const fontFamilies = [
  { name: "geist", label: "Geist (Default)", preview: "var(--font-geist-sans)" },
  { name: "inter", label: "Inter", preview: "var(--font-inter)" },
  { name: "jakarta", label: "Plus Jakarta Sans", preview: "var(--font-jakarta)" },
  { name: "poppins", label: "Poppins", preview: "var(--font-poppins)" },
  { name: "nunito", label: "Nunito", preview: "var(--font-nunito)" },
  { name: "roboto", label: "Roboto", preview: "var(--font-roboto)" },
  { name: "atkinson", label: "Atkinson Hyperlegible", preview: "var(--font-atkinson)" },
  { name: "system", label: "Font Sistem", preview: "system-ui, sans-serif" },
] as const;

// Dipasang sebagai font-size <html>, jadi semua ukuran berbasis rem ikut berubah.
export const fontSizes = [
  { name: "sm", label: "Kecil", scale: "87.5%" },
  { name: "md", label: "Menengah", scale: "100%" },
  { name: "lg", label: "Besar", scale: "112.5%" },
  { name: "xl", label: "Sangat Besar", scale: "125%" },
] as const;

export type FontFamily = (typeof fontFamilies)[number]["name"];
export type FontSize = (typeof fontSizes)[number]["name"];

export const DEFAULT_FONT_FAMILY: FontFamily = "geist";
export const DEFAULT_FONT_SIZE: FontSize = "md";
export const FONT_FAMILY_STORAGE_KEY = "font-family";
export const FONT_SIZE_STORAGE_KEY = "font-size";

// Dijalankan inline di <head> sebelum hydrate, supaya tidak ada kedipan
// font/ukuran default saat halaman pertama dimuat.
export const fontInitScript = `(function(){try{var d=document.documentElement;var f=localStorage.getItem(${JSON.stringify(
  FONT_FAMILY_STORAGE_KEY,
)});var s=localStorage.getItem(${JSON.stringify(
  FONT_SIZE_STORAGE_KEY,
)});if(f&&${JSON.stringify(fontFamilies.map((f) => f.name))}.indexOf(f)>-1)d.dataset.font=f;if(s&&${JSON.stringify(
  fontSizes.map((s) => s.name),
)}.indexOf(s)>-1)d.dataset.fontSize=s;}catch(e){}})();`;
```

### 3. CSS font & ukuran (di dalam `@layer base`, setelah aturan `body`)

```css
:root {
  --font-app: var(--font-geist-sans), system-ui, sans-serif;
}
html[data-font="inter"] { --font-app: var(--font-inter), system-ui, sans-serif; }
html[data-font="jakarta"] { --font-app: var(--font-jakarta), system-ui, sans-serif; }
html[data-font="poppins"] { --font-app: var(--font-poppins), system-ui, sans-serif; }
html[data-font="nunito"] { --font-app: var(--font-nunito), system-ui, sans-serif; }
html[data-font="roboto"] { --font-app: var(--font-roboto), system-ui, sans-serif; }
html[data-font="atkinson"] { --font-app: var(--font-atkinson), system-ui, sans-serif; }
html[data-font="system"] {
  --font-app: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

html[data-font-size="sm"] { font-size: 87.5%; }
html[data-font-size="lg"] { font-size: 112.5%; }
html[data-font-size="xl"] { font-size: 125%; }

/* Dokumen cetak selalu pakai ukuran & font standar, apa pun pilihan user.
   data-printing dipasang komponen cetak selama ukur+cetak. */
html[data-printing] { font-size: 100% !important; }
@media print {
  html {
    font-size: 100% !important;
    --font-app: var(--font-geist-sans), system-ui, sans-serif !important;
  }
}
```

`body` memakai `font-family: var(--font-app);` (lihat bagian Tema langkah 5). Pasang `className={fontVariables}` dan `suppressHydrationWarning` di `<html>`, serta `<script dangerouslySetInnerHTML={{ __html: fontInitScript }} />` di `<head>` (lihat bagian Tema langkah 1).

### 4. `components/font-switcher.tsx`

Butuh komponen shadcn `popover` dan `slider` (`npx shadcn@latest add popover slider`).

```tsx
"use client";

import { Check, Type } from "lucide-react";
import { useCustomTheme } from "@/lib/theme-provider";
import { fontFamilies, fontSizes } from "@/lib/font-options";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function FontSwitcher() {
  const { fontFamily, setFontFamily, fontSize, setFontSize } = useCustomTheme();
  const sizeIndex = Math.max(0, fontSizes.findIndex((s) => s.name === fontSize));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="Font & ukuran teks">
          <Type className="text-muted-foreground" size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Ukuran Font</span>
          <span className="text-xs font-semibold">{fontSizes[sizeIndex].label}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5">
          <span className="text-xs text-muted-foreground">A</span>
          <Slider
            min={0}
            max={fontSizes.length - 1}
            step={1}
            value={[sizeIndex]}
            onValueChange={([i]) => setFontSize(fontSizes[i].name)}
            aria-label="Ukuran font"
          />
          <span className="text-lg leading-none text-muted-foreground">A</span>
          {/* Penanda tiap langkah, px-2 = setengah lebar thumb slider */}
          <div className="col-start-2 flex justify-between px-2">
            {fontSizes.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setFontSize(s.name)}
                className="flex w-0 flex-col items-center gap-1"
              >
                <span className={cn("h-1.5 w-px bg-border", i === sizeIndex && "bg-primary")} />
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] leading-tight text-muted-foreground",
                    i === sizeIndex && "font-semibold text-foreground",
                  )}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="my-3 h-px bg-border" />

        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Jenis Font</span>
        <div className="flex flex-col gap-0.5">
          {fontFamilies.map((f) => {
            const selected = fontFamily === f.name;
            return (
              <button
                key={f.name}
                type="button"
                onClick={() => setFontFamily(f.name)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  selected && "bg-accent",
                )}
                style={{ fontFamily: f.preview }}
              >
                <span className="flex-1">{f.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

## Pengaturan Notifikasi

Notifikasi punya 3 lapis: data in-app di tabel `notifications` (Supabase Realtime), preferensi alert lokal per device (suara, volume, notifikasi browser, toast), dan Web Push per device agar tetap masuk walau browser ditutup. Mematikan alert tidak menghentikan badge/list; yang dikontrol hanya bunyi dan popup.

### Alur saat notifikasi dibuat

1. Aksi user memanggil `sendNotification()` / `sendNotifications()` (`lib/notifications/client.ts`).
2. Baris disimpan lewat RPC `create_notifications` (SECURITY DEFINER; `actor_id` dipaksa = user login, tidak bisa notif diri sendiri).
3. Paralel, `dispatchPushChannel()` memanggil `POST /api/push/send` (fire-and-forget, dikelompokkan per judul+pesan+link).
4. Di tab penerima, `NotificationProvider` menerima event INSERT dari Realtime, menambah ke list + badge, lalu membaca `loadNotifSettings()`: jika `enabled`, putar suara (preset atau custom), tampilkan notifikasi browser (jika `browser`), dan `toast.info` dengan tombol "Lihat".
5. Di server, route push mengirim ke semua baris `push_subscriptions` user via `web-push`; endpoint 404/410 dihapus otomatis. Service Worker `public/sw.js` menampilkan notifikasi OS dan membuka `url` saat diklik.

### 1. Database (Supabase)

```sql
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  user_id uuid not null,          -- penerima
  actor_id uuid,                  -- pengirim (diisi otomatis oleh RPC)
  type text not null,
  title text not null,
  message text,
  resource_id text,               -- text, bukan uuid, supaya id bigint muat
  resource_type text,
  link text,
  is_read boolean default false
);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (auth.uid() = user_id);

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tidak ada policy INSERT: semua lewat RPC di bawah.
create or replace function public.create_notifications(p_notifications jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if p_notifications is null or jsonb_typeof(p_notifications) <> 'array' then
    return 0;
  end if;

  insert into public.notifications
    (user_id, actor_id, type, title, message, link, resource_id, resource_type, is_read)
  select
    (elem->>'user_id')::uuid,
    v_actor,
    elem->>'type',
    elem->>'title',
    nullif(elem->>'message', ''),
    elem->>'link',
    nullif(elem->>'resource_id', ''),
    nullif(elem->>'resource_type', ''),
    false
  from jsonb_array_elements(p_notifications) as elem
  where coalesce(elem->>'user_id', '') <> ''
    and (elem->>'user_id')::uuid <> v_actor;   -- jangan notif diri sendiri

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_notifications(jsonb) from public;
grant execute on function public.create_notifications(jsonb) to authenticated;

-- Aktifkan Realtime
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;

-- Web Push: 1 baris per device/browser
create table if not exists public.push_subscriptions (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
-- UPDATE untuk upsert onConflict endpoint (device bersama, ganti akun)
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated using (true) with check (user_id = auth.uid());
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
```

Sesuaikan `references public.profiles(id)` dengan tabel profil di website tujuan.

### 2. Environment

```bash
# Generate SEKALI: npx web-push generate-vapid-keys
# Jangan diganti setelah user subscribe (subscription lama jadi invalid).
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=      # sama dengan VAPID_PUBLIC_KEY
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=         # untuk createAdminClient() di route push
```

### 3. `lib/notifications/settings.ts` (preferensi alert lokal)

```ts
"use client";

import { useEffect, useState } from "react";
import { SoundPresetId } from "./sound";

export type NotifSettings = {
  /** Master: kalau false, tidak ada sound/browser/toast saat notif masuk. */
  enabled: boolean;
  sound: boolean;
  /** 0..1 */
  volume: number;
  soundType: SoundPresetId;
  /** Notifikasi OS saat tab tidak fokus. */
  browser: boolean;
};

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  enabled: true,
  sound: true,
  volume: 0.6,
  soundType: "tritone",
  browser: true,
};

const STORAGE_KEY = "ga-notif-settings";          // ganti prefix per website
const CHANGE_EVENT = "ga-notif-settings-changed";

export function loadNotifSettings(): NotifSettings {
  if (typeof window === "undefined") return DEFAULT_NOTIF_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIF_SETTINGS;
    return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIF_SETTINGS;
  }
}

export function saveNotifSettings(settings: NotifSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
  } catch {}
}

/** Tersinkron antar komponen (custom event) dan antar tab (storage event). */
export function useNotifSettings() {
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);

  useEffect(() => {
    setSettings(loadNotifSettings());
    const onChange = () => setSettings(loadNotifSettings());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (patch: Partial<NotifSettings>) => {
    const next = { ...loadNotifSettings(), ...patch };
    saveNotifSettings(next);
    setSettings(next);
  };

  return { settings, update };
}
```

### 4. `lib/notifications/sound.ts` (suara disintesis Web Audio, tanpa file)

Inti mesinnya:

```ts
"use client";
import { getCustomSoundUrl } from "./custom-sound-db";

let sharedAudioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
  return sharedAudioCtx;
}

/** Panggil dari gesture user pertama (klik/keydown). */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

function tone(ctx: AudioContext, opts: {
  freq: number; start: number; dur: number; type: OscillatorType; peak: number; glideTo?: number;
}) {
  const { freq, start, dur, type, peak, glideTo } = opts;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

export function playSound(preset: SoundPresetId, volume = 0.6) {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const v = Math.max(0, Math.min(1, volume));
    const now = ctx.currentTime;
    switch (preset) {
      case "tritone": {
        [659.25, 783.99, 1046.5].forEach((f, i) =>
          tone(ctx, { freq: f, start: now + i * 0.13, dur: 0.34, type: "triangle", peak: 0.6 * v }));
        break;
      }
      // ...preset lain sesuai tabel di bawah
    }
  } catch {}
}

export async function playCustomSound(volume = 0.6): Promise<boolean> {
  try {
    const url = await getCustomSoundUrl();
    if (!url) return false;
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
```

`SoundPresetId` = semua id di tabel + `"custom"`. `SOUND_PRESET_GROUPS = ["Lembut", "Ceria", "Tegas"]`, dan `SOUND_PRESETS` berurutan seperti tabel (urutan ini dipakai tombol prev/next). Notasi resep: frekuensi Hz @ jeda antar-nada; `v` = volume.

| id | Label | Grup | Resep `tone()` |
| --- | --- | --- | --- |
| chime | Chime | Lembut | 587.33, 880 @0.16s; dur 0.5; sine; peak 0.5v |
| crystal | Crystal | Lembut | 1046.5, 1318.51, 1567.98 @0.09s; dur 0.7; sine; 0.5v + 2093 di +0.05s dur 0.5 sine 0.18v |
| ding | Ding | Lembut | 880 dur 0.6 sine 0.55v + 1760 dur 0.4 sine 0.2v (bersamaan) |
| softbell | Soft Bell | Lembut | 392 dur 1.1 0.5v + 784 dur 0.8 0.16v + 1176 dur 0.5 0.06v; sine, bersamaan |
| harp | Harp | Lembut | 523.25, 587.33, 659.25, 783.99, 880 @0.055s; dur 0.55; sine; 0.38v |
| kalimba | Kalimba | Lembut | 659.25, 987.77 @0.13s; triangle dur 0.35 0.5v + harmonik f×3 sine dur 0.12 0.08v |
| droplet | Droplet | Lembut | 1400→600 dur 0.12 0.55v; lalu +0.15s 1800→850 dur 0.1 0.35v; sine |
| tritone | Tri-tone (premium) | Ceria | 659.25, 783.99, 1046.5 @0.13s; dur 0.34; triangle; 0.6v (default) |
| marimba | Marimba | Ceria | 523.25, 783.99 @0.11s; dur 0.22; triangle; 0.6v |
| pop | Pop | Ceria | 420→900 dur 0.13; sine; 0.6v |
| twinkle | Twinkle | Ceria | 1046.5, 1318.51, 1567.98, 2093 @0.07s; dur 0.35; sine; 0.4v |
| success | Success | Ceria | 523.25, 659.25, 783.99 @0.09s dur 0.2 triangle 0.5v + 1046.5 di +0.27s dur 0.55 0.55v |
| bubble | Bubble | Ceria | 300→700, 400→900, 520→1150 @0.09s; dur 0.1; sine; 0.5v |
| retro | Retro 8-bit | Ceria | 523.25, 659.25, 783.99, 1046.5 @0.07s; dur 0.09; square; 0.22v |
| whistle | Whistle | Ceria | 900→1500 dur 0.15; lalu +0.17s 1500→1100 dur 0.2; sine; 0.45v |
| doorbell | Doorbell | Tegas | 659.25, 523.25 @0.38s; sine dur 0.8 0.55v + f×2 dur 0.4 0.15v |
| piano | Piano Chord | Tegas | 523.25, 659.25, 783.99 bersamaan; triangle dur 0.9 0.3v + f×2 sine dur 0.35 0.06v |
| alert | Alert | Tegas | 880 di 0 dan +0.2s; dur 0.13; square; 0.25v |
| urgent | Urgent | Tegas | 1174.66 di 0, +0.12, +0.24s; dur 0.08; triangle; 0.55v |

### 5. `lib/notifications/custom-sound-db.ts` (ringtone custom di IndexedDB)

Satu ringtone per device, tidak pernah di-upload ke server.

```ts
"use client";

const DB_NAME = "ga-notif-custom-sound";
const STORE_NAME = "sound";
const RECORD_KEY = "current";

export interface CustomSoundRecord { blob: Blob; name: string; duration: number; savedAt: number; }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomSound(blob: Blob, name: string, duration: number) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ blob, name, duration, savedAt: Date.now() }, RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  cachedUrlPromise = null;
}

export async function getCustomSound(): Promise<CustomSoundRecord | null> {
  const db = await openDb();
  const result = await new Promise<CustomSoundRecord | null>((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteCustomSound() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  cachedUrlPromise = null;
}

// Cache object URL supaya tiap notif tidak baca IndexedDB ulang.
let cachedUrlPromise: Promise<string | null> | null = null;
export function getCustomSoundUrl(): Promise<string | null> {
  if (!cachedUrlPromise) {
    cachedUrlPromise = getCustomSound().then((rec) => (rec ? URL.createObjectURL(rec.blob) : null));
  }
  return cachedUrlPromise;
}
```

### 6. `lib/notifications/push.ts` (subscribe Web Push di browser)

```ts
"use client";
import { createClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

export type PushSubscriptionStatus = "subscribed" | "unsubscribed" | "unsupported";

export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  if (!isPushSupported()) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "unsubscribed";
    return (await reg.pushManager.getSubscription()) ? "subscribed" : "unsubscribed";
  } catch {
    return "unsubscribed";
  }
}

/** HARUS dipanggil dari klik tombol (requestPermission butuh user gesture). */
export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notification tidak didukung di browser ini. Di iPhone, tambahkan dulu situs ini ke Home Screen lewat Safari (Share > Add to Home Screen), lalu buka dari ikonnya.");
  }
  // iOS: Push hanya aktif sebagai home-screen app; di tab Safari biasa izin selalu "denied" diam-diam.
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIOS && !isStandalone) {
    throw new Error("Di iPhone, notifikasi cuma bisa aktif kalau web ini sudah di-install ke Home Screen. Install dulu lewat tombol Install di atas, buka dari ikonnya, baru aktifkan Notifikasi HP.");
  }
  if (Notification.permission === "denied") {
    throw new Error("Notifikasi diblokir di browser ini. Buka pengaturan situs (ikon gembok/info di address bar) > Notifications > Allow, lalu coba lagi.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Izin notifikasi ditolak.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Gagal membuat subscription push (data tidak lengkap).");
  }
  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await createClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
}
```

### 7. `public/sw.js` (Service Worker khusus push, tanpa caching)

```js
self.addEventListener("push", (event) => {
  let payload = { title: "Nama App", body: "Ada notifikasi baru." };
  if (event.data) {
    try { payload = event.data.json(); }
    catch { payload = { title: "Nama App", body: event.data.text() }; }
  }
  const title = payload.title || "Nama App";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
```

### 8. `app/api/push/send/route.ts` (server, satu-satunya pemakai VAPID private key)

```ts
import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(request: Request) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ sent: 0, skipped: "vapid_not_configured" });
  }
  let payload: { userIds: string[]; title: string; body: string; url?: string };
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const userIds = [...new Set(payload.userIds || [])].filter(Boolean);
  if (userIds.length === 0 || !payload.title) return NextResponse.json({ sent: 0 });

  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  const body = JSON.stringify({ title: payload.title, body: payload.body || "", url: payload.url || "/" });
  const staleIds: number[] = [];
  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) staleIds.push(sub.id);
      else console.error("[push/send] Send failed:", err?.message || err);
    }
  }));
  if (staleIds.length > 0) await supabase.from("push_subscriptions").delete().in("id", staleIds);
  return NextResponse.json({ sent, stale: staleIds.length });
}
```

**Perbaiki saat menyalin:** route ini di ga-web tidak memeriksa sesi login, jadi siapa pun yang tahu URL-nya bisa mengirim push ke user mana pun. Di website baru, tambahkan cek `supabase.auth.getUser()` (client server dari `@/lib/supabase/server`) di awal `POST` dan tolak 401 jika tidak ada user.

### 9. Pengirim: `lib/notifications/client.ts`

```ts
async function dispatchNotifications(rows: NotificationRow[]) {
  if (rows.length === 0) return;
  try {
    const { error } = await createClient().rpc("create_notifications", { p_notifications: rows });
    if (error) console.error("[Notification] RPC create_notifications failed:", error);
  } catch (err) {
    console.error("[Notification] Failed to dispatch notifications:", err);
  }
  dispatchPushChannel(rows);
}

// Kelompokkan per (title, message, link) agar broadcast cukup 1 request.
function dispatchPushChannel(rows: NotificationRow[]) {
  const groups = new Map<string, { userIds: string[]; title: string; message: string; link: string }>();
  for (const row of rows) {
    const key = `${row.title}|||${row.message}|||${row.link}`;
    const g = groups.get(key);
    if (g) g.userIds.push(row.user_id);
    else groups.set(key, { userIds: [row.user_id], title: row.title, message: row.message, link: row.link });
  }
  for (const g of groups.values()) {
    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: g.userIds, title: g.title, body: g.message, url: g.link }),
    }).catch((err) => console.error("[Notification] Push channel failed:", err));
  }
}

export async function sendNotification(p: NotificationPayload) { /* map 1 payload -> dispatchNotifications([row]) */ }
export async function sendNotifications(recipients: string[], common: Omit<NotificationPayload, "userId">) {
  /* dedupe recipients -> dispatchNotifications(rows) */
}
```

`NotificationRow` = `{ user_id, type, title, message, link, resource_id?, resource_type? }`. Ganti union `NotificationEventType` dengan jenis event website tujuan.

### 10. `components/providers/NotificationProvider.tsx` (penerima realtime)

Poin yang wajib ditiru:

- Client Supabase dibuat sekali: `const [supabase] = useState(() => createClient())`. Kalau dibuat ulang tiap render, channel realtime subscribe ulang dan suara berbunyi dobel.
- Sebelum subscribe, panggil `supabase.realtime.setAuth(session.access_token)`. Tanpa ini websocket konek sebagai anon dan RLS memblokir semua event.
- Channel: `.channel(\`realtime-notifications-${user.id}\`).on("postgres\_changes", { event: "INSERT", schema: "public", table: "notifications", filter: \`user\_id=eq.${user.id}\` }, handler)\`.
- `isInitialLoad` ref: alert tidak dibunyikan sebelum fetch awal (30 notif terakhir) selesai.
- Pada gesture pertama (`click`/`keydown` di window), panggil `Notification.requestPermission()` (jika `default`) dan `unlockAudio()`, lalu lepas listener.
- Di handler: update list + `unreadCount`, lalu `const s = loadNotifSettings()`; jika `!s.enabled` berhenti; jika `s.sound` putar `playCustomSound` / `playSound(s.soundType, s.volume)`; jika `s.browser` tampilkan `new Notification(title, { body, icon, badge, tag: link })` dengan `onclick` ke link; terakhir `toast.info(title, { description, action: { label: "Lihat", onClick: () => router.push(link) } })`.
- Context mengekspos `unreadCount`, `notifications`, `refreshNotifications`, `markAsRead(id)`, `markAllRead()`.

## Halaman Pengaturan (UI)

Semua pengaturan ditampilkan di halaman Profil dalam dua kartu: "Pengaturan Tema" (3 tombol ikon) dan "Pengaturan Notifikasi". Tombol tema yang sama juga dipasang di pojok halaman login (`components/auth/auth-shell.tsx`) supaya bisa diatur sebelum masuk.

### 1. Penempatan di halaman Profil

```tsx
<Content size="lg">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <Label className="text-base font-bold">Pengaturan Tema</Label>
    <div className="flex items-center gap-1">
      <AccentThemeSwitcher />
      <FontSwitcher />
      <ThemeSwitcher />
    </div>
  </div>
</Content>
<Content size="lg">
  <NotificationSettings />
</Content>
```

`Content` adalah wrapper kartu milik ga-web; ganti dengan `Card` shadcn atau `div` ber-border di website tujuan. Urutan tombol: Aksen → Font → Tema.

### 2. Susunan `components/notification-settings.tsx`

Komponen ini terdiri dari 3 kartu (`rounded-lg border p-4`, jarak `space-y-4`) dengan judul ikon `Bell` + "Pengaturan Notifikasi":

| Kartu | Baris | Kontrol | Perilaku |
| --- | --- | --- | --- |
| Utama | Notifikasi realtime | Toggle | Master `enabled`; mematikan semua alert |
| Utama | Suara notifikasi | Toggle | `sound`; nonaktif jika master mati |
| Utama | Volume | `<input type="range" class="accent-primary">` 0–100 + label % | `volume` 0..1; nonaktif jika suara mati |
| Utama | Pilihan suara | Tombol ◀, Select bergrup (Lembut/Ceria/Tegas), tombol ▶, tombol "Coba" | Memilih langsung memutar suara; ◀/▶ berputar sesuai urutan `SOUND_PRESETS`; label kanan "Grup · n/19" |
| Utama | Ringtone Custom | `<CustomRingtoneSettings />` di bawah garis `border-t pt-3` | Lihat poin 4 |
| Utama | Notifikasi browser | Toggle | `browser`; saat dinyalakan minta `Notification.requestPermission()` |
| Install Aplikasi (hanya jika belum standalone) | Tombol Install / instruksi iOS / instruksi menu browser | Button | Dari hook `useInstallPrompt()` |
| Notifikasi HP | Aktifkan di perangkat ini | Toggle (spinner saat proses) | `subscribeToPush(user.id)` / `unsubscribeFromPush()` + toast sukses/gagal |

Toggle dan Row adalah komponen lokal sederhana (proyek tidak memakai Switch shadcn):

```tsx
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-input",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className={cn(
        "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
        checked ? "translate-x-5" : "translate-x-0.5",
      )} />
    </button>
  );
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
```

Logika pilihan suara dan prev/next:

```tsx
const selectSound = (soundType: typeof settings.soundType) => {
  update({ soundType });
  unlockAudio();
  if (soundType === "custom") playCustomSound(settings.volume);
  else playSound(soundType, settings.volume);
};

const presetIndex = SOUND_PRESETS.findIndex((p) => p.id === settings.soundType);
const stepSound = (dir: 1 | -1) => {
  const n = SOUND_PRESETS.length;
  const next = presetIndex === -1 ? (dir === 1 ? 0 : n - 1) : (presetIndex + dir + n) % n;
  selectSound(SOUND_PRESETS[next].id);
};
```

ga-web memakai komponen `SearchableSelect` buatan sendiri untuk dropdown suara. Di website tujuan bisa diganti `Select` shadcn dengan `SelectGroup` + `SelectLabel` per grup, atau salin `components/ui/searchable-select.tsx`.

Teks deskripsi yang dipakai:

- Notifikasi realtime: "Tampilkan alert (suara, browser, popup) saat ada notif baru."
- Suara notifikasi: "Bunyikan saat notif masuk."
- Notifikasi browser: "Muncul di OS saat tab tidak sedang dibuka/fokus."
- Notifikasi HP: "Tetap masuk walau browser/tab sudah ditutup - beda dari notifikasi browser biasa di atas." (jika tidak didukung: instruksi Add to Home Screen di iPhone)

### 3. PWA: `lib/pwa/use-install-prompt.ts` + manifest

Web Push di iPhone hanya jalan bila situs di-install ke Home Screen, jadi kartu Install ikut disalin. Hook ini menangkap `beforeinstallprompt` (Android/Chrome/Edge/desktop), mendeteksi `display-mode: standalone`, dan `isIOS` untuk menampilkan instruksi manual Share → Add to Home Screen. Kembalian: `{ canInstall, isStandalone, isIOS, promptInstall }`.

Di `app/layout.tsx` metadata: `manifest: "/manifest.json"`, ikon `/icon.svg` + `/icons/icon-192.png`, `apple: "/icons/icon-192.png"`, `viewport.themeColor`. `public/manifest.json` berisi `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `theme_color`, ikon 192 dan 512 px.

### 4. `components/custom-ringtone-settings.tsx`

Salin file ini apa adanya (377 baris, tanpa dependensi khusus selain shadcn `Button`, `sonner`, `lucide-react`). Spesifikasinya:

- Batas: 30 detik, 8 MB.
- **Upload Audio** (`accept="audio/*"`): baca durasi via metadata `<audio>`, tolak jika > 31 detik.
- **Rekam Suara**: `getUserMedia({ audio: true })` + `MediaRecorder` (`audio/webm`, fallback `audio/mp4`); tombol berubah jadi "Stop (0:xx/0:30)" merah dengan titik berdenyut; auto-stop di 30 detik.
- Hasil upload/rekam tampil dulu sebagai preview `<audio controls>` dengan tombol **Batal** dan **Simpan & Gunakan**; menyimpan otomatis mengubah `soundType` ke `"custom"`.
- Ringtone tersimpan tampil sebagai kartu: nama, durasi, "tersimpan di device ini", label "aktif"; tombol **Gunakan** (jika belum aktif), Play, dan Hapus. Menghapus ringtone yang aktif mengembalikan `soundType` ke `"tritone"`.

## Checklist Implementasi di Website Lain

Kerjakan berurutan; tema, aksen, dan font tidak butuh database dan bisa selesai duluan.

**Persiapan**

- [ ] `npm i next-themes sonner lucide-react web-push tailwindcss-animate` (dan `@types/web-push` di devDependencies)
- [ ] `npx shadcn@latest add button dropdown-menu popover slider label`

**Tema, aksen, font**

- [ ] Salin `lib/fonts.ts` dan `lib/font-options.ts`
- [ ] Salin `lib/theme-provider.tsx`; ganti 2 warna perusahaan (`gmi`, `gis`) dengan brand website tujuan
- [ ] Di `app/globals.css`: `@custom-variant dark`, blok `@theme` + `@theme inline`, 4 tema, 18 aksen (+ varian `.soft-dark.theme-*` dan `.dark.theme-<perusahaan>`), CSS font & ukuran, border per tema, sidebar per tema
- [ ] Di `app/layout.tsx`: `className={fontVariables}` + `suppressHydrationWarning` di `<html>`, `fontInitScript` di `<head>`, `CustomThemeProvider` dengan `themes={["light", "dark", "soft-light", "soft-dark"]}`, `<Toaster richColors position="bottom-right" />`
- [ ] Salin `theme-switcher.tsx`, `accent-theme-switcher.tsx`, `font-switcher.tsx`; pasang di halaman profil dan halaman login
- [ ] Jika ada fitur cetak: set `html[data-printing]` selama cetak agar ukuran font user tidak ikut

**Notifikasi**

- [ ] Jalankan SQL `notifications` + RPC `create_notifications` + Realtime + `push_subscriptions`
- [ ] Generate VAPID key, isi 4 env VAPID + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Salin `lib/notifications/settings.ts`, `sound.ts`, `custom-sound-db.ts`, `push.ts`, `client.ts`; ganti prefix storage `ga-` dan union jenis event
- [ ] Salin `public/sw.js` (ganti judul default "Garuda Procure"), `public/manifest.json`, ikon 192/512, `lib/pwa/use-install-prompt.ts`
- [ ] Salin `app/api/push/send/route.ts` dan tambahkan cek login di awal `POST`
- [ ] Salin `NotificationProvider.tsx` (ganti ikon `/lourdes.png`), bungkus `children` di layout
- [ ] Salin `notification-settings.tsx` dan `custom-ringtone-settings.tsx`; ganti nama app "MR-PO GA LOURDES" di kartu Install

**Uji**

- [ ] Ganti tiap tema × aksen, reload: tidak ada kedipan font; aksen tetap tersimpan
- [ ] Ukuran font Besar: semua teks dan spasi ikut membesar
- [ ] Kirim notif tes dari SQL Editor: `select public.create_notifications(jsonb_build_array(jsonb_build_object('user_id','<UUID>','type','info','title','Tes','message','Halo','link','/')));` (jalankan sebagai user lain, karena notif ke diri sendiri dilewati)
- [ ] Console menampilkan `[Notif] realtime status: SUBSCRIBED`; suara, toast, dan notifikasi browser muncul sesuai toggle
- [ ] Aktifkan Notifikasi HP, tutup browser, kirim notif: notifikasi OS muncul dan klik membuka link
