// Alur kerja permintaan desain: satu sumber kebenaran untuk label status,
// siapa yang bertindak berikutnya, aksi yang boleh dilakukan, dan hak edit.
//
//   TO DO ──ambil──▶ PROGRESS ──kirim_review──▶ REVIEW ──selesai──▶ DONE
//                       ▲                         │
//                       └──── REVISION ◀──revisi──┘   (revisi juga bisa dari PROGRESS / DONE)
//
//   PROGRESS / REVISION ──pending──▶ PENDING ──lanjutkan──▶ kembali ke status sebelumnya

export type PermintaanStatus = "TO DO" | "PROGRESS" | "REVIEW" | "REVISION" | "PENDING" | "DONE";
export type Role = "admin" | "designer" | "user";

export const STATUS_META: Record<
  PermintaanStatus,
  { label: string; short: string; badgeClass: string; dotClass: string }
> = {
  "TO DO": {
    label: "Menunggu Desainer",
    short: "To Do",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20",
    dotClass: "bg-amber-500",
  },
  PROGRESS: {
    label: "Sedang Dikerjakan",
    short: "Progress",
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20",
    dotClass: "bg-blue-500",
  },
  REVIEW: {
    label: "Menunggu Review",
    short: "Review",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20",
    dotClass: "bg-purple-500",
  },
  REVISION: {
    label: "Sedang Direvisi",
    short: "Revisi",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20",
    dotClass: "bg-rose-500",
  },
  PENDING: {
    label: "Ditunda",
    short: "Pending",
    badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 hover:bg-slate-500/20",
    dotClass: "bg-slate-500",
  },
  DONE: {
    label: "Selesai",
    short: "Done",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
};

export const STATUS_LIST = Object.keys(STATUS_META) as PermintaanStatus[];

export function normalizeStatus(status?: string | null): PermintaanStatus {
  const s = (status || "").toUpperCase();
  return (STATUS_LIST as string[]).includes(s) ? (s as PermintaanStatus) : "TO DO";
}

/** Pihak yang ditunggu pada status ini. */
export function waitingOn(status: string): "desainer" | "requester" | null {
  switch (normalizeStatus(status)) {
    case "TO DO":
    case "PROGRESS":
    case "REVISION":
    case "PENDING":
      return "desainer";
    case "REVIEW":
      return "requester";
    default:
      return null;
  }
}

export type WorkflowAction =
  | "ambil"
  | "kirim_review"
  | "pending"
  | "lanjutkan"
  | "revisi"
  | "selesai"
  | "ubah_status";

interface Ticket {
  status: string;
  requester?: string | null;
  admin?: string | null;
}

interface Actor {
  id: string;
  role: Role;
}

export const isRequester = (t: Ticket, a: Actor) => !!a.id && t.requester === a.id;
export const isPic = (t: Ticket, a: Actor) => !!a.id && t.admin === a.id;

/** Aksi alur kerja yang boleh dilakukan aktor pada tiket ini. */
export function allowedActions(t: Ticket, a: Actor): WorkflowAction[] {
  const status = normalizeStatus(t.status);
  const actions: WorkflowAction[] = [];
  const worker = a.role === "admin" || (a.role === "designer" && (isPic(t, a) || !t.admin));

  if (worker && status === "TO DO" && !t.admin) actions.push("ambil");
  if ((a.role === "admin" || (a.role === "designer" && isPic(t, a))) && t.admin) {
    if (status === "PROGRESS" || status === "REVISION") actions.push("kirim_review", "pending");
    if (status === "PENDING") actions.push("lanjutkan");
  }
  if (isRequester(t, a) || a.role === "admin") {
    if (status === "PROGRESS" || status === "REVIEW" || status === "DONE") actions.push("revisi");
    if (status === "REVIEW" || ((status === "PROGRESS" || status === "REVISION") && t.admin)) {
      actions.push("selesai");
    }
  }
  if (a.role === "admin") actions.push("ubah_status");
  return actions;
}

/**
 * Hak edit isi permintaan (judul, deskripsi, project, departemen, deadline).
 * - admin: semua tiket
 * - designer: hanya tiket yang ditugaskan kepadanya
 * - requester: hanya tiket miliknya sendiri, selama belum DONE
 * Status & PIC hanya bisa diubah admin (lewat form edit) atau lewat aksi alur kerja.
 */
export function canEditPermintaan(t: Ticket, a: Actor): boolean {
  if (a.role === "admin") return true;
  if (a.role === "designer" && isPic(t, a)) return true;
  return isRequester(t, a) && normalizeStatus(t.status) !== "DONE";
}

/** Entri REVISION yang benar-benar pengajuan revisi (bukan melanjutkan revisi yang ditunda). */
export const isPengajuanRevisi = (r: { status_from: string | null; status_to: string }) =>
  r.status_to === "REVISION" && r.status_from !== "PENDING";

// ===== Waktu aktual pengerjaan =====
// Dihitung dari riwayat status: hanya waktu saat desainer sedang mengerjakan
// (PROGRESS / REVISION). Waktu ditunda (PENDING), menunggu peminta (REVIEW),
// dan antre sebelum diambil (TO DO) tidak ikut dihitung.

export const STATUS_DIHITUNG: PermintaanStatus[] = ["PROGRESS", "REVISION"];

export interface RiwayatStatus {
  created_at: string;
  status_from: string | null;
  status_to: string;
}

export interface WaktuPengerjaan {
  /** Waktu aktual pengerjaan desainer (ms). */
  aktifMs: number;
  pendingMs: number;
  /** Menunggu peminta mengecek hasil (REVIEW). */
  reviewMs: number;
  /** Antre sebelum diambil desainer (TO DO). */
  antreMs: number;
  /** Status terakhir PROGRESS / REVISION, jadi timer terus bertambah. */
  berjalan: boolean;
  /** Waktu mulai status saat ini. */
  sejak: string | null;
  /** false jika riwayat lama tidak lengkap sehingga angka hanya perkiraan. */
  lengkap: boolean;
}

export function hitungWaktuPengerjaan(riwayat: RiwayatStatus[], now = Date.now()): WaktuPengerjaan {
  const hasil: WaktuPengerjaan = {
    aktifMs: 0,
    pendingMs: 0,
    reviewMs: 0,
    antreMs: 0,
    berjalan: false,
    sejak: null,
    lengkap: riwayat.length > 0,
  };

  riwayat.forEach((r, i) => {
    const next = riwayat[i + 1];
    const status = normalizeStatus(r.status_to);
    const start = Date.parse(r.created_at);
    const end = next ? Date.parse(next.created_at) : status === "DONE" ? start : now;
    const ms = Math.max(0, end - start);

    if (STATUS_DIHITUNG.includes(status)) hasil.aktifMs += ms;
    else if (status === "PENDING") hasil.pendingMs += ms;
    else if (status === "REVIEW") hasil.reviewMs += ms;
    else if (status === "TO DO") hasil.antreMs += ms;

    // Entri hasil backfill (tanpa status asal) atau status asal yang tidak cocok
    // berarti ada perpindahan status yang tidak tercatat.
    const prev = riwayat[i - 1];
    if (prev && (!r.status_from || normalizeStatus(r.status_from) !== normalizeStatus(prev.status_to))) {
      hasil.lengkap = false;
    }
    if (!next) {
      hasil.berjalan = STATUS_DIHITUNG.includes(status);
      hasil.sejak = r.created_at;
    }
  });

  return hasil;
}
