// BAST (Berita Acara Serah Terima): tipe data, format nomor & tanggal,
// pengolah daftar barang (termasuk tempel dari Excel), dan aturan hak akses.
// Dipakai bersama oleh API (/api/bast) dan halaman supaya tombol di UI
// selalu sama dengan yang diizinkan server.

export type BastStatus = "MENUNGGU" | "DITERIMA";
export type ModeBarang = "daftar" | "tabel";
export type MetodeTerima = "langsung" | "akun" | "scan";
type RoleApp = "admin" | "designer" | "user";

export const BAST_STATUS_META: Record<BastStatus, { label: string; badgeClass: string }> = {
  MENUNGGU: {
    label: "Menunggu Serah Terima",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  DITERIMA: {
    label: "Diterima",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
};

export const METODE_LABEL: Record<MetodeTerima, string> = {
  langsung: "TTD langsung di perangkat penyerah",
  akun: "TTD penerima lewat akunnya",
  scan: "Scan surat bertanda tangan basah",
};

export const normalizeBastStatus = (s?: string | null): BastStatus => (s === "DITERIMA" ? "DITERIMA" : "MENUNGGU");

export const DIVISI_DEFAULT = "Design & Multimedia";
export const KOTA_DEFAULT = "Bekasi";
export const PENUTUP_BAST =
  "Demikian berita acara serah terima ini dibuat untuk dapat diketahui oleh pihak-pihak yang bersangkutan dan sebagai arsip perusahaan.";

// ===== Batas isi =====
export const MAKS_BARIS = 500;
export const MAKS_KOLOM_BARANG = 8;
export const MAKS_BUKTI = 4;
export const MAKS_SCAN_BYTES = 6 * 1024 * 1024; // + 4 foto bukti tetap di bawah batas body 10 MB
export const MAKS_BUKTI_BYTES = 2 * 1024 * 1024;

/** Nomor sesuai format surat yang sudah dipakai, mis. "GMI.CR.F.001.002 /IT-DESIGN/BAST-ID CARD/2026". */
export function formatNomorBast(kode: string, tahun: number | string) {
  return `GMI.CR.F.001.002 /IT-DESIGN/BAST-${kode.trim().toUpperCase()}/${tahun}`;
}

/** Ganti placeholder {tahun} pada teks bawaan jenis. */
export function isiTemplate(teks: string | null | undefined, tahun: number | string) {
  return (teks || "").replace(/\{tahun\}/gi, String(tahun));
}

const dariYmd = (ymd?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

export const tahunDari = (ymd?: string | null) => dariYmd(ymd)?.getFullYear() ?? new Date().getFullYear();

/** "Kamis 22 Januari 2026" */
export function hariTanggal(ymd?: string | null) {
  const d = dariYmd(ymd);
  if (!d) return "";
  const hari = d.toLocaleDateString("id-ID", { weekday: "long" });
  return `${hari} ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
}

/** "22 Jan 2026" */
export function tanggalSingkat(ymd?: string | null) {
  const d = dariYmd(ymd);
  return d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";
}

// ===== Daftar barang =====

/**
 * Teks tempelan dari Excel/Google Sheets (TSV) menjadi baris x kolom.
 * Sel yang mengandung enter/tab dikutip ("...") oleh Excel, jadi ditangani juga.
 */
export function parseTempel(teks: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let sel = "";
  let kutip = false;
  const s = teks.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (kutip) {
      if (c === '"' && s[i + 1] === '"') {
        sel += '"';
        i++;
      } else if (c === '"') kutip = false;
      else sel += c;
    } else if (c === '"' && sel === "") kutip = true;
    else if (c === "\t") {
      row.push(sel);
      sel = "";
    } else if (c === "\n") {
      row.push(sel);
      rows.push(row);
      row = [];
      sel = "";
    } else sel += c;
  }
  if (sel !== "" || row.length) {
    row.push(sel);
    rows.push(row);
  }
  return rows.map((r) => r.map((v) => v.trim())).filter((r) => r.some((v) => v !== ""));
}

/** Satu baris satu item; penomoran di depan ("1.", "2)", "3 -") dibuang. */
export function parseDaftar(teks: string): string[] {
  return teks
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d{1,4}\s*[.)\-:]\s*/, "").replace(/\t+/g, " ").trim())
    .filter(Boolean);
}

/** Rapikan isi barang untuk disimpan; null + pesan bila tidak valid. */
export function normalisasiBarang(
  mode: unknown,
  kolom: unknown,
  items: unknown,
): { mode: ModeBarang; kolom: string[]; items: string[][] } | { error: string } {
  const m: ModeBarang = mode === "tabel" ? "tabel" : "daftar";
  const teks = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).trim().slice(0, max));
  const baris = (Array.isArray(items) ? items : []).map((r) => (Array.isArray(r) ? r : [r]).map((v) => teks(v, 300)));

  if (m === "daftar") {
    const list = baris.map((r) => r.filter(Boolean).join(" - ")).filter(Boolean);
    if (list.length === 0) return { error: "Daftar barang masih kosong." };
    if (list.length > MAKS_BARIS) return { error: `Maksimal ${MAKS_BARIS} baris barang.` };
    return { mode: m, kolom: [], items: list.map((v) => [v]) };
  }

  const head = (Array.isArray(kolom) ? kolom : []).map((v) => teks(v, 60));
  if (head.length === 0) return { error: "Tabel barang minimal punya satu kolom." };
  if (head.length > MAKS_KOLOM_BARANG) return { error: `Maksimal ${MAKS_KOLOM_BARANG} kolom.` };
  if (head.some((h) => !h)) return { error: "Semua judul kolom tabel wajib diisi." };
  const isi = baris
    .map((r) => head.map((_, i) => r[i] ?? ""))
    .filter((r) => r.some(Boolean));
  if (isi.length === 0) return { error: "Tabel barang masih kosong." };
  if (isi.length > MAKS_BARIS) return { error: `Maksimal ${MAKS_BARIS} baris barang.` };
  return { mode: m, kolom: head, items: isi };
}

// ===== Hak akses =====

interface BastAkses {
  status: string;
  created_by: string;
  penyerah_id: string;
  penerima_user_id?: string | null;
  penyerah_signed_at?: string | null;
}

interface Aktor {
  id: string;
  role: RoleApp;
}

const isStaff = (a: Aktor) => a.role === "admin" || a.role === "designer";
const menunggu = (d: BastAkses) => normalizeBastStatus(d.status) === "MENUNGGU";
const pengelola = (d: BastAkses, a: Aktor) => a.role === "admin" || d.created_by === a.id || d.penyerah_id === a.id;

export const bolehBuatBast = (a: Aktor) => isStaff(a);

/** Isi BAST bisa diubah selama belum diterima; TTD penyerah ikut direset. */
export const bolehEditBast = (d: BastAkses, a: Aktor) => menunggu(d) && pengelola(d, a);

export const bolehHapusBast = (d: BastAkses, a: Aktor) =>
  a.role === "admin" || (d.created_by === a.id && menunggu(d));

export const bolehTtdPenyerah = (d: BastAkses, a: Aktor) =>
  menunggu(d) && d.penyerah_id === a.id && !d.penyerah_signed_at;

/** Catat serah terima di perangkat penyerah: penerima TTD langsung (setelah penyerah TTD). */
export const bolehTerimaLangsung = (d: BastAkses, a: Aktor) =>
  menunggu(d) && !!d.penyerah_signed_at && pengelola(d, a);

/** Unggah scan surat bertanda tangan basah; TTD digital penyerah tidak diperlukan. */
export const bolehTerimaScan = (d: BastAkses, a: Aktor) => menunggu(d) && pengelola(d, a);

/** Penerima yang punya akun menandatangani sendiri. */
export const bolehTerimaAkun = (d: BastAkses, a: Aktor) =>
  menunggu(d) && !!d.penyerah_signed_at && !!d.penerima_user_id && d.penerima_user_id === a.id;

/** Admin bisa membuka kembali BAST yang sudah diterima bila ada kekeliruan. */
export const bolehBukaKembali = (d: BastAkses, a: Aktor) => !menunggu(d) && a.role === "admin";
