// Timeline Creative Tim — model data, pilihan (diambil dari validasi di
// "Timeline Creative Tim.xlsx"), aturan tanggal, dan warna status.

export interface TimelineDesain {
  id: string;
  no: number | null;
  design: string;
  /** status progres: Schedule / In Progress / Designed / Published — menentukan warna bar */
  status: string;
  /** tanggal mulai desain (YYYY-MM-DD) */
  date: string | null;
  due_date: string | null;
  /** status approval: Review / Revisi / Approve / Done */
  approval_status: string | null;
  type_of_project: string | null;
  layout_ukuran: string | null;
  visual_type: string | null;
  visual_link: string | null;
  asset_link: string | null;
  post_topic_id: string | null;
  created_at?: string;
}

export interface TimelinePostTopic {
  id: string;
  no: number | null;
  design: string;
  /** hari H tayang (YYYY-MM-DD) */
  post_date: string;
  post_time: string | null;
  post_topic: string | null;
  project_name: string;
  visual_type: string | null;
  visual_link: string | null;
  asset_link: string | null;
  publish_channels: string | null;
  created_at?: string;
}

export const DESIGN_OPTIONS = [
  "Brosur", "Flyer", "Poster", "ID Card", "Stiker", "Katalog", "Kalender", "Ucapan", "Banner", "Iklan",
  "Lowongan Kerja", "Video Event", "Photo Product", "Photo Event", "Editing Photo", "Video Compro",
  "Sosial Media", "Training", "Video Ucapan",
];
export const STATUS_OPTIONS = ["Schedule", "In Progress", "Designed", "Published"];
export const APPROVAL_OPTIONS = ["Review", "Revisi", "Approve", "Done"];
export const LAYOUT_OPTIONS = ["WA", "IG", "Linkedin", "A4", "A5", "Video", "ID Card", "E-Commerce"];
export const VISUAL_TYPE_OPTIONS = ["JPEG", "PNG", "PDF", "CDR", "AI", "PSD", "TIFF", "Mp4"];
export const POST_TOPIC_OPTIONS = ["Event", "Hari Raya", "Promotion", "Product Promotion", "Educational", "OJT Program"];
export const CHANNEL_OPTIONS = ["WA", "IG", "Linkedin"];
export const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Catatan di Excel: Due Date = 1 minggu sebelum hari H, Date = 1 minggu sebelum Due Date. */
export const DUE_SEBELUM_H = 7;
export const MULAI_SEBELUM_DUE = 7;

// ------------------------------------------------------------------ tanggal --
const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" → Date lokal tengah malam. */
export function parseTgl(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export const fmtTgl = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function tambahHari(s: string, n: number): string {
  const d = parseTgl(s)!;
  d.setDate(d.getDate() + n);
  return fmtTgl(d);
}

/** Selisih hari b - a (abaikan DST). */
export function selisihHari(a: string, b: string): number {
  const da = parseTgl(a)!;
  const db = parseTgl(b)!;
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
}

export const hariIni = () => fmtTgl(new Date());

export const namaHari = (s: string | null | undefined) => {
  const d = parseTgl(s);
  return d ? HARI[d.getDay()] : "";
};

export function tglPendek(s: string | null | undefined) {
  const d = parseTgl(s);
  if (!d) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/** Jadwal desain otomatis dari hari H. */
export function jadwalDariHariH(postDate: string) {
  const due = tambahHari(postDate, -DUE_SEBELUM_H);
  return { due_date: due, date: tambahHari(due, -MULAI_SEBELUM_DUE) };
}

/** Rentang bar: Date → Due Date (salah satu kosong = bar 1 hari). */
export function rentangBar(r: Pick<TimelineDesain, "date" | "due_date">): { mulai: string; akhir: string } | null {
  const a = r.date || r.due_date;
  const b = r.due_date || r.date;
  if (!a || !b) return null;
  return a <= b ? { mulai: a, akhir: b } : { mulai: b, akhir: a };
}

export const sudahSelesai = (status: string) => status === "Designed" || status === "Published";

export const terlambat = (r: TimelineDesain, today = hariIni()) =>
  !!r.due_date && r.due_date < today && !sudahSelesai(r.status);

// -------------------------------------------------------------------- warna --
export const STATUS_STYLE: Record<string, { bar: string; dot: string; badge: string; argb: string }> = {
  Schedule: {
    bar: "bg-slate-400 dark:bg-slate-500",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    argb: "FF94A3B8",
  },
  "In Progress": {
    bar: "bg-blue-500",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    argb: "FF3B82F6",
  },
  Designed: {
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    argb: "FFF59E0B",
  },
  Published: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    argb: "FF10B981",
  },
};
export const statusStyle = (s: string) => STATUS_STYLE[s] ?? STATUS_STYLE.Schedule;

export const APPROVAL_BADGE: Record<string, string> = {
  Review: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900",
  Revisi: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
  Approve: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  Done: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
};

/** Cocokkan teks bebas (hasil import) ke salah satu pilihan; kalau tidak ada, kembalikan apa adanya. */
export function cocokkanPilihan(v: string, opsi: string[]): string {
  const s = v.trim();
  return opsi.find((o) => o.toLowerCase() === s.toLowerCase()) ?? s;
}
