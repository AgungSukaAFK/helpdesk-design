// Generator PPT Rekap Bulanan Terintegrasi (4 modul). Memakai tema yang sama dengan
// laporan QCC. Semua judul dibentuk dari data bulan yang dipilih; slide yang datanya
// kosong dilewati dan dicatat di lampiran.
import pptxgen from "pptxgenjs";
import type { MonthIntegratedData, YearIntegratedRekap } from "@/lib/rekap-integrated";
import {
  C, LEBAR, W, angka, angkaBesar, barisBanding, catatan, judul, judulY, kartu, muatLogo, pasangMaster, sumberKaki, sumbu, tabel, teks,
  type Logo, type Pres, type Sel, type Slide,
} from "@/lib/ppt/tema";

const DEPT = "Departemen Design";
const SISI = W.kertas - W.tepi - W.sisi;
const GRADE_WARNA: Record<string, string> = { "Sangat Baik": C.hijau, Baik: C.biru, "Cukup Baik": C.oranye, "Kurang Baik": "B42318" };

type Bagian = "Pembuka" | "Permintaan Design" | "Operasional" | "Evaluasi" | "Lampiran";
type Konteks = {
  pres: Pres;
  R: YearIntegratedRekap;
  M: MonthIntegratedData;
  /** Bulan sebelumnya pada tahun yang sama, null jika Januari */
  P: MonthIntegratedData | null;
  /** Januari s.d. bulan yang dipilih */
  S: MonthIntegratedData[];
  label: string;
  dilewati: string[];
  logo: Logo;
  tambah: (master: "KONTEN" | "GELAP", bagian: string) => Slide;
};
type Definisi = {
  id: string;
  judul: string;
  bagian: Bagian;
  syarat?: (k: Konteks) => string | null;
  buat: (k: Konteks) => void;
};

const pendek = (m: MonthIntegratedData) => m.monthName.slice(0, 3);
const persen = (v: number | null | undefined) => (v == null ? "-" : `${angka(v)}%`);
const PRIO = [
  ["p1", "P1 - Kritis"],
  ["p2", "P2 - Tinggi"],
  ["p3", "P3 - Sedang"],
  ["p4", "P4 - Rendah"],
] as const;

function selisihPoin(a: number | null, b: number | null, nama: string, prev: string): string | null {
  if (a == null || b == null) return null;
  const d = Math.round((a - b) * 10) / 10;
  if (d === 0) return `${nama} sama dengan ${prev} (${angka(a)}%).`;
  return `${nama} ${d > 0 ? "naik" : "turun"} ${angka(Math.abs(d))} poin dari ${prev} (${angka(b)}% → ${angka(a)}%).`;
}

