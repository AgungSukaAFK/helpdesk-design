// Analisis QCC tim Creative untuk satu rentang tanggal. Fungsi di sini murni: tidak
// mengakses database, jadi sama hasilnya untuk pratinjau halaman dan file PPT.
import { STATUS_DIHITUNG, type PermintaanStatus } from "@/lib/permintaan-workflow";

export const BATAS_MENIT = 60;
/** Di bawah jumlah tiket ini, persentase dan Pareto menyesatkan. */
export const MIN_TIKET = 10;
export const MIN_TITIK_KENDALI = 20;
/** Persen tiket lambat minimal agar sebuah sebab disebut indikasi terkuat. */
const AMBANG_TERKUAT = 25;

const JAM_MULAI = 8;
const JAM_SELESAI = 17;
const WIB_MS = 7 * 3600_000;

export type RowPermintaan = {
  id: string;
  created_at: string;
  progress_at: string | null;
  done_at: string | null;
  due_date: string | null;
  project: string | null;
  departemen: string | null;
  deskripsi: string | null;
  status: string;
  rating: number | null;
  revision_count: number | null;
};
export type RowRiwayat = { permintaan_id: string; created_at: string; status_from: string | null; status_to: string; catatan: string | null };
export type RowAktivitas = { activity_date: string; jenis_pekerjaan: string | null; jam_mulai: string | null; jam_selesai: string | null; title: string | null; task_description: string | null };
export type RowAttendance = { date_text: string; status: string };
export type RowSafety = { period_month: string; schedule: Record<string, string> | null };
export type RowContentPlan = { due_date: string | null; status: string | null };
export type RowTarget = { aktivitas: string; rencana: number; realisasi: number; tgl_mulai: string | null; deadline: string | null };
export type RowEvaluasi = { periode: string; kreativitas: number; brief: number; deadline: number; kualitas: number; komunikasi: number; revisi: number };

export type SumberQcc = {
  permintaan: RowPermintaan[];
  riwayat: RowRiwayat[];
  aktivitas: RowAktivitas[];
  attendance: RowAttendance[];
  safety: RowSafety[];
  contentPlan: RowContentPlan[];
  target: RowTarget[];
  evaluasi: RowEvaluasi[];
};

export type ItemPareto = { nama: string; n: number; nilai: number; jam: number; kumulatif: number };
export type FaktorFishbone = "Manusia" | "Metode" | "Material" | "Mesin" | "Lingkungan";
export type SebabFishbone = { teks: string; nilai: number; persen: number | null };
export type Fishbone = {
  masalah: string;
  jumlahMasalah: number;
  tulang: { faktor: FaktorFishbone; sebab: SebabFishbone[] }[];
  terkuat: { faktor: FaktorFishbone; teks: string } | null;
};
export type KandidatTema = { tema: string; bukti: string; sumber: string };

export type HasilPeriode = {
  mulai: string;
  selesai: string;
  label: string;
  tiket: {
    n: number;
    nWaktu: number;
    tanpaWaktu: number;
    cepat: number;
    cepatPct: number | null;
    lambat: number;
    medianTunggu: number | null;
    rataTunggu: number | null;
    medianKerja: number | null;
    totalTungguJam: number;
    totalKerjaJam: number;
    terlama: { kode: string; tgl: string; menit: number; jenis: string } | null;
    pareto: ItemPareto[];
    paretoDivisi: ItemPareto[];
    histogram: { label: string; n: number }[];
    kendali: { cl: number; ucl: number; lcl: number; titik: number[]; diLuar: number };
    scatter: { x: number[]; y: number[]; r: number | null };
    nDue: number;
    tepatWaktu: number;
    tepatPct: number | null;
  };
  suara: { nDinilai: number; rataRating: number | null; tiketRevisi: number };
  aktivitas: { n: number; tanpaJenis: number; tanpaJenisPct: number | null; nBerjam: number; jamTercatat: number; pareto: ItemPareto[] };
  kehadiran: { wajib: number; hadir: number; absen: number; ratePct: number | null };
  safety: { sesi: number; hadir: number; ratePct: number | null };
  konten: { n: number; status: [string, number][] };
  target: { nama: string; rencana: number; realisasi: number; capaian: number }[];
  evaluasi: { n: number; aspek: { label: string; nilai: number }[]; terendah: { nilai: number; aspek: string[] } | null };
  fishbone: Fishbone;
  kandidat: KandidatTema[];
};

