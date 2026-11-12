"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { getSiteRedirectUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthInput } from "@/components/auth/auth-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
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
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    try {
      const { data, error } = await createClient().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: getSiteRedirectUrl("/dashboard") },
      });
      if (error) throw error;

      // Auto confirm aktif: signUp langsung mengembalikan session.
      if (data.session) {
        toast.success("Akun berhasil dibuat! Mengarahkan ke dashboard...");
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      router.replace("/auth/sign-up-success");
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      toast.error("Pendaftaran Gagal", { description: message });
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Daftar Akun Baru"
      description="Buat akun untuk mengajukan dan memantau permintaan desain."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <AuthInput
            icon={Mail}
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="nama@perusahaan.com"
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <AuthInput
            icon={LockKeyhole}
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Minimal 6 karakter"
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="repeat-password">Ulangi Password</Label>
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
            <AlertTitle>Pendaftaran Gagal</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {loading ? "Memproses..." : "Daftar"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Masuk di sini
        </Link>
      </p>
    </AuthShell>
  );
}
