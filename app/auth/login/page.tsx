"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LockKeyhole, LogIn, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSafeNextPath } from "@/lib/safe-next-path";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthInput } from "@/components/auth/auth-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Kembali ke halaman yang tadi dicegat login (dibawa middleware lewat
      // ?next=). Tanpa itu baru ke dashboard.
      const next = getSafeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      toast.success(
        next
          ? "Login berhasil! Melanjutkan ke halaman tujuan..."
          : "Login berhasil! Mengarahkan ke dashboard...",
      );
      router.replace(next ?? "/dashboard");
      router.refresh();
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      toast.error("Login Gagal", { description: message });
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Selamat datang kembali"
      description="Masuk dengan email Anda untuk melanjutkan."
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
            autoComplete="username"
            autoFocus
            placeholder="nama@perusahaan.com"
            disabled={loading}
          />
        </div>
        {/* "Lupa password?" ditaruh SETELAH input di DOM supaya Tab dari
            email langsung ke password; posisinya tetap di baris label lewat grid. */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="col-span-2">
            <AuthInput
              icon={LockKeyhole}
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>
          <Link
            href="/auth/forgot-password"
            className="col-start-2 row-start-1 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Lupa password?
          </Link>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Login Gagal</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
          {loading ? "Memproses..." : "Masuk"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link
          href="/auth/sign-up"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Daftar di sini
        </Link>
      </p>
    </AuthShell>
  );
}
