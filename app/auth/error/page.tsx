import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { AuthShell, AuthStatusIcon } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell title="Tautan Tidak Dapat Diproses">
      <div className="space-y-6 text-center">
        <AuthStatusIcon tone="error">
          <TriangleAlert />
        </AuthStatusIcon>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tautan konfirmasi atau reset password mungkin sudah kedaluwarsa atau
          pernah dipakai. Silakan masuk kembali, atau minta tautan baru lewat
          Lupa password.
        </p>
        {error && (
          <p className="wrap-break-word rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
            Kode error: {error}
          </p>
        )}
        <div className="grid gap-3">
          <Button asChild className="h-11 w-full">
            <Link href="/auth/login">Kembali ke Halaman Login</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href="/auth/forgot-password">Minta Tautan Reset Baru</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
