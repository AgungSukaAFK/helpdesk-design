"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import {
  ACCENT_STORAGE_KEY, BASE_ACCENT, DEFAULT_ACCENT, DEFAULT_RADIUS, LEGACY_ACCENT_MAP,
  LEGACY_ACCENT_STORAGE_KEY, RADIUS_STORAGE_KEY, accentThemes, radiusOptions,
  type AccentTheme, type RadiusOption,
} from "@/lib/accent-options";
import {
  DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, FONT_FAMILY_STORAGE_KEY, FONT_SIZE_STORAGE_KEY,
  fontFamilies, fontSizes, type FontFamily, type FontSize,
} from "@/lib/font-options";

interface CustomThemeContextType {
  accent: AccentTheme;
  setAccent: (accent: AccentTheme) => void;
  radius: RadiusOption;
  setRadius: (radius: RadiusOption) => void;
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const CustomThemeContext = createContext<CustomThemeContextType | undefined>(undefined);

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function readStoredAccent(): AccentTheme {
  const stored = readStorage(ACCENT_STORAGE_KEY);
  if (stored) return accentThemes.find((t) => t.name === stored)?.name ?? DEFAULT_ACCENT;
  const legacy = readStorage(LEGACY_ACCENT_STORAGE_KEY);
  return (legacy && LEGACY_ACCENT_MAP[legacy]) || DEFAULT_ACCENT;
}

export function CustomThemeProvider({ children, ...props }: ThemeProviderProps) {
  // null = belum dibaca dari localStorage, supaya nilai dari script anti-flash
  // tidak tertimpa default dulu.
  const [accent, setAccent] = useState<AccentTheme | null>(null);
  const [radius, setRadius] = useState<RadiusOption | null>(null);
  const [fontFamily, setFontFamily] = useState<FontFamily | null>(null);
  const [fontSize, setFontSize] = useState<FontSize | null>(null);

  useEffect(() => {
    setAccent(readStoredAccent());
    const storedRadius = readStorage(RADIUS_STORAGE_KEY);
    setRadius(radiusOptions.find((r) => r.name === storedRadius)?.name ?? DEFAULT_RADIUS);
    const storedFont = readStorage(FONT_FAMILY_STORAGE_KEY);
    setFontFamily(fontFamilies.find((f) => f.name === storedFont)?.name ?? DEFAULT_FONT_FAMILY);
    const storedSize = readStorage(FONT_SIZE_STORAGE_KEY);
    setFontSize(fontSizes.find((s) => s.name === storedSize)?.name ?? DEFAULT_FONT_SIZE);
  }, []);

  useEffect(() => {
    if (!accent) return;
    const root = window.document.documentElement;
    accentThemes.forEach((theme) => root.classList.remove(`theme-${theme.name}`));
    if (accent !== BASE_ACCENT) root.classList.add(`theme-${accent}`);
    writeStorage(ACCENT_STORAGE_KEY, accent);
  }, [accent]);

  useEffect(() => {
    if (!radius) return;
    const root = window.document.documentElement;
    if (radius === DEFAULT_RADIUS) delete root.dataset.radius;
    else root.dataset.radius = radius;
    writeStorage(RADIUS_STORAGE_KEY, radius);
  }, [radius]);

  useEffect(() => {
    if (!fontFamily) return;
    const root = window.document.documentElement;
    if (fontFamily === DEFAULT_FONT_FAMILY) delete root.dataset.font;
    else root.dataset.font = fontFamily;
    writeStorage(FONT_FAMILY_STORAGE_KEY, fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    if (!fontSize) return;
    const root = window.document.documentElement;
    if (fontSize === DEFAULT_FONT_SIZE) delete root.dataset.fontSize;
    else root.dataset.fontSize = fontSize;
    writeStorage(FONT_SIZE_STORAGE_KEY, fontSize);
  }, [fontSize]);

  return (
    <CustomThemeContext.Provider
      value={{
        accent: accent ?? DEFAULT_ACCENT, setAccent,
        radius: radius ?? DEFAULT_RADIUS, setRadius,
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
