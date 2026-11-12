import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell, AuthStatusIcon } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function SignUpSuccessPage() {
  return (
    <AuthShell title="Pendaftaran Berhasil">
      <div className="space-y-6 text-center">
        <AuthStatusIcon tone="success">
          <MailCheck />
        </AuthStatusIcon>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Akun Anda telah dibuat. Buka email Anda dan klik tautan konfirmasi
          yang kami kirim, lalu masuk untuk mulai menggunakan DesignDesk.
        </p>
        <Button asChild className="h-11 w-full">
          <Link href="/auth/login">Kembali ke Halaman Login</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