/** Grafik batang + garis persen di sumbu kanan, satu gaya untuk semua modul. */
function grafikBatangGaris(
  k: Konteks,
  s: Slide,
  labels: string[],
  batang: { name: string; values: (number | null)[]; warna: string }[],
  garis: { name: string; values: (number | null)[] } | null,
  o: { altText: string; satuanKiri: string; stacked?: boolean; w?: number }
) {
  const w = o.w ?? 8.2;
  const fontKategori = labels.length > 12 ? 9 : 12;
  if (!garis) {
    // Tanpa garis: grafik batang tunggal (posisi label "outEnd" tidak valid untuk batang stacked)
    s.addChart(k.pres.ChartType.bar, batang.map((b) => ({ name: b.name, labels, values: b.values })) as never, {
      x: W.tepi, y: W.atas, w, h: W.tinggi, altText: o.altText, showLegend: true, legendPos: "b", ...sumbu, ...judulY(o.satuanKiri),
      chartColors: batang.map((b) => b.warna), barGapWidthPct: o.stacked ? 45 : 30, barGrouping: o.stacked ? "stacked" : "clustered",
      showValue: !o.stacked && labels.length <= 12, dataLabelPosition: o.stacked ? "ctr" : "outEnd", dataLabelFormatCode: "0", valAxisMinVal: 0, catAxisLabelFontSize: fontKategori,
    } as never);
    return;
  }
  const tipe = [
    {
      type: k.pres.ChartType.bar,
      data: batang.map((b) => ({ name: b.name, labels, values: b.values })),
      options: {
        chartColors: batang.map((b) => b.warna), barGapWidthPct: 45, barGrouping: "clustered",
        showValue: labels.length <= 12, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", ...sumbu,
      },
    },
    {
      type: k.pres.ChartType.line,
      data: [{ name: garis.name, labels, values: garis.values }],
      options: { chartColors: [C.oranye], lineSize: 2.5, lineDataSymbolSize: 7, secondaryValAxis: true, secondaryCatAxis: true, showValue: labels.length <= 12, dataLabelPosition: "t", dataLabelFormatCode: "0.0", dataLabelColor: C.oranye },
    },
  ];
  s.addChart(tipe as never, {
    x: W.tepi, y: W.atas, w, h: W.tinggi, altText: o.altText, showLegend: true, legendPos: "b", ...sumbu,
    valAxes: [
      { showValAxisTitle: true, valAxisTitle: o.satuanKiri, valAxisTitleFontSize: 12, valAxisTitleColor: C.abu, valAxisLabelFontSize: 12, valAxisLabelColor: C.abu, valAxisMinVal: 0, valGridLine: { color: C.garis, size: 0.5 } },
      { showValAxisTitle: true, valAxisTitle: "%", valAxisTitleFontSize: 12, valAxisTitleColor: C.abu, valAxisLabelFontSize: 12, valAxisLabelColor: C.abu, valAxisMinVal: 0, valAxisMaxVal: 100, valGridLine: { style: "none" } },
    ],
    catAxes: [{ catAxisLabelFontSize: fontKategori, catAxisLabelColor: C.abu }, { catAxisHidden: true }],
  } as never);
}

const kaki = (k: Konteks, sumber: string) => `Sumber: ${sumber}, ${k.label}. Data Januari s.d. ${k.M.monthName} ${k.R.year}.`;

