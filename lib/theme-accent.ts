export type AccentColorId =
  | "forest"
  | "emerald"
  | "blue"
  | "violet"
  | "amber"
  | "rose"
  | "slate";

export interface AccentColorPreset {
  id: AccentColorId;
  name: string;
  sampleColor: string; // Used for the swatch dot/indicator
  light: {
    primary: string; // e.g. "144 59% 22%"
    primaryForeground: string;
    ring: string;
    accent: string;
    accentForeground: string;
    chart1: string;
    sidebarPrimary: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
  };
  dark: {
    primary: string;
    primaryForeground: string;
    ring: string;
    accent: string;
    accentForeground: string;
    chart1: string;
    sidebarPrimary: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
  };
}

export const ACCENT_PRESETS: AccentColorPreset[] = [
  {
    id: "forest",
    name: "Forest Green",
    sampleColor: "rgb(23, 88, 49)",
    light: {
      primary: "144 59% 22%",
      primaryForeground: "0 0% 100%",
      ring: "144 59% 28%",
      accent: "144 35% 93%",
      accentForeground: "144 59% 18%",
      chart1: "144 59% 28%",
      sidebarPrimary: "hsl(144 59% 22%)",
      sidebarAccent: "hsl(144 35% 93%)",
      sidebarAccentForeground: "hsl(144 59% 18%)",
    },
    dark: {
      primary: "144 50% 46%",
      primaryForeground: "0 0% 100%",
      ring: "144 50% 50%",
      accent: "144 30% 16%",
      accentForeground: "144 50% 90%",
      chart1: "144 50% 46%",
      sidebarPrimary: "hsl(144 50% 46%)",
      sidebarAccent: "hsl(144 30% 16%)",
      sidebarAccentForeground: "hsl(144 50% 90%)",
    },
  },
  {
    id: "emerald",
    name: "Emerald Teal",
    sampleColor: "rgb(15, 138, 120)",
    light: {
      primary: "173 80% 30%",
      primaryForeground: "0 0% 100%",
      ring: "173 80% 36%",
      accent: "173 60% 94%",
      accentForeground: "173 80% 22%",
      chart1: "173 80% 36%",
      sidebarPrimary: "hsl(173 80% 30%)",
      sidebarAccent: "hsl(173 60% 94%)",
      sidebarAccentForeground: "hsl(173 80% 22%)",
    },
    dark: {
      primary: "173 70% 44%",
      primaryForeground: "0 0% 100%",
      ring: "173 70% 50%",
      accent: "173 35% 16%",
      accentForeground: "173 70% 90%",
      chart1: "173 70% 44%",
      sidebarPrimary: "hsl(173 70% 44%)",
      sidebarAccent: "hsl(173 35% 16%)",
      sidebarAccentForeground: "hsl(173 70% 90%)",
    },
  },
  {
    id: "blue",
    name: "Ocean Blue",
    sampleColor: "rgb(30, 95, 215)",
    light: {
      primary: "217 91% 48%",
      primaryForeground: "0 0% 100%",
      ring: "217 91% 54%",
      accent: "217 80% 94%",
      accentForeground: "217 91% 30%",
      chart1: "217 91% 48%",
      sidebarPrimary: "hsl(217 91% 48%)",
      sidebarAccent: "hsl(217 80% 94%)",
      sidebarAccentForeground: "hsl(217 91% 30%)",
    },
    dark: {
      primary: "217 91% 60%",
      primaryForeground: "0 0% 100%",
      ring: "217 91% 65%",
      accent: "217 40% 16%",
      accentForeground: "217 91% 90%",
      chart1: "217 91% 60%",
      sidebarPrimary: "hsl(217 91% 60%)",
      sidebarAccent: "hsl(217 40% 16%)",
      sidebarAccentForeground: "hsl(217 91% 90%)",
    },
  },
  {
    id: "violet",
    name: "Royal Violet",
    sampleColor: "rgb(124, 58, 237)",
    light: {
      primary: "263 70% 50%",
      primaryForeground: "0 0% 100%",
      ring: "263 70% 56%",
      accent: "263 70% 95%",
      accentForeground: "263 70% 30%",
      chart1: "263 70% 50%",
      sidebarPrimary: "hsl(263 70% 50%)",
      sidebarAccent: "hsl(263 70% 95%)",
      sidebarAccentForeground: "hsl(263 70% 30%)",
    },
    dark: {
      primary: "263 75% 65%",
      primaryForeground: "0 0% 100%",
      ring: "263 75% 70%",
      accent: "263 35% 16%",
      accentForeground: "263 75% 90%",
      chart1: "263 75% 65%",
      sidebarPrimary: "hsl(263 75% 65%)",
      sidebarAccent: "hsl(263 35% 16%)",
      sidebarAccentForeground: "hsl(263 75% 90%)",
    },
  },
  {
    id: "amber",
    name: "Sunset Amber",
    sampleColor: "rgb(217, 119, 6)",
    light: {
      primary: "38 92% 44%",
      primaryForeground: "0 0% 100%",
      ring: "38 92% 50%",
      accent: "38 90% 93%",
      accentForeground: "38 92% 25%",
      chart1: "38 92% 44%",
      sidebarPrimary: "hsl(38 92% 44%)",
      sidebarAccent: "hsl(38 90% 93%)",
      sidebarAccentForeground: "hsl(38 92% 25%)",
    },
    dark: {
      primary: "38 92% 50%",
      primaryForeground: "0 0% 100%",
      ring: "38 92% 55%",
      accent: "38 40% 16%",
      accentForeground: "38 92% 90%",
      chart1: "38 92% 50%",
      sidebarPrimary: "hsl(38 92% 50%)",
      sidebarAccent: "hsl(38 40% 16%)",
      sidebarAccentForeground: "hsl(38 92% 90%)",
    },
  },
  {
    id: "rose",
    name: "Crimson Rose",
    sampleColor: "rgb(225, 29, 72)",
    light: {
      primary: "346 84% 50%",
      primaryForeground: "0 0% 100%",
      ring: "346 84% 55%",
      accent: "346 80% 95%",
      accentForeground: "346 84% 30%",
      chart1: "346 84% 50%",
      sidebarPrimary: "hsl(346 84% 50%)",
      sidebarAccent: "hsl(346 80% 95%)",
      sidebarAccentForeground: "hsl(346 84% 30%)",
    },
    dark: {
      primary: "346 84% 60%",
      primaryForeground: "0 0% 100%",
      ring: "346 84% 65%",
      accent: "346 35% 16%",
      accentForeground: "346 84% 90%",
      chart1: "346 84% 60%",
      sidebarPrimary: "hsl(346 84% 60%)",
      sidebarAccent: "hsl(346 35% 16%)",
      sidebarAccentForeground: "hsl(346 84% 90%)",
    },
  },
  {
    id: "slate",
    name: "Midnight Slate",
    sampleColor: "rgb(51, 65, 85)",
    light: {
      primary: "222.2 47.4% 25%",
      primaryForeground: "0 0% 100%",
      ring: "222.2 47.4% 35%",
      accent: "215 20% 92%",
      accentForeground: "222.2 47.4% 15%",
      chart1: "222.2 47.4% 30%",
      sidebarPrimary: "hsl(222.2 47.4% 25%)",
      sidebarAccent: "hsl(215 20% 92%)",
      sidebarAccentForeground: "hsl(222.2 47.4% 15%)",
    },
    dark: {
      primary: "215 20% 85%",
      primaryForeground: "222.2 47.4% 11.2%",
      ring: "215 20% 70%",
      accent: "217.2 32.6% 17.5%",
      accentForeground: "210 40% 98%",
      chart1: "215 20% 85%",
      sidebarPrimary: "hsl(215 20% 85%)",
      sidebarAccent: "hsl(217.2 32.6% 17.5%)",
      sidebarAccentForeground: "hsl(210 40% 98%)",
    },
  },
];

