import type { MonthIntegratedData, YearIntegratedRekap } from "@/lib/rekap-integrated";
import {
  QCC,
  X_KIRI,
  LEBAR_KONTEN,
  buatDeck,
  kartuKpi,
  kotakCatatan,
  slideAgenda,
  slidePenutup,
  slideTabel,
  tabelDiSlide,
  fmtPct,
} from "@/lib/pptx-qcc";

const LABEL_STATUS: Record<string, string> = {
  "TO DO": "To Do",
  PROGRESS: "Progress",
  REVIEW: "Review",
  REVISION: "Revisi",
  PENDING: "Pending",
  CETAK: "Proses Cetak",
  DONE: "Done",
};

const WARNA_STATUS: Record<string, string> = {
  "TO DO": "A5A5A5",
  PROGRESS: QCC.blue,
  REVIEW: QCC.yellow,
  REVISION: QCC.orange,
  PENDING: "7F7F7F",
  CETAK: "0891B2",
  DONE: QCC.green,
};

const warnaGrade = (g?: string | null) =>
  g === "Sangat Baik" ? QCC.green : g === "Baik" ? QCC.blue : g === "Cukup Baik" ? QCC.yellow : g ? QCC.red : QCC.gray;

const TARGET = { sla: 90, penyelesaian: 90, daily: 90, kehadiran: 95 };

function analisa(m: MonthIntegratedData) {
  const temuan: { masalah: string; aksi: string }[] = [];
  const p = m.permintaan;
  if (p.slaPct !== null && p.slaPct < TARGET.sla) {
    temuan.push({
      masalah: `Ketepatan SLA permintaan ${fmtPct(p.slaPct)} (target ≥ ${TARGET.sla}%)`,
      aksi: "Prioritaskan tiket mendekati deadline di briefing harian; pantau tiket berisiko tiap pagi",
    });
  }
  if (p.resRate !== null && p.resRate < TARGET.penyelesaian) {
    temuan.push({
      masalah: `Penyelesaian permintaan ${fmtPct(p.resRate)} (${p.selesai} dari ${p.masuk})`,
      aksi: "Tuntaskan backlog bulan berjalan; tetapkan PIC & target tanggal per tiket terbuka",
    });
  }
  if (p.eskalasi > 0) {
    temuan.push({
      masalah: `${p.eskalasi} tiket masih Review/Revisi di akhir periode`,
      aksi: "Konfirmasi brief lebih rinci di awal & follow-up peminta yang belum merespons",
    });
  }
  if (m.daily.completionRate !== null && m.daily.completionRate < TARGET.daily) {
    temuan.push({
      masalah: `Daily activity selesai ${fmtPct(m.daily.completionRate)} (target ≥ ${TARGET.daily}%)`,
      aksi: "Perbarui status daily log setiap akhir hari; review mingguan oleh leader",
    });
  }
  if (m.attendance.attendanceRate !== null && m.attendance.attendanceRate < TARGET.kehadiran) {
    temuan.push({
      masalah: `Tingkat kehadiran ${fmtPct(m.attendance.attendanceRate)} (target ≥ ${TARGET.kehadiran}%)`,
      aksi: "Evaluasi penyebab absen & atur pengganti tugas saat anggota tidak hadir",
    });
  }
  if (m.attendance.overtimeHours > 0) {
    temuan.push({
      masalah: `Lembur ${m.attendance.overtimeHours} jam`,
      aksi: "Pastikan lembur diajukan & disetujui sebelum dikerjakan; tinjau beban kerja",
    });
  }
  return temuan;
}

