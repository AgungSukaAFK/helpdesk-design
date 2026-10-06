"use client";

import { useEffect } from "react";
import { applyThemeAccent, AccentColorId, DEFAULT_ACCENT_ID, DEFAULT_RADIUS_ID } from "@/lib/theme-accent";

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const savedAccent = (localStorage.getItem("theme-accent") as AccentColorId) || DEFAULT_ACCENT_ID;
      const savedRadius = localStorage.getItem("theme-radius") || DEFAULT_RADIUS_ID;
      applyThemeAccent(savedAccent, savedRadius);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return <>{children}</>;
}
