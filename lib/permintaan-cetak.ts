// Proyek Cetak: tahapan setelah desain disetujui sampai barang diserahterimakan.
//
//   REVIEW ──setujui_cetak (Review Design)──▶ CETAK
//   CETAK: Proses MR → Proses PO → Proses Cetak → Diterima Tim Design   (PIC / admin)
//   CETAK ──bast (peminta / admin)──▶ DONE
//
// Data tiap tahap disimpan di kolom jsonb `permintaan.cetak`.

export const PROJECT_CETAK = "Cetak";

export function isProyekCetak(project?: string | null) {
  return (project || "").trim().toLowerCase() === PROJECT_CETAK.toLowerCase();
}

export type TahapCetak =
  | "review_design"
  | "proses_mr"
  | "proses_po"
  | "proses_cetak"
  | "diterima_tim"
  | "bast";

export interface FileCetak {
  name: string;
  url: string;
}

export interface CatatanTahap {
  at: string;
  by: string;
  by_name: string;
  referensi?: string | null;
  catatan?: string | null;
  files?: FileCetak[];
  checklist?: string[];
}

export interface SpesifikasiCetak {
  jumlah?: string;
  ukuran?: string;
  bahan?: string;
  finishing?: string;
}

export interface DataCetak {
  spesifikasi?: SpesifikasiCetak;
  tahap?: Partial<Record<TahapCetak, CatatanTahap>>;
}

export interface MetaTahap {
  key: TahapCetak;
  label: string;
  /** Siapa yang menandai tahap ini selesai. */
  pelaku: "peminta" | "pic";
  deskripsi: string;
  /** Label isian referensi (nomor MR/PO/BAST, vendor, dll). */
  referensiLabel?: string;
  referensiWajib?: boolean;
  tombol: string;
}

export const TAHAP_CETAK: MetaTahap[] = [
  {
    key: "review_design",
    label: "Review Design",
    pelaku: "peminta",
    deskripsi: "Peminta mengecek ulang desain final agar tidak salah cetak.",
    tombol: "Setujui untuk Dicetak",
  },
  {
    key: "proses_mr",
    label: "Proses MR",
    pelaku: "pic",
    deskripsi: "Material Request diajukan.",
    referensiLabel: "Nomor MR",
    referensiWajib: true,
    tombol: "Tandai MR Diajukan",
  },
  {
    key: "proses_po",
    label: "Proses PO",
    pelaku: "pic",
    deskripsi: "Purchase Order ke vendor percetakan diterbitkan.",
    referensiLabel: "Nomor PO",
    referensiWajib: true,
    tombol: "Tandai PO Terbit",
  },
  {
    key: "proses_cetak",
    label: "Proses Cetak",
    pelaku: "pic",
    deskripsi: "File dikirim ke vendor dan sedang dicetak.",
    referensiLabel: "Vendor / percetakan",
    tombol: "Tandai Mulai Dicetak",
  },
  {
    key: "diterima_tim",
    label: "Diterima Tim Design",
    pelaku: "pic",
    deskripsi: "Hasil cetak diterima & dicek tim Design.",
    referensiLabel: "Jumlah diterima",
    tombol: "Konfirmasi Barang Diterima",
  },
  {
    key: "bast",
    label: "BAST",
    pelaku: "peminta",
    deskripsi: "Berita Acara Serah Terima ke peminta. Tiket selesai.",
    referensiLabel: "Nomor BAST",
    tombol: "Konfirmasi Serah Terima (BAST)",
  },
];

export const META_TAHAP = Object.fromEntries(TAHAP_CETAK.map((t) => [t.key, t])) as Record<
  TahapCetak,
  MetaTahap
>;

/** Poin yang wajib dicentang peminta saat Review Design. */
export const CHECKLIST_REVIEW_DESIGN = [
  "Teks, ejaan, angka & nomor kontak sudah benar",
  "Logo, warna & gambar sudah sesuai",
  "Ukuran & orientasi sesuai kebutuhan cetak",
  "Jumlah, bahan & finishing sudah sesuai",
];

export function normalizeCetak(raw: unknown): DataCetak {
  if (!raw || typeof raw !== "object") return { tahap: {} };
  const c = raw as DataCetak;
  return { spesifikasi: c.spesifikasi ?? {}, tahap: c.tahap ?? {} };
}

/** Tahap berikutnya yang belum selesai, atau null jika semua sudah. */
export function tahapBerikutnya(cetak: unknown): MetaTahap | null {
  const { tahap } = normalizeCetak(cetak);
  return TAHAP_CETAK.find((t) => !tahap?.[t.key]) ?? null;
}

export function jumlahTahapSelesai(cetak: unknown) {
  const { tahap } = normalizeCetak(cetak);
  return TAHAP_CETAK.filter((t) => tahap?.[t.key]).length;
}

/** Revisi masih masuk akal selama file belum dikirim ke percetakan. */
export function bisaRevisiSaatCetak(cetak: unknown) {
  return !normalizeCetak(cetak).tahap?.proses_cetak;
}

export function ringkasSpesifikasi(s?: SpesifikasiCetak | null) {
  if (!s) return "";
  return [
    s.jumlah && `Jumlah: ${s.jumlah}`,
    s.ukuran && `Ukuran: ${s.ukuran}`,
    s.bahan && `Bahan: ${s.bahan}`,
    s.finishing && `Finishing: ${s.finishing}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