export async function exportRekapBulananPptx(rekap: YearIntegratedRekap, monthNum: string, gugus = "Design & Multimedia") {
  // "all" (semua bulan) → pakai bulan terakhir yang sudah berisi data
  if (monthNum === "all") {
    const aktif = rekap.months.filter((x) => x.active || x.permintaan.masuk > 0);
    monthNum = aktif[aktif.length - 1]?.monthNum ?? String(new Date().getMonth() + 1).padStart(2, "0");
  }
  const m = rekap.months.find((x) => x.monthNum === monthNum);
  if (!m) throw new Error("Data bulan tidak ditemukan");
  const periode = `${m.monthName} ${rekap.year}`;
  const p = m.permintaan;

  const deck = await buatDeck({
    judul: `Rekap Bulanan ${periode}`,
    subjudul: "Laporan kinerja terintegrasi: Permintaan Design, Daily Activity, Attendance & Safety Toolbox",
    gugus,
    periode,
    namaFile: `QCC_Rekap_Bulanan_${m.monthName}_${rekap.year}`,
  });

  slideAgenda(deck, [
    { fase: "PLAN", judul: "Target & Ringkasan Kinerja", ket: "Target KPI bulan ini dan capaiannya" },
    { fase: "DO", judul: "Pelaksanaan", ket: "Permintaan Design, Daily Activity, Attendance & Safety Toolbox" },
    { fase: "CHECK", judul: "Evaluasi Tren", ket: "Tren harian bulan ini dan perbandingan antar bulan" },
    { fase: "ACTION", judul: "Analisa & Tindak Lanjut", ket: "Masalah yang ditemukan dan rencana perbaikan" },
  ]);

  // ===== PLAN: target vs capaian =====
  {
    const { s, y } = deck.slide("Target & Ringkasan Kinerja", "PLAN", "Langkah 1");
    const y2 = kartuKpi(s, [
      { label: "Permintaan Masuk", nilai: String(p.masuk), ket: `${p.selesai} selesai`, warna: QCC.navy },
      { label: "Penyelesaian", nilai: fmtPct(p.resRate), ket: `Target ≥ ${TARGET.penyelesaian}%`, warna: QCC.blue },
      { label: "SLA Tepat Waktu", nilai: fmtPct(p.slaPct), ket: `${p.onTime} tiket on-time`, warna: QCC.green },
      { label: "Kehadiran", nilai: fmtPct(m.attendance.attendanceRate), ket: `Target ≥ ${TARGET.kehadiran}%`, warna: QCC.orange },
      { label: "Grade KPI", nilai: m.kpiGrade ?? "-", warna: warnaGrade(m.kpiGrade) },
    ], y);

    const capai = (v: number | null, t: number) => (v === null ? "-" : v >= t ? "Tercapai" : "Belum tercapai");
    tabelDiSlide(
      s,
      ["Indikator", "Target", "Capaian", "Keterangan"],
      [
        ["Ketepatan SLA permintaan design", `≥ ${TARGET.sla}%`, fmtPct(p.slaPct), capai(p.slaPct, TARGET.sla)],
        ["Penyelesaian permintaan design", `≥ ${TARGET.penyelesaian}%`, fmtPct(p.resRate), capai(p.resRate, TARGET.penyelesaian)],
        ["Penyelesaian daily activity", `≥ ${TARGET.daily}%`, fmtPct(m.daily.completionRate), capai(m.daily.completionRate, TARGET.daily)],
        ["Tingkat kehadiran", `≥ ${TARGET.kehadiran}%`, fmtPct(m.attendance.attendanceRate), capai(m.attendance.attendanceRate, TARGET.kehadiran)],
        ["Rata-rata durasi pengerjaan", "-", p.avgDurationHours !== null ? `${p.avgDurationHours.toFixed(1)} jam` : "-", "Informasi"],
      ],
      y2,
      {
        colW: [4.6, 1.8, 1.8, 4.13],
        align: ["left", "center", "center", "center"],
        warnaSel: (row, col) =>
          col === 3 && row[3] === "Tercapai" ? QCC.green : col === 3 && row[3] === "Belum tercapai" ? QCC.red : undefined,
      },
    );
  }

  // ===== DO: permintaan design =====
  {
    const { s, y } = deck.slide("Permintaan Design", "DO", "Langkah 2");
    const statuses = Object.entries(p.statuses || {}).filter(([, n]) => n > 0);
    if (statuses.length) {
      s.addChart(
        "pie",
        [{ name: "Status", labels: statuses.map(([k]) => LABEL_STATUS[k] ?? k), values: statuses.map(([, n]) => n) }],
        {
          x: X_KIRI, y, w: 5, h: 4.9, chartColors: statuses.map(([k]) => WARNA_STATUS[k] ?? QCC.gray),
          showTitle: true, title: "Status Tiket Bulan Ini", titleFontSize: 12,
          showLegend: true, legendPos: "b", legendFontSize: 10, showPercent: true, dataLabelColor: QCC.white,
        },
      );
    } else {
      s.addText("Belum ada tiket pada bulan ini.", { x: X_KIRI, y, w: 5, h: 0.5, fontSize: 13, italic: true, color: QCC.gray });
    }
    const pr = p.priorityBreakdown;
    tabelDiSlide(
      s,
      ["Metrik", "Nilai"],
      [
        ["Tiket masuk", p.masuk],
        ["Tiket selesai", p.selesai],
        ["Selesai tepat waktu", p.onTime],
        ["Eskalasi (Review/Revisi)", p.eskalasi],
        ["Rata-rata durasi", p.avgDurationHours !== null ? `${p.avgDurationHours.toFixed(1)} jam` : "-"],
        ...(pr
          ? (["p1", "p2", "p3", "p4"] as const).map((k) => [
              `SLA Prioritas ${k.toUpperCase()}`,
              `${fmtPct(pr[k].pct)} (${pr[k].done}/${pr[k].total})`,
            ])
          : []),
      ],
      y,
      { x: X_KIRI + 5.3, colW: [3.9, 3.13], align: ["left", "center"] },
    );
  }

  // ===== DO: daily activity, attendance & STB =====
  {
    const { s, y } = deck.slide("Daily Activity, Attendance & Safety Toolbox", "DO", "Langkah 3");
    const d = m.daily;
    s.addChart(
      "bar",
      [{
        name: "Aktivitas",
        labels: ["Done", "In Progress", "Review", "Revisi", "Pending", "Waiting"],
        values: [d.done, d.inProgress, d.review, d.revisi, d.pending, d.waiting],
      }],
      {
        x: X_KIRI, y, w: 6.2, h: 4.9, barDir: "bar", chartColors: [QCC.blue],
        showTitle: true, title: `Daily Activity (${d.total} aktivitas · ${fmtPct(d.completionRate)} selesai)`, titleFontSize: 12,
        showValue: true, dataLabelFontSize: 10, catAxisLabelFontSize: 10, valGridLine: { color: "E7E6E6", size: 0.5 },
      },
    );
    const a = m.attendance;
    const stb = m.safetyToolboxMeeting;
    tabelDiSlide(
      s,
      ["Attendance & K3", "Nilai"],
      [
        ["Hadir (PRS)", a.prs],
        ["Lembur (OVT)", `${a.ovt} hari · ${a.overtimeHours} jam`],
        ["Off", a.off],
        ["Absen (ABS)", a.abs],
        ["Tingkat kehadiran", fmtPct(a.attendanceRate)],
        ["Personil Safety Toolbox", stb.personil],
        ["Kehadiran STB (H / h)", `${stb.countH} / ${stb.countHSmall}`],
        ["Total standby STB", stb.totalStandby],
      ],
      y,
      { x: X_KIRI + 6.5, colW: [3.4, 2.43], align: ["left", "center"] },
    );
  }

  // ===== CHECK: tren harian =====
  const trend = m.dailyTrend ?? [];
  if (trend.length) {
    const { s, y } = deck.slide(`Tren Harian ${periode}`, "CHECK", "Langkah 4");
    const labels = trend.map((t) => t.label);
    s.addChart(
      "bar",
      [
        { name: "Tiket Masuk", labels, values: trend.map((t) => t.masuk) },
        { name: "Tiket Selesai", labels, values: trend.map((t) => t.selesai) },
      ],
      {
        x: X_KIRI, y, w: LEBAR_KONTEN, h: 2.9, barDir: "col", chartColors: [QCC.blue, QCC.green],
        showTitle: true, title: "Permintaan Design per Hari", titleFontSize: 12,
        showLegend: true, legendPos: "r", legendFontSize: 10, catAxisLabelFontSize: 8, valGridLine: { color: "E7E6E6", size: 0.5 },
      },
    );
    s.addChart(
      "line",
      [
        { name: "Daily selesai (%)", labels, values: trend.map((t) => t.dailyRate ?? 0) },
        { name: "Kehadiran (%)", labels, values: trend.map((t) => t.attRate ?? 0) },
      ],
      {
        x: X_KIRI, y: y + 3.0, w: LEBAR_KONTEN, h: 2.5, chartColors: [QCC.orange, QCC.navy], lineSize: 2, lineDataSymbolSize: 4,
        showTitle: true, title: "Daily Activity & Kehadiran per Hari", titleFontSize: 12, valAxisMaxVal: 100,
        showLegend: true, legendPos: "r", legendFontSize: 10, catAxisLabelFontSize: 8, valGridLine: { color: "E7E6E6", size: 0.5 },
      },
    );
  }

  // ===== CHECK: perbandingan bulanan =====
  {
    const sampai = rekap.months.filter((x) => Number(x.monthNum) <= Number(monthNum));
    const { s, y } = deck.slide(`Perbandingan Bulanan ${rekap.year}`, "CHECK", "Langkah 5");
    const labels = sampai.map((x) => x.monthName.slice(0, 3));
    s.addChart(
      "bar",
      [
        { name: "Masuk", labels, values: sampai.map((x) => x.permintaan.masuk) },
        { name: "Selesai", labels, values: sampai.map((x) => x.permintaan.selesai) },
      ],
      {
        x: X_KIRI, y, w: 6.2, h: 4.9, barDir: "col", chartColors: [QCC.blue, QCC.green],
        showTitle: true, title: "Permintaan Design per Bulan", titleFontSize: 12, showValue: true, dataLabelFontSize: 8,
        showLegend: true, legendPos: "b", legendFontSize: 10, valGridLine: { color: "E7E6E6", size: 0.5 },
      },
    );
    tabelDiSlide(
      s,
      ["Bulan", "SLA", "Daily", "Hadir", "Grade"],
      sampai.map((x) => [
        x.monthName,
        fmtPct(x.permintaan.slaPct, 0),
        fmtPct(x.daily.completionRate, 0),
        fmtPct(x.attendance.attendanceRate, 0),
        x.kpiGrade ?? "-",
      ]),
      y,
      {
        x: X_KIRI + 6.5,
        colW: [1.53, 1.0, 1.0, 1.0, 1.3],
        fontSize: 9,
        align: ["left", "center", "center", "center", "center"],
        warnaSel: (row, col) => (col === 4 && row[4] !== "-" ? warnaGrade(String(row[4])) : undefined),
      },
    );
  }

  // ===== ACTION =====
  const temuan = analisa(m);
  if (temuan.length) {
    slideTabel(
      deck,
      "Analisa Masalah & Rencana Tindak Lanjut",
      "ACTION",
      "Langkah 6",
      ["No", "Masalah / Temuan", "Usulan Tindak Lanjut", "PIC", "Target"],
      temuan.map((t, i) => [i + 1, t.masalah, t.aksi, " ", " "]),
      { colW: [0.5, 4.4, 5.0, 1.2, 1.23], barisPerSlide: 7, align: ["center", "left", "left", "center", "center"] },
      "Usulan dibuat otomatis dari indikator di bawah target. Lengkapi PIC & target sebelum dipresentasikan.",
    );
  } else {
    const { s, y } = deck.slide("Analisa & Tindak Lanjut", "ACTION", "Langkah 6");
    kotakCatatan(
      s,
      "Seluruh indikator mencapai target",
      [
        "Pertahankan standar kerja yang sudah berjalan (standarisasi).",
        "Dokumentasikan praktik baik bulan ini sebagai acuan bulan berikutnya.",
      ],
      X_KIRI, y, LEBAR_KONTEN, 2,
    );
  }

  slidePenutup(deck);
  return deck.simpan();
}