export const SLIDE: Definisi[] = [
  { id: "sampul", judul: "Sampul", bagian: "Pembuka", buat(k) {
    const s = k.tambah("GELAP", "Pembuka");
    judul(s, `Rekap Bulanan ${DEPT}`);
    teks(s, k.label, { x: W.tepi, y: 3.0, w: 11, h: 0.5, fontSize: 24, bold: true, color: C.garis });
    teks(s, "Permintaan Design · Daily Activity · Attendance · Safety Toolbox Meeting HSE", { x: W.tepi, y: 3.6, w: 11, h: 0.4, fontSize: 16, color: C.garis });
    kartu(k, s, W.tepi, 6.05, 1.65, 0.75, C.putih);
    s.addImage({ data: k.logo.data, x: W.tepi + 0.17, y: 6.05 + (0.75 - 1.3 / k.logo.rasio) / 2, w: 1.3, h: 1.3 / k.logo.rasio, altText: "Logo Lourdes Auto Parts" });
  } },

  { id: "ringkasan", judul: "Ringkasan bulan", bagian: "Pembuka", buat(k) {
    const s = k.tambah("KONTEN", "Pembuka");
    const { M, P } = k, p = M.permintaan, d = M.daily, a = M.attendance, t = M.safetyToolboxMeeting;
    judul(s, M.kpiGrade ? `KPI ${k.label} berada di level ${M.kpiGrade}` : `Ringkasan ${k.label}`);
    const g = 0.3, w = (LEBAR - 3 * g) / 4, y = W.atas + 0.2;
    angkaBesar(s, W.tepi, y, w, persen(p.selesai > 0 ? p.slaPct : null), `SLA permintaan, ${p.onTime} dari ${p.selesai} tiket selesai tepat waktu`, C.biru);
    angkaBesar(s, W.tepi + (w + g), y, w, persen(d.total > 0 ? d.completionRate : null), `Daily Activity selesai, ${d.done} dari ${d.total} aktivitas`, C.hijau);
    angkaBesar(s, W.tepi + 2 * (w + g), y, w, persen(a.attendanceRate), `kehadiran, ${a.prs} hadir dan ${a.abs} absen`, C.oranye);
    angkaBesar(s, W.tepi + 3 * (w + g), y, w, `${angka(t.totalStandby, 0)} sesi`, `Safety Toolbox Meeting, ${t.personil} personil terjadwal`, C.navy);

    const prev = P ? P.monthName : "";
    const prio = PRIO.map(([kode, nama]) => ({ nama, x: p.priorityBreakdown?.[kode] })).filter((v) => v.x && v.x.total > 0 && v.x.pct != null).sort((a1, b1) => a1.x!.pct! - b1.x!.pct!)[0];
    const poin = [
      P && P.active && selisihPoin(p.selesai > 0 ? p.slaPct : null, P.permintaan.selesai > 0 ? P.permintaan.slaPct : null, "SLA permintaan", prev),
      P && P.active && selisihPoin(d.total > 0 ? d.completionRate : null, P.daily.total > 0 ? P.daily.completionRate : null, "Penyelesaian Daily Activity", prev),
      prio && `Prioritas terendah: ${prio.nama}, ${angka(prio.x!.pct)}% (${prio.x!.done} dari ${prio.x!.total} tiket).`,
      p.eskalasi > 0 && `${p.eskalasi} tiket berstatus Review/Revisi (eskalasi).`,
      a.overtimeHours > 0 && `Lembur ${angka(a.overtimeHours)} jam dari ${a.ovt} hari OVT.`,
    ].filter(Boolean) as string[];
    catatan(k, s, W.tepi, 4.0, LEBAR, 2.3, "Yang perlu diperhatikan", poin.length ? poin.slice(0, 4) : [M.active ? "Belum ada catatan yang menonjol pada bulan ini." : "Belum ada data operasional yang tercatat untuk bulan ini."]);
    sumberKaki(s, `Periode ${k.label}. KPI Grade = SLA 40% + Daily Activity 35% + Attendance 25%.`);
  } },

  { id: "cakupan", judul: "Cakupan data", bagian: "Pembuka", buat(k) {
    const s = k.tambah("KONTEN", "Pembuka");
    const { M } = k, T = k.R.totals;
    judul(s, "Empat modul yang direkap pada laporan ini");
    tabel(s, [
      ["Modul", k.label, `YTD ${k.R.year}`, "Dipakai untuk"],
      ["Permintaan Design", `${M.permintaan.masuk} tiket masuk`, `${T.permintaanMasuk} tiket masuk`, "SLA, prioritas, eskalasi, durasi"],
      ["Daily Activity", `${M.daily.total} aktivitas`, `${T.dailyTotal} aktivitas`, "Tingkat penyelesaian tugas"],
      ["Attendance", `${M.attendance.totalRecords} catatan`, `${T.attendancePrs + T.attendanceAbs + T.attendanceOvt + T.attendanceOff} catatan`, "Kehadiran dan lembur"],
      ["Safety Toolbox Meeting HSE", `${M.safetyToolboxMeeting.totalStandby} sesi`, `${T.safetyToolboxMeetingTotalStandby} sesi`, "Konsistensi roster standby"],
    ], { x: W.tepi, y: W.atas, w: LEBAR, colW: [3.4, 2.6, 2.6, 3.53], rowH: 0.6 });
    sumberKaki(s, `Periode ${k.label}. YTD = Januari s.d. bulan berjalan.`);
  } },

  { id: "permintaan", judul: "Volume dan SLA permintaan", bagian: "Permintaan Design",
    syarat: (k) => (k.R.totals.permintaanMasuk > 0 ? null : "tidak ada tiket permintaan"),
    buat(k) {
      const s = k.tambah("KONTEN", "Permintaan Design");
      const { M, P, S } = k, p = M.permintaan;
      const sla = p.selesai > 0 ? p.slaPct : null, slaP = P && P.permintaan.selesai > 0 ? P.permintaan.slaPct : null;
      const d = sla != null && slaP != null ? Math.round((sla - slaP) * 10) / 10 : null;
      judul(s, sla == null ? `${p.masuk} tiket masuk pada ${k.label}` : d == null || d === 0 ? `SLA ${k.label} mencapai ${angka(sla)}%` : `SLA ${M.monthName} ${d > 0 ? "naik" : "turun"} ${angka(Math.abs(d))} poin menjadi ${angka(sla)}%`);
      grafikBatangGaris(k, s, S.map(pendek), [
        { name: "Tiket masuk", values: S.map((m) => m.permintaan.masuk), warna: C.biruMuda },
        { name: "Tiket selesai", values: S.map((m) => m.permintaan.selesai), warna: C.biru },
      ], { name: "SLA (%)", values: S.map((m) => (m.permintaan.selesai > 0 ? m.permintaan.slaPct : null)) }, { altText: "Tiket masuk, selesai, dan SLA per bulan", satuanKiri: "Tiket" });
      catatan(k, s, W.sisi, W.atas, SISI, W.tinggi, M.monthName, [
        `${p.masuk} tiket masuk, ${p.selesai} selesai (${persen(p.resRate)}).`,
        `Rata-rata durasi ${p.avgDurationHours == null ? "-" : `${angka(p.avgDurationHours)} jam`}.`,
        `${p.eskalasi} tiket eskalasi (Review/Revisi).`,
      ], { nilai: persen(sla), label: `tiket selesai tepat SLA (${p.onTime} dari ${p.selesai})` });
      sumberKaki(s, kaki(k, "tiket Permintaan Design"));
    } },

  { id: "prioritas", judul: "SLA per prioritas", bagian: "Permintaan Design",
    syarat: (k) => (PRIO.some(([kode]) => (k.M.permintaan.priorityBreakdown?.[kode].total ?? 0) > 0) ? null : "tidak ada tiket berprioritas pada bulan ini"),
    buat(k) {
      const s = k.tambah("KONTEN", "Permintaan Design");
      const p = k.M.permintaan, pb = p.priorityBreakdown!;
      const ada = PRIO.filter(([kode]) => pb[kode].total > 0).map(([kode, nama]) => ({ nama, ...pb[kode], pct: pb[kode].pct ?? 0 }));
      const rendah = [...ada].sort((a, b) => a.pct - b.pct)[0];
      judul(s, ada.length > 1 ? `${rendah.nama} paling rendah: ${angka(rendah.pct)}% tiket tepat SLA` : `${rendah.nama}: ${angka(rendah.pct)}% tiket tepat SLA`);
      const L = [...ada].reverse();
      s.addChart(k.pres.ChartType.bar, [{ name: "SLA (%)", labels: L.map((x) => `${x.nama} (${x.done}/${x.total})`), values: L.map((x) => x.pct) }], {
        x: W.tepi, y: W.atas, w: 8.2, h: W.tinggi, barDir: "bar", altText: "SLA per prioritas", chartColors: L.map((x) => (x === rendah ? C.oranye : C.biruMuda)), barGapWidthPct: 45, showLegend: false,
        showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", ...sumbu, valAxisHidden: true, valGridLine: { style: "none" }, valAxisMinVal: 0, valAxisMaxVal: 110,
      });
      const status = Object.entries(p.statuses || {}).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n}: ${v} tiket`);
      const eskPct = p.masuk > 0 ? Math.round((p.eskalasi / p.masuk) * 1000) / 10 : 0;
      catatan(k, s, W.sisi, W.atas, SISI, W.tinggi, "Status tiket", status.length ? status.slice(0, 6) : ["Tidak ada tiket."], { nilai: `${angka(eskPct)}%`, label: `tiket eskalasi (${p.eskalasi} tiket)` });
      sumberKaki(s, `Sumber: tiket Permintaan Design, ${k.label}. Angka dalam kurung = tercapai/total tiket.`);
    } },

  { id: "daily", judul: "Daily Activity", bagian: "Operasional",
    syarat: (k) => (k.R.totals.dailyTotal > 0 ? null : "tidak ada Daily Activity"),
    buat(k) {
      const s = k.tambah("KONTEN", "Operasional");
      const { M, S } = k, d = M.daily;
      const rate = d.total > 0 ? d.completionRate : null;
      judul(s, rate == null ? `Belum ada Daily Activity pada ${k.label}` : `${angka(rate)}% Daily Activity ${M.monthName} selesai`);
      grafikBatangGaris(k, s, S.map(pendek), [
        { name: "Total aktivitas", values: S.map((m) => m.daily.total), warna: C.biruMuda },
        { name: "Done", values: S.map((m) => m.daily.done), warna: C.hijau },
      ], { name: "Penyelesaian (%)", values: S.map((m) => (m.daily.total > 0 ? m.daily.completionRate : null)) }, { altText: "Daily Activity per bulan", satuanKiri: "Aktivitas" });
      const st = ([["In Progress", d.inProgress], ["Revisi", d.revisi], ["Review", d.review], ["Pending", d.pending], ["Waiting", d.waiting]] as const).filter(([, v]) => v > 0).map(([n, v]) => `${n}: ${v}`);
      catatan(k, s, W.sisi, W.atas, SISI, W.tinggi, "Belum selesai", st.length ? st : ["Semua aktivitas sudah Done."], { nilai: persen(rate), label: `${d.done} dari ${d.total} aktivitas Done` });
      sumberKaki(s, kaki(k, "Daily Activity"));
    } },

  { id: "attendance", judul: "Attendance", bagian: "Operasional",
    syarat: (k) => (k.R.totals.attendancePrs + k.R.totals.attendanceAbs + k.R.totals.attendanceOvt + k.R.totals.attendanceOff > 0 ? null : "tidak ada data Attendance"),
    buat(k) {
      const s = k.tambah("KONTEN", "Operasional");
      const { M, S } = k, a = M.attendance;
      judul(s, a.attendanceRate == null ? `Belum ada data kehadiran pada ${k.label}` : `Tingkat kehadiran ${M.monthName} ${angka(a.attendanceRate)}%`);
      grafikBatangGaris(k, s, S.map(pendek), [
        { name: "Hadir (PRS)", values: S.map((m) => m.attendance.prs), warna: C.hijau },
        { name: "Lembur (OVT)", values: S.map((m) => m.attendance.ovt), warna: C.biru },
        { name: "Libur (OFF)", values: S.map((m) => m.attendance.off), warna: C.biruMuda },
        { name: "Absen (ABS)", values: S.map((m) => m.attendance.abs), warna: C.oranye },
      ], null, { altText: "Status kehadiran per bulan", satuanKiri: "Hari", stacked: true });
      catatan(k, s, W.sisi, W.atas, SISI, W.tinggi, "Kehadiran", [
        `${a.prs} hari hadir, ${a.abs} absen, ${a.off} libur.`,
        `Tingkat kehadiran ${persen(a.attendanceRate)} = PRS ÷ (PRS + ABS).`,
      ], { nilai: `${angka(a.overtimeHours)} jam`, label: `lembur dari ${a.ovt} hari OVT` });
      sumberKaki(s, kaki(k, "Attendance"));
    } },

  { id: "safety", judul: "Safety Toolbox Meeting HSE", bagian: "Operasional",
    syarat: (k) => (k.R.totals.safetyToolboxMeetingTotalStandby > 0 ? null : "tidak ada roster Safety Toolbox"),
    buat(k) {
      const s = k.tambah("KONTEN", "Operasional");
      const { M, S } = k, t = M.safetyToolboxMeeting;
      judul(s, `${angka(t.totalStandby, 0)} sesi Safety Toolbox Meeting pada ${k.label}`);
      grafikBatangGaris(k, s, S.map(pendek), [
        { name: "Siang (H)", values: S.map((m) => m.safetyToolboxMeeting.countH), warna: C.biru },
        { name: "Malam (h)", values: S.map((m) => m.safetyToolboxMeeting.countHSmall), warna: C.navy },
        { name: "Lainnya", values: S.map((m) => m.safetyToolboxMeeting.countOther), warna: C.biruMuda },
      ], null, { altText: "Sesi Safety Toolbox per bulan", satuanKiri: "Sesi", stacked: true });
      catatan(k, s, W.sisi, W.atas, SISI, W.tinggi, "Roster standby", [
        `${t.countH} sesi siang (08.00–17.00).`,
        `${t.countHSmall} sesi malam (17.00–08.00).`,
        ...(t.countOther ? [`${t.countOther} sesi kode lain.`] : []),
      ], { nilai: `${t.personil} personil`, label: "terdaftar di roster bulan ini" });
      sumberKaki(s, kaki(k, "roster Safety Toolbox Meeting HSE"));
    } },

  { id: "harian", judul: "Trend harian", bagian: "Operasional",
    syarat: (k) => ((k.M.dailyTrend ?? []).some((d) => d.masuk + d.selesai + d.dailyTotal > 0) ? null : "tidak ada aktivitas harian pada bulan ini"),
    buat(k) {
      const s = k.tambah("KONTEN", "Operasional");
      const D = k.M.dailyTrend!;
      const puncak = [...D].sort((a, b) => b.masuk + b.dailyDone - (a.masuk + a.dailyDone))[0];
      const aktif = D.filter((d) => d.masuk + d.selesai + d.dailyTotal > 0);
      judul(s, `Beban harian tertinggi pada ${puncak.day} ${k.M.monthName}`);
      grafikBatangGaris(k, s, D.map((d) => String(d.day)), [
        { name: "Tiket masuk", values: D.map((d) => d.masuk), warna: C.biruMuda },
        { name: "Tiket selesai", values: D.map((d) => d.selesai), warna: C.biru },
        { name: "Daily Activity done", values: D.map((d) => d.dailyDone), warna: C.hijau },
      ], null, { altText: "Trend harian tiket dan Daily Activity", satuanKiri: "Jumlah" });
      const totalMasuk = D.reduce((a, d) => a + d.masuk, 0);
      catatan(k, s, W.sisi, W.atas, SISI, W.tinggi, "Pola harian", [
        `Rata-rata ${angka(aktif.length ? totalMasuk / aktif.length : 0)} tiket masuk per hari aktif.`,
        `Puncak tanggal ${puncak.day}: ${puncak.masuk} tiket masuk, ${puncak.dailyDone} aktivitas selesai.`,
      ], { nilai: `${aktif.length} hari`, label: `ada aktivitas dari ${D.length} hari` });
      sumberKaki(s, `Sumber: tiket dan Daily Activity per tanggal, ${k.label}.`);
    } },

  { id: "tabel", judul: "Rekap per bulan", bagian: "Evaluasi", buat(k) {
    const s = k.tambah("KONTEN", "Evaluasi");
    const { S, M, R } = k, T = R.totals;
    judul(s, `KPI Januari–${M.monthName} ${R.year}: ${T.overallKpiGrade}`);
    const grade = (g: string | null): Sel => (g ? { text: g, options: { bold: true, color: GRADE_WARNA[g] ?? C.tinta } } : { text: "-", options: { color: C.abu } });
    const baris: Sel[][] = [
      ["Bulan", "Tiket masuk / selesai", "SLA", "Daily selesai", "Kehadiran", "Lembur", "Safety Toolbox", "KPI Grade"],
      ...S.map((m) => {
        const fokus = m === M, o = fokus ? { bold: true, fill: { color: C.kartu } } : m.active ? {} : { color: C.abu };
        const sel = (t: string): Sel => ({ text: t, options: o });
        const g = grade(m.kpiGrade);
        return [
          sel(m.monthName), sel(`${m.permintaan.masuk} / ${m.permintaan.selesai}`), sel(persen(m.permintaan.selesai > 0 ? m.permintaan.slaPct : null)),
          sel(persen(m.daily.total > 0 ? m.daily.completionRate : null)), sel(persen(m.attendance.attendanceRate)), sel(m.attendance.overtimeHours ? `${angka(m.attendance.overtimeHours)} jam` : "-"),
          sel(m.safetyToolboxMeeting.totalStandby ? `${m.safetyToolboxMeeting.totalStandby} sesi` : "-"), typeof g === "string" ? g : { text: g.text, options: { ...o, ...g.options } },
        ];
      }),
      ...[[`YTD ${R.year}`, `${T.permintaanMasuk} / ${T.permintaanSelesai}`, persen(T.permintaanSlaPct), persen(T.dailyRate), persen(T.attendanceRate), `${angka(T.attendanceTotalMinutes / 60)} jam`, `${T.safetyToolboxMeetingTotalStandby} sesi`, T.overallKpiGrade].map<Sel>((t) => ({ text: t, options: { bold: true, color: C.putih, fill: { color: C.navy } } }))],
    ];
    const rowH = Math.min(0.42, W.tinggi / baris.length);
    tabel(s, baris, { x: W.tepi, y: W.atas, w: LEBAR, colW: [1.6, 2.0, 1.2, 1.4, 1.3, 1.3, 1.6, 1.73], rowH, fontSize: baris.length > 10 ? 12 : 14, align: "center" });
    sumberKaki(s, "Bulan yang dibahas ditandai tebal. Persen dihitung dari bulan yang punya data.");
  } },

  { id: "perbandingan", judul: "Perbandingan bulan sebelumnya", bagian: "Evaluasi",
    syarat: (k) => (k.P && k.P.active ? null : "bulan sebelumnya tidak punya data"),
    buat(k) {
      const s = k.tambah("KONTEN", "Evaluasi");
      const { M } = k, P = k.P!;
      const sla = (m: MonthIntegratedData) => (m.permintaan.selesai > 0 ? m.permintaan.slaPct : null);
      const dr = (m: MonthIntegratedData) => (m.daily.total > 0 ? m.daily.completionRate : null);
      const baris = [
        barisBanding("Tiket masuk", M.permintaan.masuk, P.permintaan.masuk, null, "", 0),
        barisBanding("Tiket selesai", M.permintaan.selesai, P.permintaan.selesai, "Max", "", 0),
        barisBanding("SLA permintaan", sla(M), sla(P), "Max", "%"),
        barisBanding("Rata-rata durasi", M.permintaan.avgDurationHours, P.permintaan.avgDurationHours, "Min", " jam"),
        barisBanding("Tiket eskalasi", M.permintaan.eskalasi, P.permintaan.eskalasi, "Min", "", 0),
        barisBanding("Daily Activity selesai", dr(M), dr(P), "Max", "%"),
        barisBanding("Tingkat kehadiran", M.attendance.attendanceRate, P.attendance.attendanceRate, "Max", "%"),
        barisBanding("Jam lembur", M.attendance.overtimeHours, P.attendance.overtimeHours, null, " jam"),
        barisBanding("Sesi Safety Toolbox", M.safetyToolboxMeeting.totalStandby, P.safetyToolboxMeeting.totalStandby, null, "", 0),
      ];
      const arah = (b: Sel[]) => (typeof b[3] === "string" ? b[3] : b[3].text);
      const naik = baris.filter((b) => arah(b) === "Membaik").length, turun = baris.filter((b) => arah(b) === "Menurun").length;
      judul(s, naik || turun ? `${naik} membaik, ${turun} menurun dibanding ${P.monthName}` : `Kinerja ${M.monthName} setara dengan ${P.monthName}`);
      tabel(s, [["Indikator", P.monthName, M.monthName, "Arah"], ...baris], { x: W.tepi, y: W.atas, w: LEBAR, colW: [5.33, 2.4, 2.4, 2.0], rowH: 0.49 });
      sumberKaki(s, "Selisih di bawah 5% dianggap hampir sama. Tiket masuk, lembur, dan sesi Safety Toolbox tidak dinilai arahnya.");
    } },

  { id: "lampiran", judul: "Acuan dan batasan data", bagian: "Lampiran", buat(k) {
    const s = k.tambah("KONTEN", "Lampiran");
    judul(s, "Acuan SLA dan batasan data");
    tabel(s, [
      ["Prioritas", "Waktu respon", "Waktu penyelesaian"],
      ["P1 - Kritis (Urgent)", "15 menit", "2 jam"],
      ["P2 - Tinggi (Prioritas)", "30 menit", "4 jam"],
      ["P3 - Sedang (Normal)", "2 jam", "24 jam"],
      ["P4 - Rendah (Normal)", "4 jam", "48 jam"],
    ], { x: W.tepi, y: W.atas, w: 6.6, colW: [3.0, 1.8, 1.8], rowH: 0.45, fontSize: 13 });
    teks(s, "KPI Grade: ≥90% Sangat Baik · 80–89% Baik · 60–79% Cukup Baik · <60% Kurang Baik. Bobot SLA 40%, Daily Activity 35%, Attendance 25%.", { x: W.tepi, y: W.atas + 2.5, w: 6.6, h: 0.8, fontSize: 13, color: C.abu });
    const x = W.tepi + 7.0;
    catatan(k, s, x, W.atas, W.kertas - W.tepi - x, W.tinggi, "Batasan data", [
      "SLA tercapai jika tiket selesai paling lambat 24 jam setelah tenggat.",
      "Prioritas ditaksir dari jarak tanggal masuk ke tenggat.",
      "Eskalasi = tiket berstatus Review/Revisi saat laporan dibuat.",
      "Durasi memakai estimasi jika waktu selesai tidak wajar.",
      ...(k.dilewati.length ? [`Slide dilewati: ${k.dilewati.join("; ")}.`] : []),
    ]);
    sumberKaki(s, `Periode ${k.label}.`);
  } },

  { id: "penutup", judul: "Penutup", bagian: "Lampiran", buat(k) {
    const s = k.tambah("GELAP", "Lampiran");
    const { M } = k, p = M.permintaan;
    const kandidat = [
      { nama: "SLA permintaan", v: p.selesai > 0 ? p.slaPct : null },
      { nama: "penyelesaian Daily Activity", v: M.daily.total > 0 ? M.daily.completionRate : null },
      { nama: "tingkat kehadiran", v: M.attendance.attendanceRate },
    ].filter((x) => x.v != null).sort((a, b) => a.v! - b.v!);
    const prio = PRIO.map(([kode, nama]) => ({ nama, x: p.priorityBreakdown?.[kode] })).filter((v) => v.x && v.x.total > 0 && v.x.pct != null && v.x.pct < 100).sort((a, b) => a.x!.pct! - b.x!.pct!)[0];
    const poin = [
      kandidat[0] && kandidat[0].v! < 90 ? `Naikkan ${kandidat[0].nama} dari ${angka(kandidat[0].v)}% menuju ≥90%` : "Pertahankan capaian KPI di level Sangat Baik",
      prio && `Perbaiki ketepatan ${prio.nama} (${angka(prio.x!.pct)}%)`,
      p.eskalasi > 0 ? `Tuntaskan ${p.eskalasi} tiket Review/Revisi` : "Jaga tiket tanpa revisi",
    ].filter(Boolean) as string[];
    judul(s, "Fokus bulan berikutnya");
    teks(s, poin.map((l, i) => ({ text: l, options: { bullet: { indent: 16 }, breakLine: i < poin.length - 1, paraSpaceAfter: 8 } })), { x: W.tepi, y: 3.5, w: 11, h: 1.9, fontSize: 18, color: C.putih });
  } },
];

/** Bangun PPT rekap untuk bulan `bulan` ("01".."12"). */
export async function buatPptRekap(R: YearIntegratedRekap, bulan: string): Promise<Buffer> {
  const idx = Math.max(0, R.months.findIndex((m) => m.monthNum === bulan));
  const M = R.months[idx];
  const pres = new pptxgen();
  const logo = muatLogo();
  pasangMaster(pres, logo);
  const label = `${M.monthName} ${R.year}`;
  pres.title = `Rekap Bulanan ${DEPT}, ${label}`;
  pres.author = DEPT;

  const k: Konteks = {
    pres, R, M, P: idx > 0 ? R.months[idx - 1] : null, S: R.months.slice(0, idx + 1), label, dilewati: [], logo,
    tambah: (masterName, sectionTitle) => pres.addSlide({ masterName, sectionTitle }),
  };
  const aktif = SLIDE.filter((d) => {
    const alasan = d.syarat?.(k);
    if (alasan) k.dilewati.push(`${d.judul} (${alasan})`);
    return !alasan;
  });
  let bagian: string | null = null;
  for (const d of aktif) {
    if (d.bagian !== bagian) {
      pres.addSection({ title: d.bagian });
      bagian = d.bagian;
    }
    d.buat(k);
  }
  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}
