// `color` = warna primary mode terang, untuk swatch preview.
// `group: "company"` = warna khusus perusahaan, ditampilkan terpisah di atas.
// Nilai CSS tiap aksen ada di globals.css (class .theme-<name> di <html>).
export const accentThemes = [
  { name: "gmi", label: "GMI", color: "#242365", group: "company" },
  { name: "gis", label: "GIS", color: "rgb(23 88 49)", group: "company" },
  { name: "zinc", label: "Zinc", color: "hsl(240 5.9% 10%)", group: "general" },
  { name: "blue", label: "Blue", color: "hsl(217.2 91.2% 59.8%)", group: "general" },
  { name: "sky", label: "Sky", color: "hsl(200.4 98% 39.4%)", group: "general" },
  { name: "cyan", label: "Cyan", color: "hsl(191.6 91.4% 36.5%)", group: "general" },
  { name: "teal", label: "Teal", color: "hsl(174.7 83.9% 31.6%)", group: "general" },
  { name: "emerald", label: "Emerald (Default)", color: "hsl(161.4 93.5% 30.4%)", group: "general" },
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

export type AccentTheme = (typeof accentThemes)[number]["name"];

// Zinc = palet dasar tanpa class; default DesignDesk tetap emerald.
export const BASE_ACCENT: AccentTheme = "zinc";
export const DEFAULT_ACCENT: AccentTheme = "emerald";
export const ACCENT_STORAGE_KEY = "accent-theme";

// Nilai aksen versi lama (lib/theme-accent.ts) supaya pilihan user tidak hilang.
export const LEGACY_ACCENT_STORAGE_KEY = "theme-accent";
export const LEGACY_ACCENT_MAP: Record<string, AccentTheme> = {
  forest: "gis",
  emerald: "emerald",
  blue: "blue",
  violet: "violet",
  amber: "amber",
  rose: "rose",
  slate: "zinc",
};

// Dipasang sebagai html[data-radius=<name>]; "default" = tanpa atribut.
export const radiusOptions = [
  { name: "sm", label: "Tajam", value: "0.375rem" },
  { name: "default", label: "Standar", value: "0.625rem" },
  { name: "lg", label: "Bulat", value: "0.875rem" },
] as const;

export type RadiusOption = (typeof radiusOptions)[number]["name"];

export const DEFAULT_RADIUS: RadiusOption = "default";
export const RADIUS_STORAGE_KEY = "theme-radius";
