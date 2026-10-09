"use client";

import { AccentThemeSwitcher } from "@/components/accent-theme-switcher";
import { FontSwitcher } from "@/components/font-switcher";
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
        <Button variant="ghost" size={"sm"} title="Tema">
          <ActiveIcon key={theme} size={ICON_SIZE} className={"text-muted-foreground"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-content" align="end">
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

/** Urutan tombol sesuai panduan: Aksen → Font → Tema. */
function AppearanceSwitchers({ className }: { className?: string }) {
  return (
    <div className={className ?? "flex items-center gap-1"}>
      <AccentThemeSwitcher />
      <FontSwitcher />
      <ThemeSwitcher />
    </div>
  );
}

export { ThemeSwitcher, AppearanceSwitchers };
