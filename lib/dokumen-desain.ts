// Dokumen Form Desain: tipe data, label status, dan aturan hak akses.
// Dipakai bersama oleh API (/api/dokumen-desain) dan halaman, supaya tombol
// yang tampil di UI selalu sama dengan yang diizinkan server.

export type DokumenStatus = "MENUNGGU" | "DISETUJUI" | "DITOLAK";
export type PeranTtd = "designer" | "acknowledge" | "approval";
export type RoleApp = "admin" | "designer" | "user";

/** Batas gambar hasil per lembar agar tetap terbaca saat dicetak A4. */
export const MAKS_HASIL = 6;

export const NO_DOKUMEN_CONTOH = "GMI.CR.F.001-002";
export const NO_DOKUMEN_SUB_CONTOH = "SRG.001/001/2026/HSE";

export const DOKUMEN_STATUS_META: Record<
  DokumenStatus,
  { label: string; badgeClass: string }
> = {
  MENUNGGU: {
    label: "Menunggu TTD",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  DISETUJUI: {
    label: "Disetujui",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  DITOLAK: {
    label: "Ditolak",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
};

export const PERAN_LABEL: Record<PeranTtd, string> = {
  designer: "Designer",
  acknowledge: "Acknowledge",
  approval: "Approval",
};

export function normalizeDokumenStatus(s?: string | null): DokumenStatus {
  return s === "DISETUJUI" || s === "DITOLAK" ? s : "MENUNGGU";
}

export function resolveRole(role?: string | null): RoleApp {
  return role === "admin" || role === "designer" ? role : "user";
}

export interface FileHasil {
  name: string;
  url: string;
}

const EKSTENSI_GAMBAR = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i;

/** Hasil desain di lembar dokumen harus gambar supaya bisa ditampilkan & dicetak. */
export function isFileGambar(f: { name?: string; url?: string }) {
  return EKSTENSI_GAMBAR.test(f.name || "") || EKSTENSI_GAMBAR.test((f.url || "").split("?")[0]);
}

/** Status dokumen diturunkan dari semua tanda tangan. */
export function hitungStatusDokumen(ttd: { status: string }[]): DokumenStatus {
  if (ttd.some((t) => t.status === "DITOLAK")) return "DITOLAK";
  if (ttd.length > 0 && ttd.every((t) => t.status === "DISETUJUI")) return "DISETUJUI";
  return "MENUNGGU";
}

interface DokumenAkses {
  status: string;
  created_by: string;
}

interface Aktor {
  id: string;
  role: RoleApp;
}

/** Pembuat dokumen: admin, atau designer yang menjadi PIC permintaan tersebut. */
export function bolehBuatDokumen(permintaan: { admin?: string | null }, a: Aktor) {
  return a.role === "admin" || (a.role === "designer" && !!permintaan.admin && permintaan.admin === a.id);
}

/** Edit/revisi isi dokumen. Dokumen yang sudah disetujui penuh terkunci. */
export function bolehEditDokumen(d: DokumenAkses, a: Aktor) {
  if (normalizeDokumenStatus(d.status) === "DISETUJUI") return false;
  return a.role === "admin" || d.created_by === a.id;
}

export function bolehHapusDokumen(d: DokumenAkses, a: Aktor) {
  if (a.role === "admin") return true;
  return d.created_by === a.id && normalizeDokumenStatus(d.status) !== "DISETUJUI";
}

/** Penanda tangan bisa menyetujui/menolak selama dokumen belum ditolak/disetujui. */
export function bolehTandaTangan(
  d: { status: string },
  ttd: { user_id: string; status: string }[],
  userId: string,
) {
  return (
    normalizeDokumenStatus(d.status) === "MENUNGGU" &&
    ttd.some((t) => t.user_id === userId && t.status === "MENUNGGU")
  );
}

// ===== Input penanda tangan saat membuat / merevisi dokumen =====

export interface InputPenandaTangan {
  user_id: string;
  peran: PeranTtd;
  jabatan?: string | null;
}

/** Mengembalikan pesan kesalahan, atau null jika valid. */
export function validasiPenandaTangan(list: InputPenandaTangan[]): string | null {
  const designer = list.filter((p) => p.peran === "designer");
  if (designer.length !== 1) return "Pilih satu designer.";
  if (!list.some((p) => p.peran === "approval")) return "Minimal satu approver (User) wajib dipilih.";
  const seen = new Set<string>();
  for (const p of list) {
    if (!p.user_id) return `Ada ${PERAN_LABEL[p.peran] ?? "penanda tangan"} yang belum dipilih.`;
    if (!["designer", "acknowledge", "approval"].includes(p.peran)) return "Peran penanda tangan tidak valid.";
    const key = `${p.peran}:${p.user_id}`;
    if (seen.has(key)) return `Orang yang sama dipilih dua kali sebagai ${PERAN_LABEL[p.peran]}.`;
    seen.add(key);
  }
  return null;
}

// ===== Gambar tanda tangan =====

export const TTD_MAX_BYTES = 1024 * 1024;