export const RADIUS_PRESETS = [
  { id: "sm", label: "Tajam", value: "0.375rem" },
  { id: "default", label: "Standar", value: "0.625rem" },
  { id: "lg", label: "Bulat", value: "0.875rem" },
] as const;

export const DEFAULT_ACCENT_ID: AccentColorId = "emerald";
export const DEFAULT_RADIUS_ID = "default";

export function applyThemeAccent(accentId: AccentColorId, radiusId = "default") {
  if (typeof window === "undefined") return;

  const preset = ACCENT_PRESETS.find((p) => p.id === accentId) || ACCENT_PRESETS[1];
  const radius = RADIUS_PRESETS.find((r) => r.id === radiusId) || RADIUS_PRESETS[1];

  let styleTag = document.getElementById("theme-accent-styles") as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "theme-accent-styles";
    document.head.appendChild(styleTag);
  }

  styleTag.innerHTML = `
    :root {
      --primary: ${preset.light.primary};
      --primary-foreground: ${preset.light.primaryForeground};
      --ring: ${preset.light.ring};
      --accent: ${preset.light.accent};
      --accent-foreground: ${preset.light.accentForeground};
      --chart-1: ${preset.light.chart1};
      --sidebar-primary: ${preset.light.sidebarPrimary};
      --sidebar-accent: ${preset.light.sidebarAccent};
      --sidebar-accent-foreground: ${preset.light.sidebarAccentForeground};
      --radius: ${radius.value};
    }
    .dark {
      --primary: ${preset.dark.primary};
      --primary-foreground: ${preset.dark.primaryForeground};
      --ring: ${preset.dark.ring};
      --accent: ${preset.dark.accent};
      --accent-foreground: ${preset.dark.accentForeground};
      --chart-1: ${preset.dark.chart1};
      --sidebar-primary: ${preset.dark.sidebarPrimary};
      --sidebar-accent: ${preset.dark.sidebarAccent};
      --sidebar-accent-foreground: ${preset.dark.sidebarAccentForeground};
      --radius: ${radius.value};
    }
  `;
}
