// app/profile/page.tsx

"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KeyRound, Loader2, Terminal } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Tipe Profile disederhanakan dan disesuaikan
type Profile = {
  name: string | null;
  role: string | null;
  email: string | null;
};

export default function ProfilePage() {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<Profile>({
    name: null,
    role: null,
    email: null,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
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

        // Mengambil 'departemen', bukan 'department'
        const { data: profileRes, error: profileError } = await supabase
          .from("user_profiles")
          .select("name, role")
          .eq("id", user.id)
          .single();

        if (profileError || !profileRes) {
          console.error("Profile not found or error:", profileError);
          return;
        }

        const fetchedProfile = profileRes as Profile;
        setProfile(fetchedProfile);
        setFormData(fetchedProfile);
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
    setUpdateError(null);
    setUpdateSuccess(false);
    const supabase = createClient();

    try {
      // Data yang diupdate disesuaikan
      const { error } = await supabase
        .from("users")
        .update({
          name: formData.name,
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile(formData);
      setEditMode(false);
      setUpdateSuccess(true);
      toast.success("Profil berhasil diperbarui!");
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      setUpdateError("Gagal memperbarui profil: " + error.message);
      toast.error("Gagal memperbarui profil.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    if (profile) setFormData(profile);
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.email) return;
    if (newPassword.length < 8) {
      toast.error("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok.");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("Password baru harus berbeda dari password saat ini.");
      return;
    }

    setIsChangingPassword(true);
    const supabase = createClient();
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) throw new Error("Password saat ini tidak sesuai.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password berhasil diganti.");
    } catch (error) {
      toast.error(
        "Gagal mengganti password: " +
          (error instanceof Error ? error.message : "Terjadi kesalahan.")
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <Content size="md" title="Data Profil">
        <p>Memuat data...</p>
      </Content>
    );
  }

  return (
    <>
      <Content size="md" title="Data Profil">
        {updateSuccess && (
          <Alert className="mb-4 bg-green-100 text-green-800 border-green-300">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Berhasil!</AlertTitle>
            <AlertDescription>Profil Anda telah diperbarui.</AlertDescription>
          </Alert>
        )}
        {updateError && (
          <Alert variant="destructive" className="mb-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Gagal!</AlertTitle>
            <AlertDescription>{updateError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">name</Label>
            {!editMode ? (
              <p className="p-2 mt-1 border border-border rounded-md bg-muted/50 text-sm">
                {profile?.name || "-"}
              </p>
            ) : (
              <Input
                id="name"
                name="name"
                placeholder="name lengkap"
                value={formData.name || ""}
                onChange={handleInputChange}
              />
            )}
          </div>
          <div>
            <Label>Email</Label>
            <p className="p-2 mt-1 border border-border rounded-md bg-muted/50 text-sm">
              {user?.email || "-"}
            </p>
          </div>
          <div>
            <Label>Role</Label>
            <p className="p-2 mt-1 border border-border rounded-md bg-muted/50 text-sm">
              {profile?.role || "-"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {!editMode ? (
            <Button onClick={() => setEditMode(true)}>Edit Profil</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>
                Batal
              </Button>
              <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </>
          )}
        </div>
      </Content>
      {["admin", "user", "designer"].includes(profile?.role || "") && (
        <Content size="md" title="Keamanan Akun">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="current-password">Password saat ini</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                disabled={isChangingPassword}
              />
            </div>
            <div>
              <Label htmlFor="new-password">Password baru</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
                disabled={isChangingPassword}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Konfirmasi password baru</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                disabled={isChangingPassword}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isChangingPassword} className="gap-2">
                {isChangingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Ganti Password
              </Button>
            </div>
          </form>
        </Content>
      )}
      <Content size="xs">
        <div className="flex justify-between items-center">
          <Label className="text-base font-bold">Pengaturan Tema</Label>
          <ThemeSwitcher />
        </div>
      </Content>
    </>
  );
}
