// Terjemahan pesan error Supabase Auth ke bahasa Indonesia: jelaskan apa
// yang salah DAN apa yang harus dilakukan user (taste-ui.md prinsip 1).

const RULES: { match: RegExp; message: string }[] = [
  {
    match: /invalid login credentials/i,
    message: "Email atau password salah. Periksa kembali lalu coba lagi.",
  },
  {
    match: /email not confirmed/i,
    message: "Email belum dikonfirmasi. Buka tautan konfirmasi yang dikirim ke email Anda.",
  },
  {
    match: /user already registered|already been registered/i,
    message: "Email ini sudah terdaftar. Silakan masuk, atau gunakan Lupa password.",
  },
  {
    match: /password should be at least (\d+)/i,
    message: "Password terlalu pendek. Gunakan minimal 6 karakter.",
  },
  {
    match: /new password should be different/i,
    message: "Password baru harus berbeda dari password lama.",
  },
  {
    match: /auth session missing|session.*expired|invalid.*(token|otp)|otp.*expired/i,
    message: "Tautan sudah kedaluwarsa atau tidak valid. Minta tautan reset password yang baru.",
  },
  {
    match: /rate limit|too many requests|for security purposes/i,
    message: "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.",
  },
  {
    match: /email logins are disabled|email_provider_disabled/i,
    message:
      "Login email belum diaktifkan untuk project Supabase ini. Admin perlu mengaktifkan Authentication > Sign In / Providers > Email.",
  },
  {
    match: /failed to fetch|network/i,
    message: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.",
  },
];

export function getAuthErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const rule = RULES.find((r) => r.match.test(raw));
  if (rule) return rule.message;
  return raw || "Terjadi kesalahan. Silakan coba lagi.";
}
