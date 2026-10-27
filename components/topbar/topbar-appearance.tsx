"use client";

import * as React from "react";
import { Check, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { THEME_OPTIONS } from "@/components/theme-switcher";
import { FontSettingsPanel } from "@/components/font-switcher";
import { useCustomTheme } from "@/lib/theme-provider";
import { accentThemes, radiusOptions } from "@/lib/accent-options";
import { originFromEvent, runViewTransition } from "@/lib/view-transition";
import { cn } from "@/lib/utils";
import { TopbarIconButton } from "./topbar-icon-button";

const companyThemes = accentThemes.filter((t) => t.group === "company");
const generalThemes = accentThemes.filter((t) => t.group === "general");

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{children}</span>;
}

function ThemeTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={(e) => {
              if (selected) return;
              runViewTransition(() => setTheme(value), { mode: "reveal", origin: originFromEvent(e) });
            }}
            className={cn(
              "relative flex flex-col items-center gap-1.5 rounded-md border px-1 py-2.5 text-xs transition-colors hover:bg-accent",
              selected && "border-primary bg-primary/5 font-semibold text-foreground",
            )}
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="truncate">{label}</span>
            {selected && (
              <span
                className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                style={{ viewTransitionName: "appearance-mode" }}
              >
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function AccentTab() {
  const { accent, setAccent, radius, setRadius } = useCustomTheme();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <SectionLabel>Warna Perusahaan</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {companyThemes.map((t) => {
            const selected = accent === t.name;
            return (
              <button
                key={t.name}
                type="button"
                aria-pressed={selected}
                onClick={() => setAccent(t.name)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent",
                  selected && "border-primary",
                )}
              >
                <span className="size-5 shrink-0 rounded-full border" style={{ backgroundColor: t.color }} />
                <span className="font-semibold">{t.label}</span>
                {selected && (
                  <Check className="ml-auto size-4" style={{ viewTransitionName: "appearance-accent" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Warna Umum</SectionLabel>
        <div className="grid grid-cols-4 gap-1">
          {generalThemes.map((t) => {
            const selected = accent === t.name;
            return (
              <button
                key={t.name}
                type="button"
                title={t.label}
                aria-label={t.label}
                aria-pressed={selected}
                onClick={() => setAccent(t.name)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 hover:bg-accent",
                  selected && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border",
                    selected && "ring-2 ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: t.color, "--tw-ring-color": t.color } as React.CSSProperties}
                >
                  {selected && (
                    <Check
                      className="size-3.5 text-white"
                      strokeWidth={3}
                      style={{ viewTransitionName: "appearance-accent" }}
                    />
                  )}
                </span>
                <span className="w-full truncate text-center text-[10px] leading-tight">
                  {t.name === "emerald" ? "Default" : t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Kelengkungan Sudut</SectionLabel>
        <div className="grid grid-cols-3 gap-1">
          {radiusOptions.map((r) => {
            const selected = radius === r.name;
            return (
              <button
                key={r.name}
                type="button"
                aria-pressed={selected}
                onClick={() => setRadius(r.name)}
                className={cn(
                  "border px-1 py-1.5 text-xs hover:bg-accent",
                  selected && "border-primary bg-accent font-semibold",
                )}
                style={{ borderRadius: r.value }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TopbarAppearance() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <TopbarIconButton label="Tampilan">
          <Palette />
        </TopbarIconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(20rem,calc(100vw-1rem))] p-3"
      >
        <p className="mb-2 text-sm font-semibold">Tampilan</p>
        {/* Tema & aksen dibaca dari localStorage, jadi baru dirender setelah mount. */}
        {mounted && (
          <Tabs defaultValue="tema">
            <TabsList className="mb-3 w-full">
              <TabsTrigger value="tema">Tema</TabsTrigger>
              <TabsTrigger value="aksen">Aksen</TabsTrigger>
              <TabsTrigger value="font">Font</TabsTrigger>
            </TabsList>
            <TabsContent value="tema">
              <ThemeTab />
            </TabsContent>
            <TabsContent value="aksen">
              <AccentTab />
            </TabsContent>
            <TabsContent value="font">
              <FontSettingsPanel />
            </TabsContent>
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}