export type LaporanQcc = { utama: HasilPeriode; banding: HasilPeriode | null };

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const r1 = (x: number) => Math.round(x * 10) / 10;
const pct = (a: number, b: number) => (b ? r1((a / b) * 100) : null);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const fmtAngka = (v: number, d = 1) => v.toLocaleString("id-ID", { maximumFractionDigits: d });

export const tglWib = (iso: string) => new Date(Date.parse(iso) + WIB_MS).toISOString().slice(0, 10);

export function formatTanggal(tgl: string) {
  return new Date(`${tgl}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Menit yang jatuh pada jam kerja: Senin–Jumat 08.00–17.00 WIB. */
export function menitKerja(mulaiMs: number, selesaiMs: number) {
  if (!(selesaiMs > mulaiMs)) return 0;
  const a = mulaiMs + WIB_MS;
  const b = selesaiMs + WIB_MS;
  let total = 0;
  for (let hari = Math.floor(a / 86400_000); hari * 86400_000 < b; hari++) {
    const awalHari = hari * 86400_000;
    const dow = new Date(awalHari).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const buka = awalHari + JAM_MULAI * 3600_000;
    const tutup = awalHari + JAM_SELESAI * 3600_000;
    total += Math.max(0, Math.min(b, tutup) - Math.max(a, buka));
  }
  return Math.round(total / 60_000);
}

const JENIS_DIKENAL = /^(design|photo|video)/i;
const jenisTiket = (project: string | null) => (project && JENIS_DIKENAL.test(project.trim()) ? project.trim() : "Lain-lain");
const namaDivisi = (d: string | null) => {
  const n = (d || "").trim();
  return ({ HR: "HR/GA", HSE: "K3" } as Record<string, string>)[n] || n || "Lain-lain";
};

function pareto(items: { nama: string; n: number; nilai: number }[], maxFaktor = 8): ItemPareto[] {
  const urut = items.filter((i) => i.nama !== "Lain-lain" && i.nilai > 0).sort((a, b) => b.nilai - a.nilai);
  const sisa = [...items.filter((i) => i.nama === "Lain-lain" && i.nilai > 0), ...urut.splice(maxFaktor)];
  const gabung = sisa.length ? [...urut, { nama: "Lain-lain", n: sum(sisa.map((i) => i.n)), nilai: sum(sisa.map((i) => i.nilai)) }] : urut;
  const total = sum(gabung.map((i) => i.nilai));
  let berjalan = 0;
  return gabung.map((i) => ({ ...i, jam: r1(i.nilai / 60), kumulatif: r1(((berjalan += i.nilai) / total) * 100) }));
}

function kelompok<T>(rows: T[], kunci: (r: T) => string, nilai: (r: T) => number) {
  const m = new Map<string, { nama: string; n: number; nilai: number }>();
  for (const r of rows) {
    const k = kunci(r);
    const g = m.get(k) ?? { nama: k, n: 0, nilai: 0 };
    g.n++;
    g.nilai += nilai(r);
    m.set(k, g);
  }
  return [...m.values()];
}

function pearson(x: number[], y: number[]) {
  if (x.length < 3) return null;
  const mx = sum(x) / x.length;
  const my = sum(y) / y.length;
  const penyebut = Math.sqrt(sum(x.map((v) => (v - mx) ** 2)) * sum(y.map((v) => (v - my) ** 2)));
  return penyebut ? Math.round((sum(x.map((v, i) => (v - mx) * (y[i] - my))) / penyebut) * 100) / 100 : null;
}

const KELAS: [number, number, string][] = [
  [0, 15, "0–15 mnt"], [15, 60, "15–60 mnt"], [60, 240, "1–4 jam"], [240, 540, "4–9 jam"], [540, 1080, "1–2 hari"], [1080, Infinity, "> 2 hari"],
];
const menitJam = (t: string) => { const [h, m] = t.split(":"); return +h * 60 + +m; };
const BULAN: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
function tglAttendance(t: string) {
  const m = t.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  return m ? `${m[3]}-${BULAN[m[2]]}-${m[1].padStart(2, "0")}` : t.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}
const kodeTiket = (p: RowPermintaan) => p.deskripsi?.match(/IT\d{6,}/)?.[0] ?? p.id.slice(0, 8);
const isiBrief = (d: string | null) => (d || "").replace(/\[[^\]]*\]/g, "").replace(/Referensi Tiket IT Helpdesk:\s*IT\d+/gi, "").trim();

type Tiket = {
  p: RowPermintaan;
  riwayat: RowRiwayat[];
  jenis: string;
  divisi: string;
  tunggu: number | null;
  kerja: number | null;
  buatMs: number;
};

function bentukTiket(p: RowPermintaan, riwayat: RowRiwayat[]): Tiket {
  const buatMs = Date.parse(p.created_at);
  // progress_at = done_at berarti waktu mulai tidak tercatat, jangan dihitung 0.
  const adaMulai = p.progress_at && p.progress_at !== p.done_at;
  const tunggu = adaMulai ? menitKerja(buatMs, Date.parse(p.progress_at!)) : null;
  let kerja: number | null = null;
  if (adaMulai) {
    kerja = 0;
    riwayat.forEach((r, i) => {
      const akhir = riwayat[i + 1]?.created_at;
      if (akhir && STATUS_DIHITUNG.includes(r.status_to as PermintaanStatus)) kerja! += menitKerja(Date.parse(r.created_at), Date.parse(akhir));
    });
  }
  return { p, riwayat, jenis: jenisTiket(p.project), divisi: namaDivisi(p.departemen), tunggu, kerja, buatMs };
}

function susunFishbone(semua: Tiket[], lambat: Tiket[], aktivitas: RowAktivitas[], kehadiranPct: number | null): Fishbone {
  const n = lambat.length;
  const sebab = (jumlah: number, teks: string): SebabFishbone => ({ teks, nilai: jumlah, persen: pct(jumlah, n) });
  const hitung = (f: (t: Tiket) => boolean) => lambat.filter(f).length;
  const jamWib = (t: Tiket) => new Date(t.buatMs + WIB_MS).getUTCHours();
  const hariWib = (t: Tiket) => new Date(t.buatMs + WIB_MS).getUTCDay();
  const catatan = (t: Tiket) => [t.p.deskripsi, ...t.riwayat.map((r) => r.catatan)].join(" ");

  const sibuk = hitung((t) => semua.some((o) => o !== t && o.p.progress_at && o.p.done_at && o.p.progress_at !== o.p.done_at
    && Date.parse(o.p.progress_at) <= t.buatMs && t.buatMs < Date.parse(o.p.done_at)));
  const luarJam = hitung((t) => menitKerja(t.buatMs, t.buatMs + 60_000) === 0);
  const sore = hitung((t) => jamWib(t) >= 15 && jamWib(t) < JAM_SELESAI);
  const jumat = hitung((t) => hariWib(t) === 5);
  const topJenis = kelompok(lambat, (t) => t.jenis, () => 1).sort((a, b) => b.n - a.n)[0];
  const perangkat = aktivitas.filter((a) => /maintenance|laptop|komputer|printer|install|error/i.test(`${a.title} ${a.task_description}`)).length;

  const tulang: Fishbone["tulang"] = [
    { faktor: "Manusia", sebab: [
      sebab(sibuk, `${sibuk} masuk saat tiket lain sedang dikerjakan`),
      ...(kehadiranPct != null && kehadiranPct < 95 ? [{ teks: `Kehadiran ${fmtAngka(kehadiranPct)}%`, nilai: 1, persen: null }] : []),
    ] },
    { faktor: "Metode", sebab: [
      sebab(hitung((t) => /\bacc\b|ttd|tanda tangan|persetujuan/i.test(catatan(t))), ""),
      sebab(hitung((t) => t.riwayat.some((r) => r.status_to === "PENDING")), ""),
    ].map((s, i) => ({ ...s, teks: `${s.nilai} ${["menunggu ACC atau tanda tangan", "sempat ditunda (Pending)"][i]}` }))
      .concat([{ teks: `${hitung((t) => (t.p.revision_count ?? 0) > 0)} mengalami revisi`, nilai: hitung((t) => (t.p.revision_count ?? 0) > 0), persen: null }]) },
    { faktor: "Material", sebab: [
      sebab(hitung((t) => /\bwa\b|whatsapp/i.test(t.p.deskripsi || "")), ""),
      sebab(hitung((t) => isiBrief(t.p.deskripsi).length < 30), ""),
    ].map((s, i) => ({ ...s, teks: `${s.nilai} ${["detail brief dikirim lewat WA", "brief sangat singkat"][i]}` }))
      .concat(topJenis ? [{ teks: `${topJenis.n} tiket jenis ${topJenis.nama}`, nilai: topJenis.n, persen: null }] : []) },
    { faktor: "Mesin", sebab: [{ teks: `${perangkat} aktivitas terkait perangkat`, nilai: perangkat, persen: null }] },
    { faktor: "Lingkungan", sebab: [
      sebab(luarJam, `${luarJam} masuk di luar jam kerja`),
      sebab(sore, `${sore} masuk setelah pukul 15.00`),
      sebab(jumat, `${jumat} masuk hari Jumat`),
    ] },
  ];

  for (const t of tulang) t.sebab = t.sebab.filter((s) => s.nilai > 0).sort((a, b) => b.nilai - a.nilai).slice(0, 2);

  const terkuat = tulang
    .flatMap((t) => t.sebab.filter((s) => s.persen != null && s.persen >= AMBANG_TERKUAT && s.nilai >= 2).map((s) => ({ faktor: t.faktor, teks: s.teks, persen: s.persen! })))
    .sort((a, b) => b.persen - a.persen)[0];

  return {
    masalah: n ? `${n} tiket menunggu lebih dari ${BATAS_MENIT} menit kerja` : `Tidak ada tiket menunggu lebih dari ${BATAS_MENIT} menit kerja`,
    jumlahMasalah: n,
    tulang,
    terkuat: terkuat ? { faktor: terkuat.faktor, teks: terkuat.teks } : null,
  };
}

export function hitungPeriode(s: SumberQcc, mulai: string, selesai: string): HasilPeriode {
  const dalam = (t: string | null) => !!t && t >= mulai && t <= selesai;
  const bulanMulai = mulai.slice(0, 7);
  const bulanSelesai = selesai.slice(0, 7);

  const riwayatPer = new Map<string, RowRiwayat[]>();
  for (const r of s.riwayat) {
    const a = riwayatPer.get(r.permintaan_id);
    if (a) a.push(r); else riwayatPer.set(r.permintaan_id, [r]);
  }
  const P = s.permintaan.filter((p) => dalam(tglWib(p.created_at)));
  const semua = P.map((p) => bentukTiket(p, riwayatPer.get(p.id) ?? [])).sort((a, b) => a.buatMs - b.buatMs);
  const W = semua.filter((t) => t.tunggu != null);
  const tunggu = W.map((t) => t.tunggu!);
  const kerja = W.map((t) => t.kerja ?? 0);
  const n = W.length;
  const lambat = W.filter((t) => t.tunggu! > BATAS_MENIT);

  const mr = tunggu.slice(1).map((v, i) => Math.abs(v - tunggu[i]));
  const cl = n ? sum(tunggu) / n : 0;
  const mrBar = mr.length ? sum(mr) / mr.length : 0;
  const ucl = cl + 2.66 * mrBar;
  const terlama = n ? W.reduce((x, y) => (y.tunggu! > x.tunggu! ? y : x)) : null;

  // Tiket impor menyimpan due_date = done_at: bukan tenggat asli, jadi tidak dihitung.
  const berTenggat = P.filter((p) => p.status === "DONE" && p.done_at && p.due_date && p.due_date !== p.done_at);
  const tepatWaktu = berTenggat.filter((p) => tglWib(p.done_at!) <= p.due_date!.slice(0, 10)).length;

  const rated = P.filter((p) => p.rating != null);
  const A = s.aktivitas.filter((a) => dalam(a.activity_date));
  const berjam = A.filter((a) => a.jam_mulai && a.jam_selesai).map((a) => ({ jenis: a.jenis_pekerjaan?.trim() || "Lain-lain", durasi: Math.max(0, menitJam(a.jam_selesai!) - menitJam(a.jam_mulai!)) }));
  const tanpaJenis = A.filter((a) => !a.jenis_pekerjaan?.trim()).length;

  const att = s.attendance.filter((a) => dalam(tglAttendance(a.date_text)));
  // Status berupa gabungan kode, mis. "EAI,PRS".
  const punyaKode = (status: string, kode: string) => status.split(",").map((k) => k.trim()).includes(kode);
  const hadir = att.filter((a) => punyaKode(a.status, "PRS")).length;
  const absen = att.filter((a) => punyaKode(a.status, "ABS")).length;
  const kehadiranPct = pct(hadir, hadir + absen);

  const sesi: boolean[] = [];
  for (const r of s.safety) {
    for (const [hari, nilai] of Object.entries(r.schedule ?? {})) {
      if (nilai && dalam(`${r.period_month}-${hari.padStart(2, "0")}`)) sesi.push(nilai === "H");
    }
  }

  const CP = s.contentPlan.filter((c) => dalam(c.due_date?.slice(0, 10) ?? null));
  const statusKonten = new Map<string, number>();
  CP.forEach((c) => statusKonten.set(c.status || "Tanpa status", (statusKonten.get(c.status || "Tanpa status") ?? 0) + 1));

  const target = s.target
    .filter((t) => (!t.tgl_mulai || t.tgl_mulai.slice(0, 10) <= selesai) && (!t.deadline || t.deadline.slice(0, 10) >= mulai) && t.rencana > 0)
    .map((t) => ({ nama: t.aktivitas, rencana: t.rencana, realisasi: t.realisasi, capaian: r1((t.realisasi / t.rencana) * 100) }))
    .sort((a, b) => a.capaian - b.capaian);

  const E = s.evaluasi.filter((e) => e.periode >= bulanMulai && e.periode <= bulanSelesai);
  const rataAspek = (k: keyof Omit<RowEvaluasi, "periode">) => Math.round((sum(E.map((e) => e[k])) / E.length) * 100) / 100;
  const aspek = E.length
    ? ([["Kreativitas", "kreativitas"], ["Brief", "brief"], ["Deadline", "deadline"], ["Kualitas", "kualitas"], ["Komunikasi", "komunikasi"], ["Revisi", "revisi"]] as const).map(([label, k]) => ({ label, nilai: rataAspek(k) }))
    : [];
  const nilaiMin = aspek.length ? Math.min(...aspek.map((a) => a.nilai)) : null;
  const terendah = nilaiMin != null ? { nilai: nilaiMin, aspek: aspek.filter((a) => a.nilai === nilaiMin).map((a) => a.label) } : null;

  const cepat = n - lambat.length;
  const cepatPct = pct(cepat, n);
  const tepatPct = pct(tepatWaktu, berTenggat.length);
  const tanpaJenisPct = pct(tanpaJenis, A.length);
  const targetRendah = target[0];

  const kandidat: KandidatTema[] = [];
  if (n >= MIN_TIKET && lambat.length > 0) kandidat.push({ tema: `Meningkatkan tiket desain yang mulai diproses ≤ ${BATAS_MENIT} menit kerja`, bukti: `${fmtAngka(cepatPct!)}% (${cepat} dari ${n} tiket)`, sumber: "Tiket" });
  if (berTenggat.length >= MIN_TIKET && tepatPct! < 90) kandidat.push({ tema: "Meningkatkan ketepatan waktu penyelesaian tiket desain", bukti: `${fmtAngka(tepatPct!)}% dari ${berTenggat.length} tiket bertenggat`, sumber: "Tiket" });
  if (targetRendah && targetRendah.capaian < 80) kandidat.push({ tema: `Meningkatkan realisasi ${targetRendah.nama}`, bukti: `${fmtAngka(targetRendah.capaian)}% dari rencana`, sumber: "Target Project" });
  if ((tanpaJenisPct ?? 0) > 10) kandidat.push({ tema: "Meningkatkan kelengkapan pencatatan Daily Activity", bukti: `${fmtAngka(tanpaJenisPct!)}% entri tanpa jenis pekerjaan`, sumber: "Daily Activity" });
  if (terendah) kandidat.push({ tema: `Meningkatkan nilai ${terendah.aspek.join(" dan ")} pada evaluasi desain`, bukti: `Skor ${fmtAngka(terendah.nilai, 2)} dari 5, terendah dari ${aspek.length} aspek`, sumber: "Evaluasi" });

  return {
    mulai,
    selesai,
    label: `${formatTanggal(mulai)} – ${formatTanggal(selesai)}`,
    tiket: {
      n: P.length,
      nWaktu: n,
      tanpaWaktu: P.length - n,
      cepat,
      cepatPct,
      lambat: lambat.length,
      medianTunggu: median(tunggu),
      rataTunggu: n ? Math.round(cl) : null,
      medianKerja: median(kerja),
      totalTungguJam: r1(sum(tunggu) / 60),
      totalKerjaJam: r1(sum(kerja) / 60),
      terlama: terlama && { kode: kodeTiket(terlama.p), tgl: formatTanggal(tglWib(terlama.p.created_at)), menit: terlama.tunggu!, jenis: terlama.jenis },
      pareto: pareto(kelompok(W, (t) => t.jenis, (t) => t.tunggu!), 6),
      paretoDivisi: pareto(kelompok(W, (t) => t.divisi, (t) => t.tunggu!), 8),
      histogram: KELAS.map(([a, b, label]) => ({ label, n: tunggu.filter((v) => v >= a && v < b).length })),
      kendali: { cl: Math.round(cl), ucl: Math.round(ucl), lcl: Math.max(0, Math.round(cl - 2.66 * mrBar)), titik: tunggu, diLuar: tunggu.filter((v) => v > ucl).length },
      scatter: { x: kerja, y: tunggu, r: pearson(kerja, tunggu) },
      nDue: berTenggat.length,
      tepatWaktu,
      tepatPct,
    },
    suara: {
      nDinilai: rated.length,
      rataRating: rated.length ? r1(sum(rated.map((p) => p.rating!)) / rated.length) : null,
      tiketRevisi: P.filter((p) => (p.revision_count ?? 0) > 0).length,
    },
    aktivitas: { n: A.length, tanpaJenis, tanpaJenisPct, nBerjam: berjam.length, jamTercatat: r1(sum(berjam.map((b) => b.durasi)) / 60), pareto: pareto(kelompok(berjam, (b) => b.jenis, (b) => b.durasi), 6) },
    kehadiran: { wajib: hadir + absen, hadir, absen, ratePct: kehadiranPct },
    safety: { sesi: sesi.length, hadir: sesi.filter(Boolean).length, ratePct: pct(sesi.filter(Boolean).length, sesi.length) },
    konten: { n: CP.length, status: [...statusKonten.entries()].sort((a, b) => b[1] - a[1]) },
    target,
    evaluasi: { n: E.length, aspek, terendah },
    fishbone: susunFishbone(semua, lambat, A, kehadiranPct),
    kandidat,
  };
}
