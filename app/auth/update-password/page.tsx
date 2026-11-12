"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthInput } from "@/components/auth/auth-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const mismatch = repeatPassword.length > 0 && password !== repeatPassword;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== repeatPassword) {
      setError("Konfirmasi password tidak cocok. Ketik ulang password yang sama.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password berhasil diubah! Mengarahkan ke dashboard...");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      toast.error("Gagal Menyimpan Password", { description: message });
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Buat Password Baru"
      description="Gunakan password yang kuat dan belum pernah Anda pakai sebelumnya."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password Baru</Label>
          <AuthInput
            icon={LockKeyhole}
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            autoFocus
            placeholder="Minimal 6 karakter"
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="repeat-password">Ulangi Password Baru</Label>
          <AuthInput
            icon={LockKeyhole}
            id="repeat-password"
            name="repeat-password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={loading}
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            aria-invalid={mismatch}
            aria-describedby={mismatch ? "repeat-password-error" : undefined}
            className={cn(mismatch && "border-destructive focus-visible:ring-destructive")}
          />
          {mismatch && (
            <p id="repeat-password-error" className="text-xs text-destructive">
              Konfirmasi password belum cocok.
            </p>
          )}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Gagal Menyimpan Password</AlertTitle>
            <AlertDescription>
              {error}{" "}
              <Link href="/auth/forgot-password" className="font-medium underline underline-offset-4">
                Minta tautan baru
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {loading ? "Menyimpan..." : "Simpan Password Baru"}
        </Button>
      </form>
    </AuthShell>
  );
}
