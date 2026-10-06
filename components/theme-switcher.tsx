"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ACCENT_PRESETS,
  AccentColorId,
  applyThemeAccent,
  DEFAULT_ACCENT_ID,
  DEFAULT_RADIUS_ID,
  RADIUS_PRESETS,
} from "@/lib/theme-accent";

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [accent, setAccent] = useState<AccentColorId>(DEFAULT_ACCENT_ID);
  const [radius, setRadius] = useState<string>(DEFAULT_RADIUS_ID);

  useEffect(() => {
    setMounted(true);
    try {
      const savedAccent = (localStorage.getItem("theme-accent") as AccentColorId) || DEFAULT_ACCENT_ID;
      const savedRadius = localStorage.getItem("theme-radius") || DEFAULT_RADIUS_ID;
      setAccent(savedAccent);
      setRadius(savedRadius);
      applyThemeAccent(savedAccent, savedRadius);
    } catch {
      // Ignore
    }
  }, []);

  const handleSelectAccent = (id: AccentColorId) => {
    setAccent(id);
    localStorage.setItem("theme-accent", id);
    applyThemeAccent(id, radius);
  };

  const handleSelectRadius = (rId: string) => {
    setRadius(rId);
    localStorage.setItem("theme-radius", rId);
    applyThemeAccent(accent, rId);
  };

  const handleReset = () => {
    setAccent(DEFAULT_ACCENT_ID);
    setRadius(DEFAULT_RADIUS_ID);
    localStorage.setItem("theme-accent", DEFAULT_ACCENT_ID);
    localStorage.setItem("theme-radius", DEFAULT_RADIUS_ID);
    applyThemeAccent(DEFAULT_ACCENT_ID, DEFAULT_RADIUS_ID);
  };

  const currentPreset = ACCENT_PRESETS.find((p) => p.id === accent) || ACCENT_PRESETS[1];

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-8 rounded-md px-3 text-xs border border-border/70 bg-background/80"
        title="Warna aksen"
      >
        <Palette className="size-4 text-muted-foreground pointer-events-none shrink-0" />
        <span
          className="h-3 w-3 rounded-full border border-black/10 dark:border-white/20"
          style={{ backgroundColor: "rgb(15, 138, 120)" }}
        />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs border border-border/80 bg-background/90 shadow-xs cursor-pointer"
          title="Warna aksen & tema tampilan"
          aria-haspopup="menu"
        >
          <Palette className="text-muted-foreground size-4 shrink-0" />
          <span
            className="h-3 w-3 rounded-full border border-black/15 dark:border-white/25 shadow-xs transition-transform hover:scale-110"
            style={{ backgroundColor: currentPreset.sampleColor }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-76 sm:w-80 p-3.5 shadow-xl border border-border/80 rounded-xl bg-popover text-popover-foreground space-y-3.5 z-50 animate-in fade-in-50 zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-tight">Kustomisasi Tampilan</span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {currentPreset.name}
          </span>
        </div>

        {/* 1. Mode Tampilan */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Mode Tampilan
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/50">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                theme === "light"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              <Sun className="size-3.5 text-amber-500" />
              <span>Terang</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              <Moon className="size-3.5 text-sky-400" />
              <span>Gelap</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                theme === "system"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              <Laptop className="size-3.5 text-muted-foreground" />
              <span>Sistem</span>
            </button>
          </div>
        </div>

        {/* 2. Warna Aksen */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Warna Aksen (Brand Theme)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ACCENT_PRESETS.map((p) => {
              const isSelected = accent === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectAccent(p.id)}
                  title={p.name}
                  className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                      : "border-border/60 hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <span
                    className="size-5 rounded-full border border-black/15 dark:border-white/20 flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: p.sampleColor }}
                  >
                    {isSelected && (
                      <Check className="size-3 text-white drop-shadow-md stroke-[3]" />
                    )}
                  </span>
                  <span className="text-[10px] font-medium text-center truncate max-w-full leading-none">
                    {p.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Kelengkungan Sudut (Radius) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Kelengkungan Sudut
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/50">
            {RADIUS_PRESETS.map((r) => {
              const isSelected = radius === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRadius(r.id)}
                  className={`py-1 px-2 rounded-md text-xs font-medium text-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer / Reset */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCcw className="size-3" />
            <span>Reset Standar</span>
          </Button>
          <span className="text-[10px] text-muted-foreground/70">
            Disimpan otomatis
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Direct 1-click toggle button between light & dark mode.
 */
export function ThemeToggleSimple({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`size-8 sm:size-9 rounded-lg border border-border/70 bg-background/80 hover:bg-muted/80 shadow-xs transition-colors cursor-pointer ${className || ""}`}
      title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
      aria-label="Toggle Dark / Light mode"
    >
      {isDark ? (
        <Moon className="size-4 text-sky-400" />
      ) : (
        <Sun className="size-4 text-amber-500" />
      )}
      <span className="sr-only">Toggle Dark/Light</span>
    </Button>
  );
}

export default ThemeSwitcher;
