"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
  User,
  Building2,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProfileOrgFields } from "@/components/profile-org-fields";
import { ROLE_OPTIONS, type ProfilOrganisasi } from "@/lib/profile-options";

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  departemen: string;
  perusahaan?: string;
  lokasi?: string;
  avatar_url?: string | null;
}

export default function EditUserPage({
  params,
}: {
  params: Promise<{ userid: string }>;
}) {
  const { userid } = React.use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [org, setOrg] = useState<ProfilOrganisasi>({ perusahaan: "", lokasi: "", departemen: "" });

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const res = await fetch(`/api/user-management/${userid}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const json = await res.json();
        const u = json.data;
        if (!u) throw new Error("Pengguna tidak ditemukan");

        setUser(u);
        setName(u.name || "");
        setRole(u.role || "user");

        setOrg({
          perusahaan: u.perusahaan || "",
          lokasi: u.lokasi || "",
          departemen: u.departemen && u.departemen !== "-" ? u.departemen : "",
        });
      } catch (err: any) {
        toast.error("Gagal memuat pengguna: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [userid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama pengguna tidak boleh kosong");
      return;
    }

    if (!org.departemen.trim()) {
      toast.error("Departemen wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/user-management/${userid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          departemen: org.departemen.trim(),
          perusahaan: org.perusahaan,
          lokasi: org.lokasi,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memperbarui profil");

      toast.success("Profil pengguna berhasil diperbarui!");
      router.push("/user-management");
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Content size="md" title="Edit Profil Pengguna">
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Memuat informasi pengguna...</p>
        </div>
      </Content>
    );
  }

  if (!user) {
    return (
      <Content size="md" title="Pengguna Tidak Ditemukan">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Pengguna dengan ID tersebut tidak ditemukan dalam sistem.
          </p>
          <Button variant="outline" asChild>
            <Link href="/user-management">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke User Management
            </Link>
          </Button>
        </div>
      </Content>
    );
  }

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <Content size="md">
      <div className="space-y-6">
        {/* TOP BAR */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/user-management">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar
            </Link>
          </Button>

          <Badge variant={role === "admin" ? "default" : "outline"} className="gap-1">
            {role === "admin" ? <ShieldCheck className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            {role === "admin" ? "Admin" : role === "designer" ? "Designer" : "User"}
          </Badge>
        </div>

        {/* PROFILE HEADER CARD */}
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
          <Avatar className="h-14 w-14 border-2 border-background shadow-sm text-base font-bold">
            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={name} className="object-cover" />}
            <AvatarFallback className={role === "admin" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold" : "bg-primary/10 text-primary"}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-bold text-foreground leading-none truncate">{name || user.email}</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{user.email}</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">ID: {user.id}</p>
          </div>
        </div>

        {/* EDIT FORM */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Nama Lengkap */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-name">
              Nama <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Paulus Sianipar"
              required
            />
          </div>

          {/* Email (Readonly info) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              value={user.email}
              disabled
              className="bg-muted/50 cursor-not-allowed"
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue placeholder="Pilih Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Perusahaan, Lokasi, Departemen: sama persis dengan My Profile */}
          <ProfileOrgFields idPrefix="user" value={org} onChange={setOrg} disabled={saving} triggerClassName="w-full" />

          {/* FOOTER BUTTONS */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/user-management")}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Content>
  );
}
