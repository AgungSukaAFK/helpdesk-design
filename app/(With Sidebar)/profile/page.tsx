"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Trash2, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Upload, 
  Mic, 
  Bell, 
  Play,
  Download,
  Smartphone,
  Loader2
} from "lucide-react";
import Image from "next/image";
import { FileDropArea } from "@/components/file-drop";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  readNotificationPreferences,
  writeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import { playNotificationAudio } from "@/lib/notification-audio";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const MAX_AVATAR_SIZE = 10 * 1024 * 1024;
const MAX_RINGTONE_SIZE = 1.5 * 1024 * 1024;
const MAX_RINGTONE_DURATION_SECONDS = 30;

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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("File audio tidak dapat dibaca."));
    reader.onerror = () => reject(new Error("File audio tidak dapat dibaca."));
    reader.readAsDataURL(blob);
  });
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

  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [isRecordingRingtone, setIsRecordingRingtone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ringtoneInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
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

  useEffect(() => {
    if (!user?.id) return;
    setNotificationPreferences(readNotificationPreferences(user.id));
    setPreferencesLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !preferencesLoaded) return;
    if (!writeNotificationPreferences(user.id, notificationPreferences)) {
      toast.error("Pengaturan notifikasi tidak dapat disimpan di perangkat ini.");
    }
  }, [user?.id, preferencesLoaded, notificationPreferences]);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(mediaQuery.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

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

  const updateNotificationPreferences = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setNotificationPreferences((current) => ({ ...current, [key]: value }));
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Browser ini tidak mendukung notifikasi.");
      return false;
    }
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Izin notifikasi belum diberikan di pengaturan browser.");
      return false;
    }
    return true;
  };

  const handleBrowserNotificationToggle = async (enabled: boolean) => {
    if (enabled && !(await requestNotificationPermission())) return;
    updateNotificationPreferences("browser", enabled);
  };

  const handleDeviceNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!("serviceWorker" in navigator) || !(await requestNotificationPermission())) return;
      try {
        await navigator.serviceWorker.ready;
      } catch {
        toast.error("Service worker tidak dapat diaktifkan di perangkat ini.");
        return;
      }
    }
    updateNotificationPreferences("device", enabled);
  };

  const handlePreviewSound = async () => {
    try {
      await playNotificationAudio({ ...notificationPreferences, sound: true });
    } catch {
      toast.error("Browser memblokir pemutaran suara. Coba lagi setelah berinteraksi dengan halaman.");
    }
  };

  const handleRingtoneUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await saveRingtoneFile(file);
  };

  const saveRingtoneFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("File ringtone harus berupa audio.");
      return;
    }
    if (file.size > MAX_RINGTONE_SIZE) {
      toast.error("Ukuran ringtone maksimal 1,5 MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => reject(new Error("Audio tidak dapat dibaca."));
        audio.src = objectUrl;
      });
      if (!Number.isFinite(duration) || duration > MAX_RINGTONE_DURATION_SECONDS) {
        throw new Error("Durasi ringtone maksimal 30 detik.");
      }
      const dataUrl = await blobToDataUrl(file);
      updateNotificationPreferences("customAudioName", file.name);
      updateNotificationPreferences("customAudioDataUrl", dataUrl);
      toast.success("Ringtone tersimpan di perangkat ini.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat ringtone.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Rekam suara tidak didukung browser ini.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingRingtone(false);
        const recording = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (recording.size > MAX_RINGTONE_SIZE) {
          toast.error("Rekaman melebihi batas 1,5 MB. Coba rekam suara yang lebih singkat.");
          return;
        }
        try {
          const dataUrl = await blobToDataUrl(recording);
          updateNotificationPreferences("customAudioName", "Rekaman suara.webm");
          updateNotificationPreferences("customAudioDataUrl", dataUrl);
          toast.success("Rekaman tersimpan di perangkat ini.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Gagal menyimpan rekaman.");
        }
      };
      recorder.start();
      setIsRecordingRingtone(true);
      window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RINGTONE_DURATION_SECONDS * 1000);
    } catch {
      toast.error("Izin mikrofon ditolak atau tidak tersedia.");
    }
  };

  const handleInstallApp = async () => {
    if (isInstalled) {
      toast.info("Aplikasi sudah terpasang di perangkat ini.");
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setIsInstalled(true);
      setInstallPrompt(null);
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(isIos
      ? "Di Safari, ketuk Bagikan lalu pilih Tambahkan ke Layar Utama."
      : "Gunakan menu browser dan pilih Instal aplikasi atau Tambahkan ke layar utama.");
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
        <div className="p-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pengaturan Tema</h2>
          <ThemeSwitcher />
        </div>
      </div>

      {/* 4. PENGATURAN NOTIFIKASI */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
            <Bell className="h-5 w-5" /> Pengaturan Notifikasi
          </h2>

          <div className="flex flex-col gap-6">
            {/* Realtime Notif */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Notifikasi realtime</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tampilkan alert (suara, browser, popup) saat ada notif baru.</p>
              </div>
              <Switch checked={notificationPreferences.realtime} onCheckedChange={(checked) => updateNotificationPreferences("realtime", checked)} />
            </div>

            {/* Sound Notif */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Suara notifikasi</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bunyikan saat notif masuk.</p>
              </div>
              <Switch checked={notificationPreferences.sound} onCheckedChange={(checked) => updateNotificationPreferences("sound", checked)} className="data-[state=checked]:bg-emerald-500" />
            </div>

            {/* Volume */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 rotate-90" /> {/* Speaker icon representation */}
                  <Label htmlFor="notification-volume">Volume</Label>
                </div>
                <span className="text-muted-foreground">{notificationPreferences.volume}%</span>
              </div>
              <input
                id="notification-volume"
                type="range"
                min="0"
                max="100"
                step="5"
                value={notificationPreferences.volume}
                onChange={(event) => updateNotificationPreferences("volume", Number(event.target.value))}
                disabled={!notificationPreferences.sound}
                className="h-2 w-full cursor-pointer accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Pilihan Suara */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="notification-sound">Pilihan suara</Label>
              <div className="flex items-center gap-2">
                <Select value={notificationPreferences.soundPreset} onValueChange={(value) => updateNotificationPreferences("soundPreset", value as NotificationPreferences["soundPreset"])}>
                  <SelectTrigger id="notification-sound" className="h-10 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marimba">Marimba</SelectItem>
                    <SelectItem value="ding-dong">Ding Dong</SelectItem>
                    <SelectItem value="soft-chime">Soft Chime</SelectItem>
                    <SelectItem value="double-pulse">Double Pulse</SelectItem>
                    <SelectItem value="sparkle">Sparkle</SelectItem>
                    <SelectItem value="pop">Modern Pop</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" className="h-10 gap-2 shrink-0" onClick={handlePreviewSound}>
                  <Play className="h-3.5 w-3.5" /> Coba
                </Button>
              </div>
            </div>

            {/* Ringtone Custom */}
            <FileDropArea
              onFiles={(files) => saveRingtoneFile(files[0])}
              accept="audio/*"
              multiple={false}
              label="Lepaskan file audio untuk dijadikan ringtone"
              className="flex flex-col gap-3 pt-2 border-t mt-2"
            >
              <div>
                <p className="font-medium text-sm">Ringtone Custom</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[90%]">
                  Upload file audio atau rekam suara langsung, maks 30 detik. Tersimpan lokal di perangkat ini saja 
                  (tidak diunggah ke server) - perlu di-set ulang kalau ganti device/browser.
                  File audio juga bisa langsung ditarik &amp; dilepas ke bagian ini.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                <div>
                  <p className="font-medium text-sm truncate">{notificationPreferences.customAudioName || "Suara default"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {notificationPreferences.customAudioName ? "Tersimpan di perangkat ini" : "Gunakan suara pilihan di atas"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={handlePreviewSound} aria-label="Coba ringtone">
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10" onClick={() => { updateNotificationPreferences("customAudioName", null); updateNotificationPreferences("customAudioDataUrl", null); }} disabled={!notificationPreferences.customAudioDataUrl} aria-label="Hapus ringtone">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <input ref={ringtoneInputRef} type="file" accept="audio/*" className="hidden" onChange={handleRingtoneUpload} />
                <Button type="button" variant="outline" size="sm" className="gap-2 h-9 text-xs" onClick={() => ringtoneInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Unggah Audio
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-2 h-9 text-xs" onClick={() => mediaRecorderRef.current?.state === "recording" ? mediaRecorderRef.current.stop() : void handleStartRecording()}>
                  <Mic className="h-3.5 w-3.5" /> {isRecordingRingtone ? "Selesai Rekam" : "Rekam Suara"}
                </Button>
              </div>
            </FileDropArea>

            {/* Notifikasi Browser */}
            <div className="flex items-center justify-between pt-2 border-t mt-2">
              <div>
                <p className="font-medium text-sm">Notifikasi browser</p>
                <p className="text-xs text-muted-foreground mt-0.5">Muncul di OS saat tab tidak sedang dibuka/fokus.</p>
              </div>
              <Switch checked={notificationPreferences.browser} onCheckedChange={handleBrowserNotificationToggle} className="data-[state=checked]:bg-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. INSTALL APLIKASI */}
      <button type="button" onClick={handleInstallApp} className="w-full text-left rounded-xl border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-colors disabled:cursor-default">
        <div className="p-5 flex gap-4">
          <Download className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">{isInstalled ? "Aplikasi Terpasang" : "Install Aplikasi"}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isInstalled ? "DesignDesk sudah terpasang di perangkat ini." : "Pasang DesignDesk ke layar utama perangkat ini."}
            </p>
          </div>
        </div>
      </button>

      {/* 6. NOTIFIKASI HP */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Smartphone className="h-5 w-5" /> Notifikasi HP
          </h2>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Aktifkan di perangkat ini</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[90%]">
                Notifikasi OS pada perangkat ini saat DesignDesk terbuka. Push saat aplikasi tertutup memerlukan konfigurasi server.
              </p>
            </div>
            <Switch checked={notificationPreferences.device} onCheckedChange={handleDeviceNotificationToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}
