import type { SupabaseClient } from "@supabase/supabase-js";
import { hitungPeriode, type LaporanQcc, type SumberQcc } from "@/lib/qcc/metrics";

const HALAMAN = 1000;
const MAKS_HARI = 366;
const TGL = /^\d{4}-\d{2}-\d{2}$/;

type Rentang = { mulai: string; selesai: string; bandingMulai: string | null; bandingSelesai: string | null };

const tanggalValid = (t: string | null): t is string => !!t && TGL.test(t) && !Number.isNaN(Date.parse(`${t}T00:00:00Z`));
const jarakHari = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400_000;

/** Membaca rentang dari query string. Mengembalikan pesan error jika tidak valid. */
export function bacaRentang(params: URLSearchParams): Rentang | { error: string } {
  const mulai = params.get("mulai");
  const selesai = params.get("selesai");
  const bandingMulai = params.get("bandingMulai") || null;
  const bandingSelesai = params.get("bandingSelesai") || null;

  if (!tanggalValid(mulai) || !tanggalValid(selesai)) return { error: "Tanggal mulai dan selesai wajib diisi" };
  if (mulai > selesai) return { error: "Tanggal mulai tidak boleh setelah tanggal selesai" };
  if (jarakHari(mulai, selesai) > MAKS_HARI) return { error: `Rentang maksimal ${MAKS_HARI} hari` };

  if (bandingMulai || bandingSelesai) {
    if (!tanggalValid(bandingMulai) || !tanggalValid(bandingSelesai)) return { error: "Tanggal pembanding harus lengkap" };
    if (bandingMulai > bandingSelesai) return { error: "Tanggal pembanding terbalik" };
    if (jarakHari(bandingMulai, bandingSelesai) > MAKS_HARI) return { error: `Rentang pembanding maksimal ${MAKS_HARI} hari` };
  }
  return { mulai, selesai, bandingMulai, bandingSelesai };
}

/** PostgREST membatasi 1000 baris per permintaan, jadi ambil per halaman. */
async function semuaBaris<T>(ambil: (dari: number, sampai: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const hasil: T[] = [];
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error } = await ambil(dari, dari + HALAMAN - 1);
    if (error) throw new Error(error.message);
    const baris = (data ?? []) as T[];
    hasil.push(...baris);
    if (baris.length < HALAMAN) return hasil;
  }
}

function daftarBulan(awal: string, akhir: string) {
  const bulan: string[] = [];
  const d = new Date(`${awal.slice(0, 7)}-01T00:00:00Z`);
  while (d.toISOString().slice(0, 7) <= akhir.slice(0, 7)) {
    bulan.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return bulan;
}

async function muatSumber(db: SupabaseClient, awal: string, akhir: string): Promise<SumberQcc> {
  // Dilebarkan sehari karena filter akhirnya memakai tanggal WIB.
  const dari = new Date(Date.parse(`${awal}T00:00:00Z`) - 86400_000).toISOString();
  const sampai = new Date(Date.parse(`${akhir}T00:00:00Z`) + 2 * 86400_000).toISOString();
  const bulan = daftarBulan(awal, akhir);

  const [permintaan, aktivitas, attendance, safety, contentPlan, target, evaluasi] = await Promise.all([
    semuaBaris<SumberQcc["permintaan"][number]>((a, b) => db.from("permintaan")
      .select("id, created_at, progress_at, done_at, due_date, project, departemen, deskripsi, status, rating, revision_count")
      .gte("created_at", dari).lt("created_at", sampai).order("created_at").range(a, b)),
    semuaBaris<SumberQcc["aktivitas"][number]>((a, b) => db.from("daily_activities")
      .select("activity_date, jenis_pekerjaan, jam_mulai, jam_selesai, title, task_description")
      .gte("activity_date", awal).lte("activity_date", akhir).order("activity_date").range(a, b)),
    semuaBaris<SumberQcc["attendance"][number]>((a, b) => db.from("attendance")
      .select("date_text, status").in("period_month", bulan).order("id").range(a, b)),
    semuaBaris<SumberQcc["safety"][number]>((a, b) => db.from("safety_toolbox_meeting_hse_roster")
      .select("period_month, schedule").in("period_month", bulan).order("id").range(a, b)),
    semuaBaris<SumberQcc["contentPlan"][number]>((a, b) => db.from("content_plan")
      .select("due_date, status").gte("due_date", awal).lte("due_date", akhir).order("id").range(a, b)),
    semuaBaris<SumberQcc["target"][number]>((a, b) => db.from("target_project")
      .select("aktivitas, rencana, realisasi, tgl_mulai, deadline").order("id").range(a, b)),
    semuaBaris<SumberQcc["evaluasi"][number]>((a, b) => db.from("evaluasi_designer")
      .select("periode, kreativitas, brief, deadline, kualitas, komunikasi, revisi")
      .gte("periode", awal.slice(0, 7)).lte("periode", akhir.slice(0, 7)).order("id").range(a, b)),
  ]);

  const riwayat: SumberQcc["riwayat"] = [];
  const ids = permintaan.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const potongan = ids.slice(i, i + 200);
    riwayat.push(...await semuaBaris<SumberQcc["riwayat"][number]>((a, b) => db.from("permintaan_riwayat")
      .select("permintaan_id, created_at, status_from, status_to, catatan")
      .in("permintaan_id", potongan).order("created_at").range(a, b)));
  }

  return { permintaan, riwayat, aktivitas, attendance, safety, contentPlan, target, evaluasi };
}

export async function buatLaporan(db: SupabaseClient, r: Rentang): Promise<LaporanQcc> {
  const awal = r.bandingMulai && r.bandingMulai < r.mulai ? r.bandingMulai : r.mulai;
  const akhir = r.bandingSelesai && r.bandingSelesai > r.selesai ? r.bandingSelesai : r.selesai;
  const sumber = await muatSumber(db, awal, akhir);
  return {
    utama: hitungPeriode(sumber, r.mulai, r.selesai),
    banding: r.bandingMulai && r.bandingSelesai ? hitungPeriode(sumber, r.bandingMulai, r.bandingSelesai) : null,
  };
}
