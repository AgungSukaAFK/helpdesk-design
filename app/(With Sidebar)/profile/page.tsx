"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { AppearanceSwitchers } from "@/components/theme-switcher";
import { NotificationSettings } from "@/components/notification-settings";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { FileDropArea } from "@/components/file-drop";

const MAX_AVATAR_SIZE = 10 * 1024 * 1024;

function getAvatarStoragePath(avatarUrl: string | null | undefined) {
  if (!avatarUrl) return null;
  try {
    const pathname = new URL(avatarUrl).pathname;
    const marker = "/storage/v1/object/public/permintaan/";
    const markerIndex = pathname.indexOf(marker);
    return markerIndex >= 0 ? decodeURIComponent(pathname.slice(markerIndex + marker.length)) : null;
  } catch {
    return avatarUrl.startsWith("avatars/") ? avatarUrl : null;
  }
}

type Profile = {
  name: string | null;
  role: string | null;
  email: string | null;
  perusahaan?: string | null;
  lokasi?: string | null;
  departemen?: string | null; // Database actually has 'departemen'
  avatar_url?: string | null;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<Profile>({
    name: null,
    role: null,
    email: null,
    perusahaan: null,
    lokasi: null,
    departemen: null,
    avatar_url: null,
  });
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // Passwords
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchUserData() {
      const supabase = createClient();
      setLoading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }
        setUser(user);

        // Include new fields if they exist in DB
        const { data: profileRes, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError || !profileRes) {
          console.error("Profile not found or error:", profileError);
          return;
        }

        const fetchedProfile = profileRes as Profile;
        setProfile(fetchedProfile);
        setFormData({
          ...fetchedProfile,
          email: user.email || null,
        });
      } catch (err) {
        console.error("An unexpected error occurred:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);
    const supabase = createClient();

    try {
      const { error: profileError } = await supabase.from("user_profiles").update({
        name: formData.name,
        perusahaan: formData.perusahaan,
        lokasi: formData.lokasi,
        departemen: formData.departemen,
      }).eq("id", user.id);

      if (profileError) throw profileError;
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: { name: formData.name } }));

      // Check if email changed
      if (formData.email !== user.email && formData.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        });
        if (emailError) throw emailError;
        toast.success("Cek email baru Anda untuk konfirmasi perubahan.");
        setUser({ ...user, email: formData.email });
      } else {
        toast.success("Profil berhasil diperbarui.");
      }
      setProfile(formData);
      setIsEditingProfile(false);
    } catch (error: any) {
      toast.error("Gagal memperbarui profil: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelProfileEdit = () => {
    if (profile) setFormData({ ...profile, email: user?.email || profile.email });
    setIsEditingProfile(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await uploadAvatarFile(file);
  };

  const uploadAvatarFile = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File foto harus berupa gambar.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Ukuran foto maksimal 10 MB.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `avatars/${user.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("permintaan")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("permintaan").getPublicUrl(path);
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (profileError) {
        await supabase.storage.from("permintaan").remove([path]);
        throw profileError;
      }

      const oldPath = getAvatarStoragePath(profile?.avatar_url);
      if (oldPath && oldPath.startsWith(`avatars/${user.id}/`)) {
        await supabase.storage.from("permintaan").remove([oldPath]);
      }
      setProfile((current) => current ? { ...current, avatar_url: data.publicUrl } : current);
      setFormData((current) => ({ ...current, avatar_url: data.publicUrl }));
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: { avatar_url: data.publicUrl } }));
      toast.success("Foto profil berhasil diperbarui.");
    } catch (error) {
      toast.error("Gagal mengunggah foto: " + (error instanceof Error ? error.message : "Terjadi kesalahan."));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile?.avatar_url) return;
    setIsUploadingAvatar(true);
    try {
      const supabase = createClient();
      const oldPath = getAvatarStoragePath(profile.avatar_url);
      if (oldPath?.startsWith(`avatars/${user.id}/`)) {
        const { error } = await supabase.storage.from("permintaan").remove([oldPath]);
        if (error) throw error;
      }
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (profileError) throw profileError;
      setProfile((current) => current ? { ...current, avatar_url: null } : current);
      setFormData((current) => ({ ...current, avatar_url: null }));
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: { avatar_url: null } }));
      toast.success("Foto profil dihapus.");
    } catch (error) {
      toast.error("Gagal menghapus foto: " + (error instanceof Error ? error.message : "Terjadi kesalahan."));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Password baru dan konfirmasi tidak cocok.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }
    if (!user?.email) return;

    setIsChangingPassword(true);
    const supabase = createClient();
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) throw new Error("Password saat ini salah.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password berhasil diganti.");
    } catch (error: any) {
      toast.error("Gagal mengganti password: " + error.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground animate-pulse">Memuat Profil...</p>
      </div>
    );
  }

  return (
    <div className="col-span-12 flex w-full max-w-4xl flex-col gap-6 mx-auto pb-10">
      {/* 1. DATA PROFIL */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-6">Data Profil</h2>
          
          <FileDropArea
            onFiles={(files) => uploadAvatarFile(files[0])}
            accept="image/png,image/jpeg,image/webp"
            multiple={false}
            disabled={isUploadingAvatar}
            label="Lepaskan untuk mengganti foto profil"
            className="flex items-center gap-6 mb-8 rounded-xl"
          >
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border bg-muted">
              {formData.avatar_url ? (
                <Image src={formData.avatar_url} alt="Avatar" fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary text-xl font-bold">
                  {formData.name?.charAt(0) || "U"}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-base">{formData.name || "-"}</h3>
              <p className="text-xs text-muted-foreground mb-1">
                JPG, PNG, atau WebP. Maksimal 10 MB. Bisa juga tarik &amp; lepas foto ke area ini.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8 gap-2 bg-emerald-500 hover:bg-emerald-600" onClick={triggerFileUpload} disabled={isUploadingAvatar}>
                  {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {isUploadingAvatar ? "Memproses..." : "Ganti Foto"}
                </Button>
                <input type="file" className="hidden" ref={fileInputRef} accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} />
                <Button size="sm" variant="outline" className="h-8" onClick={handleRemoveAvatar} disabled={!profile?.avatar_url || isUploadingAvatar}>
                  Hapus
                </Button>
              </div>
            </div>
          </FileDropArea>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                name="name"
                value={formData.name || ""}
                onChange={handleInputChange}
                className="bg-muted/30"
                disabled={!isEditingProfile || isUpdating}
              />
            </div>
            

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                value={formData.email || ""}
                readOnly
                className="bg-muted/30 text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                name="role"
                value={formData.role || ""}
                readOnly
                className="bg-muted/30 text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="perusahaan">Perusahaan</Label>
              <Select
                value={formData.perusahaan || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, perusahaan: value }))}
                disabled={!isEditingProfile || isUpdating}
              >
                <SelectTrigger id="perusahaan" className="bg-muted/30">
                  <SelectValue placeholder="Pilih Perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PT. Global Inti Sejati">PT. Global Inti Sejati</SelectItem>
                  <SelectItem value="PT. Garuda Mart Indonesia">PT. Garuda Mart Indonesia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="lokasi">Lokasi</Label>
              <Select
                value={formData.lokasi || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, lokasi: value }))}
                disabled={!isEditingProfile || isUpdating}
              >
                <SelectTrigger id="lokasi" className="bg-muted/30">
                  <SelectValue placeholder="Pilih Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  {["GIS HO", "GIS BPN", "GIS J5", "GIS KM8", "GMI BPN", "GMI J5", "GMI KM10", "GMI KM8", "GMI Site", "Branch Tanjung Enim"].map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="departemen">Departemen</Label>
              <Select
                value={formData.departemen || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, departemen: value }))}
                disabled={!isEditingProfile || isUpdating}
              >
                <SelectTrigger id="departemen" className="bg-muted/30">
                  <SelectValue placeholder="Pilih Departemen" />
                </SelectTrigger>
                <SelectContent>
                  {["HSE", "Legal", "HR", "GA", "IT", "SCM", "MARKETING", "RND", "PABRIKASI", "SERVICE"].map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end mt-4">
              {isEditingProfile ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleCancelProfileEdit} disabled={isUpdating}>
                    Batal
                  </Button>
                  <Button type="button" onClick={handleUpdateProfile} disabled={isUpdating} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isUpdating ? "Menyimpan..." : "Simpan Profil"}
                  </Button>
                </div>
              ) : (
                <Button type="button" onClick={() => setIsEditingProfile(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  Edit Profil
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. UBAH PASSWORD */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
            <KeyRound className="h-5 w-5" /> Ubah Password
          </h2>
          
          <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-password">Password Saat Ini</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-muted/30 pr-10"
                />
                <button 
                  type="button" 
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-muted/30 pr-10"
                />
                <button 
                  type="button" 
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-muted/30 pr-10"
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <Button 
                type="submit" 
                disabled={isChangingPassword || !currentPassword || !newPassword}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {isChangingPassword ? "Menyimpan..." : "Simpan Password"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* 3. PENGATURAN TEMA */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Pengaturan Tema</h2>
          <AppearanceSwitchers />
        </div>
      </div>

      {/* 4. PENGATURAN NOTIFIKASI */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}
