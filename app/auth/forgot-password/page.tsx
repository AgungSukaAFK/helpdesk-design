"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, MailCheck, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { getSiteRedirectUrl } from "@/lib/site-url";
import { AuthShell, AuthStatusIcon } from "@/components/auth/auth-shell";
import { AuthInput } from "@/components/auth/auth-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const backLinkClass =
  "font-medium text-foreground underline underline-offset-4 hover:text-primary";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    try {
      // URL ini harus terdaftar di Supabase: Authentication > URL Configuration.
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: getSiteRedirectUrl("/auth/update-password"),
      });
      if (error) throw error;
      setSentTo(email);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      toast.error("Gagal Mengirim Email", { description: message });
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell title="Cek Email Anda">
        <div className="space-y-6 text-center">
          <AuthStatusIcon tone="success">
            <MailCheck />
          </AuthStatusIcon>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Jika <strong className="font-medium text-foreground">{sentTo}</strong>{" "}
            terdaftar, kami sudah mengirim tautan untuk membuat password baru.
            Periksa juga folder Spam bila belum masuk dalam beberapa menit.
          </p>
          <Button asChild className="h-11 w-full">
            <Link href="/auth/login">Kembali ke Halaman Login</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Salah email?{" "}
            <button type="button" onClick={() => setSentTo(null)} className={backLinkClass}>
              Kirim ulang
            </button>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Lupa Password"
      description="Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat password baru."
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
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Gagal Mengirim Email</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading ? <Loader2 className="animate-spin" /> : <Send />}
          {loading ? "Mengirim..." : "Kirim Tautan Reset"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/auth/login" className={`inline-flex items-center gap-1.5 ${backLinkClass}`}>
          <ArrowLeft className="size-4" /> Kembali ke login
        </Link>
      </p>
    </AuthShell>
  );
}
