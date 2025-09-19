"use client";

import { Content } from "@/components/content";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Label } from "@/components/ui/label";

// type Profile = {
//   nama: string | null;
//   role: string | null;
//   lokasi: string | null;
//   department: string | null;
// };

export default function Dashboard() {
  return (
    <>
      <Content size="md" title="Data Profil"></Content>
      <Content size="xs">
        <div className="flex justify-between items-center">
          <Label className="text-base font-bold">Pengaturan Tema</Label>
          <ThemeSwitcher />
        </div>
      </Content>
    </>
  );
}
