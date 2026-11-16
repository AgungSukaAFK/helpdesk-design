import type { Workbook, Worksheet, Cell, Fill } from "exceljs";
import type { MonthIntegratedData, YearIntegratedRekap } from "@/lib/rekap-integrated";

/* ============================================================================
 * Export Excel Rekap Bulanan Terintegrasi (4 Modul)
 *
 * Semua sheet memakai gaya yang sama:
 *   - Judul + subjudul + info periode di atas
 *   - Baris grup kolom berwarna sesuai modul, header kolom navy
 *   - Baris zebra, border tipis, angka & persen bertipe numerik asli
 *   - AutoFilter + freeze panes di setiap tabel
 *   - Baris TOTAL memakai SUBTOTAL() sehingga ikut berubah saat difilter
 * ========================================================================== */

// ---------------------------------------------------------------- palette --
const C = {
  navy: "FF0B1325",
  headerBg: "FF1E293B",
  white: "FFFFFFFF",
  text: "FF0F172A",
  muted: "FF64748B",
  faint: "FF94A3B8",
  border: "FFE2E8F0",
  zebra: "FFF8FAFC",
  totalBg: "FFE2E8F0",
  weekend: "FFE11D48",

  permintaan: "FF206BC4",
  daily: "FF2FB344",
  attendance: "FFAE3EC9",
  stb: "FF6366F1",
  periode: "FF334155",
  kpi: "FFF59F00",

  p1: "FFE11D48",
  p2: "FFF97316",
  p3: "FF0EA5E9",
  p4: "FF64748B",
} as const;

const GRADE_STYLE: Record<string, { bg: string; fg: string }> = {
  "Sangat Baik": { bg: "FFD1FAE5", fg: "FF065F46" },
  Baik: { bg: "FFDBEAFE", fg: "FF1E40AF" },
  "Cukup Baik": { bg: "FFFEF3C7", fg: "FF92400E" },
  "Kurang Baik": { bg: "FFFFE4E6", fg: "FF9F1239" },
};

const FONT = "Calibri";

const FMT = {
  int: "#,##0",
  dec: "#,##0.0",
  pct: "0.0%",
  date: "dd mmm yyyy",
  text: "@",
} as const;

type ColType = "text" | "int" | "dec" | "pct" | "date" | "grade";

interface Col {
  key: string;
  header: string;
  width: number;
  type: ColType;
}

interface Group {
  label: string;
  span: number;
  color: string;
}

type Formula = { formula: string; result?: number | string };
type CellVal = string | number | Date | null | undefined | Formula;

interface Row {
  values: CellVal[];
  muted?: boolean;
  /** index kolom yang teksnya diberi warna khusus (mis. akhir pekan) */
  accent?: { col: number; color: string };
}

// ---------------------------------------------------------------- helpers --
const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const thin = { style: "thin" as const, color: { argb: C.border } };
const BORDER_ALL = { top: thin, left: thin, bottom: thin, right: thin };

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Persen dari API (0-100) → fraksi Excel (0-1). null tetap null. */
const pct = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10) / 1000;

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

const isFormula = (v: CellVal): v is Formula =>
  typeof v === "object" && v !== null && !(v instanceof Date) && "formula" in v;

function slaGradeFromPct(sla: number | null): string | null {
  if (sla === null) return null;
  if (sla >= 90) return "Sangat Baik";
  if (sla >= 80) return "Baik";
  if (sla >= 60) return "Cukup Baik";
  return "Kurang Baik";
}

function setValue(cell: Cell, v: CellVal) {
  if (v === "") {
    cell.value = null;
    return;
  }
  if (v === null || v === undefined) {
    cell.value = "-";
    return;
  }
  if (isFormula(v)) {
    cell.value = { formula: v.formula, result: v.result ?? undefined } as any;
    return;
  }
  cell.value = v as any;
}

function styleGrade(cell: Cell) {
  const g = typeof cell.value === "string" ? GRADE_STYLE[cell.value] : undefined;
  if (!g) return;
  cell.fill = solid(g.bg);
  cell.font = { ...(cell.font || {}), name: FONT, size: 10, bold: true, color: { argb: g.fg } };
}

function sheetHeader(ws: Worksheet, title: string, subtitle: string, info: string, span: number) {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 15, bold: true, color: { argb: C.white } };
  t.fill = solid(C.navy);
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, span);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: FONT, size: 10, color: { argb: C.muted } };
  s.alignment = { vertical: "middle", indent: 1, wrapText: true };
  ws.getRow(2).height = 18;

  ws.mergeCells(3, 1, 3, span);
  const i = ws.getCell(3, 1);
  i.value = info;
  i.font = { name: FONT, size: 9, italic: true, color: { argb: C.faint } };
  i.alignment = { vertical: "middle", indent: 1 };
}

/**
 * Tulis satu tabel bergaya standar. Mengembalikan posisi baris agar
 * pemanggil bisa membuat rumus total.
 */
function writeTable(
  ws: Worksheet,
  opts: {
    startRow: number;
    groups?: Group[];
    columns: Col[];
    rows: Row[];
    total?: (ref: (key: string) => string, first: number, last: number) => CellVal[];
    totalLabel?: string;
    freeze?: boolean;
    filter?: boolean;
    freezeCols?: number;
  }
) {
  const { columns } = opts;
  let r = opts.startRow;

  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (!col.width || col.width < c.width) col.width = c.width;
  });

  // Baris grup
  if (opts.groups && opts.groups.length) {
    let c = 1;
    for (const g of opts.groups) {
      if (g.span > 1) ws.mergeCells(r, c, r, c + g.span - 1);
      const cell = ws.getCell(r, c);
      cell.value = g.label;
      for (let k = c; k < c + g.span; k++) {
        const gc = ws.getCell(r, k);
        gc.fill = solid(g.color);
        gc.border = { ...BORDER_ALL, left: { style: "thin", color: { argb: C.white } }, right: { style: "thin", color: { argb: C.white } } };
      }
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      c += g.span;
    }
    ws.getRow(r).height = 20;
    r++;
  }

  // Header kolom
  const headerRow = r;
  columns.forEach((c, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
    cell.fill = solid(C.headerBg);
    cell.alignment = {
      horizontal: c.type === "text" || c.type === "date" ? "left" : "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = BORDER_ALL;
  });
  ws.getRow(r).height = 32;
  r++;

  // Data
  const firstDataRow = r;
  opts.rows.forEach((row, idx) => {
    const zebra = idx % 2 === 1;
    columns.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1);
      setValue(cell, row.values[i]);
      const isDash = cell.value === "-";
      cell.font = {
        name: FONT,
        size: 10,
        bold: i === 0,
        color: { argb: row.muted || isDash ? C.faint : C.text },
      };
      if (row.accent && row.accent.col === i && !row.muted) {
        cell.font = { ...cell.font, color: { argb: row.accent.color }, bold: true };
      }
      if (zebra) cell.fill = solid(C.zebra);
      cell.border = BORDER_ALL;
      cell.alignment = {
        horizontal: c.type === "text" || c.type === "date" ? "left" : "center",
        vertical: "middle",
        indent: c.type === "text" || c.type === "date" ? 1 : 0,
      };
      if (!isDash) {
        if (c.type === "int") cell.numFmt = FMT.int;
        else if (c.type === "dec") cell.numFmt = FMT.dec;
        else if (c.type === "pct") cell.numFmt = FMT.pct;
        else if (c.type === "date") cell.numFmt = FMT.date;
      }
      if (c.type === "grade" && !row.muted) styleGrade(cell);
    });
    ws.getRow(r).height = 18;
    r++;
  });
  const lastDataRow = Math.max(firstDataRow, r - 1);

  // Total
  let totalRow: number | null = null;
  if (opts.total) {
    totalRow = r;
    const ref = (key: string) => {
      const idx = columns.findIndex((c) => c.key === key);
      if (idx < 0) throw new Error(`Kolom ${key} tidak ditemukan`);
      return colLetter(idx + 1);
    };
    const vals = opts.total(ref, firstDataRow, lastDataRow);
    columns.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1);
      const v = i === 0 ? opts.totalLabel ?? "TOTAL" : vals[i];
      setValue(cell, v);
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.text } };
      cell.fill = solid(C.totalBg);
      cell.border = { ...BORDER_ALL, top: { style: "medium", color: { argb: C.headerBg } } };
      cell.alignment = {
        horizontal: c.type === "text" || c.type === "date" ? "left" : "center",
        vertical: "middle",
        indent: c.type === "text" || c.type === "date" ? 1 : 0,
      };
      if (cell.value !== "-") {
        if (c.type === "int") cell.numFmt = FMT.int;
        else if (c.type === "dec") cell.numFmt = FMT.dec;
        else if (c.type === "pct") cell.numFmt = FMT.pct;
      }
      if (c.type === "grade") styleGrade(cell);
    });
    ws.getRow(r).height = 20;
    r++;
  }

  if (opts.filter !== false && opts.rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: lastDataRow, column: columns.length },
    };
  }
  if (opts.freeze !== false) {
    ws.views = [{ state: "frozen", xSplit: opts.freezeCols ?? 1, ySplit: headerRow, showGridLines: false }];
  }

  return { headerRow, firstDataRow, lastDataRow, totalRow, nextRow: r };
}

// Rumus SUBTOTAL yang ikut menyesuaikan filter
const sum = (col: string, a: number, b: number, result?: number): Formula => ({
  formula: `SUBTOTAL(109,${col}${a}:${col}${b})`,
  result,
});
const avg = (col: string, a: number, b: number, result?: number | null): Formula => ({
  formula: `IFERROR(SUBTOTAL(101,${col}${a}:${col}${b}),"-")`,
  result: result ?? "-",
});
const max = (col: string, a: number, b: number, result?: number): Formula => ({
  formula: `SUBTOTAL(104,${col}${a}:${col}${b})`,
  result,
});
/** rasio SUBTOTAL(num) / SUBTOTAL(den), num & den bisa berupa beberapa kolom */
const rate = (num: string[], den: string[], a: number, b: number, result: number | null): Formula => {
  const s = (cols: string[]) => cols.map((c) => `SUBTOTAL(109,${c}${a}:${c}${b})`).join("+");
  return { formula: `IFERROR((${s(num)})/(${s(den)}),"-")`, result: result ?? "-" };
};

const statusLabel = (m: MonthIntegratedData) => (m.active ? "Ada Data" : "Belum Ada Data");

const STATUS_ORDER = ["TO DO", "IN PROGRESS", "REVIEW", "REVISION", "PENDING", "DONE"];

function permintaanStatusKeys(data: YearIntegratedRekap): string[] {
  const set = new Set<string>();
  data.months.forEach((m) => Object.keys(m.permintaan.statuses || {}).forEach((k) => set.add(k)));
  return Array.from(set).sort((a, b) => {
    const ia = STATUS_ORDER.indexOf(a);
    const ib = STATUS_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// ====================================================================== API --

export interface ExportRekapOptions {
  /** Bulan yang sedang dipilih di halaman ("01".."12") */
  selectedMonth: string;
}

export async function exportIntegratedExcel(
  data: YearIntegratedRekap,
  { selectedMonth }: ExportRekapOptions
): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Helpdesk Design";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const year = data.year;
  const exportedAt = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const focusMonth = data.months.find((m) => m.monthNum === selectedMonth) ?? data.months[0];
  const focusLabel = `${focusMonth.monthName} ${year}`;
  const info = `Tahun ${year}  •  Diekspor ${exportedAt}  •  Gunakan tombol filter (▼) di header tabel untuk menyaring data`;

  buildRingkasan(wb, data, focusMonth, focusLabel, exportedAt);
  buildRekap12(wb, data, info);
  buildPermintaan(wb, data, info);
  buildDaily(wb, data, info);
  buildAttendance(wb, data, info);
  buildStb(wb, data, info);
  buildTrendHarian(wb, data, info);
  buildAcuan(wb, year);

  // tab colors
  const tabColors = [C.navy, C.periode, C.permintaan, C.daily, C.attendance, C.stb, C.kpi, C.muted];
  wb.worksheets.forEach((ws, i) => {
    ws.properties.tabColor = { argb: tabColors[i] ?? C.muted };
    ws.pageSetup = {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = `Rekap-Bulanan-Terintegrasi-${year}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

// ============================================================ 1. Ringkasan --

function buildRingkasan(
  wb: Workbook,
  data: YearIntegratedRekap,
  m: MonthIntegratedData,
  focusLabel: string,
  exportedAt: string
) {
  const ws = wb.addWorksheet("Ringkasan");
  const T = data.totals;
  const year = data.year;
  const span = 4;

  sheetHeader(
    ws,
    `Laporan Rekap Bulanan Terintegrasi ${year}`,
    "Departemen Design — Permintaan Design · Daily Activity · Attendance · Safety Toolbox Meeting HSE",
    `Diekspor ${exportedAt}  •  Kolom "${focusLabel}" mengikuti bulan yang dipilih di halaman`,
    span
  );

  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 58;

  // Header tabel
  let r = 5;
  const heads = ["Indikator", `YTD ${year}`, focusLabel, "Keterangan"];
  heads.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
    cell.fill = solid(C.headerBg);
    cell.alignment = { horizontal: i === 0 || i === 3 ? "left" : "center", vertical: "middle", indent: i === 0 || i === 3 ? 1 : 0 };
    cell.border = BORDER_ALL;
  });
  ws.getRow(r).height = 22;
  ws.views = [{ state: "frozen", ySplit: r, showGridLines: false }];
  r++;

  const section = (label: string, color: string) => {
    ws.mergeCells(r, 1, r, span);
    const cell = ws.getCell(r, 1);
    cell.value = label;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
    cell.fill = solid(color);
    cell.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(r).height = 20;
    r++;
  };

  let zebra = false;
  const line = (label: string, ytd: CellVal, month: CellVal, note: string, type: ColType) => {
    const vals: CellVal[] = [label, ytd, month, note];
    vals.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      setValue(cell, v);
      const isDash = cell.value === "-";
      cell.font = { name: FONT, size: 10, bold: i === 0, color: { argb: i === 3 || isDash ? C.muted : C.text } };
      cell.border = BORDER_ALL;
      if (zebra) cell.fill = solid(C.zebra);
      cell.alignment = {
        horizontal: i === 0 || i === 3 ? "left" : "center",
        vertical: "middle",
        indent: i === 0 || i === 3 ? 1 : 0,
        wrapText: i === 3,
      };
      if ((i === 1 || i === 2) && !isDash) {
        if (type === "int") cell.numFmt = FMT.int;
        else if (type === "dec") cell.numFmt = `${FMT.dec} "Jam"`;
        else if (type === "pct") cell.numFmt = FMT.pct;
        else if (type === "grade") styleGrade(cell);
      }
    });
    ws.getRow(r).height = 18;
    zebra = !zebra;
    r++;
  };

  // Nilai bulan fokus — logika sama dengan kartu di halaman
  const mp = m.permintaan;
  const escPctMonth = mp.masuk > 0 ? Math.round((mp.eskalasi / mp.masuk) * 1000) / 10 : 0;
  const pbM = mp.priorityBreakdown;
  const pbY = T.priorityOverall;
  const stbOtherYtd = data.months.reduce((a, x) => a + x.safetyToolboxMeeting.countOther, 0);

  section("1. PERMINTAAN DESIGN", C.permintaan);
  line("Total Tiket Masuk", T.permintaanMasuk, mp.masuk, "Tiket permintaan design yang masuk", "int");
  line("Total Tiket Selesai (Done)", T.permintaanSelesai, mp.selesai, "Tiket berstatus DONE", "int");
  line("Resolution Rate", pct(T.permintaanResRate), pct(mp.resRate), "Tiket selesai ÷ tiket masuk", "pct");
  line(
    "SLA Achievement",
    pct(T.slaAchievementYtd ?? T.permintaanSlaPct),
    pct(mp.selesai > 0 ? mp.slaPct : null),
    "Tiket selesai yang memenuhi target waktu penyelesaian tanpa revisi",
    "pct"
  );
  line(
    "Grade SLA",
    T.slaGradeYtd || T.overallKpiGrade,
    mp.selesai > 0 ? slaGradeFromPct(mp.slaPct ?? 0) : null,
    "<60% Kurang Baik • 60–79% Cukup Baik • 80–89% Baik • ≥90% Sangat Baik",
    "grade"
  );
  line(
    "Tiket Eligible SLA",
    T.eligibleTickets ?? T.permintaanSelesai,
    mp.selesai,
    `${T.vendorExcluded ?? 0} tiket dikecualikan karena eskalasi vendor (YTD)`,
    "int"
  );
  line("Rata-rata Durasi Pengerjaan", T.permintaanAvgHours, mp.avgDurationHours, "Rata-rata waktu pengerjaan tiket selesai", "dec");
  line("Jumlah Eskalasi", T.escalationCount ?? T.permintaanEskalasi, mp.eskalasi, "Tiket berstatus Review/Revisi", "int");
  line("Persentase Eskalasi", pct(T.escalationPct ?? 0), pct(escPctMonth), "Eskalasi ÷ tiket masuk", "pct");

  section("   SLA PER PRIORITAS (tercapai / total tiket)", C.periode);
  const pLabels: [keyof NonNullable<typeof pbY>, string][] = [
    ["p1", "P1 - Kritis (Urgent)"],
    ["p2", "P2 - Tinggi (Prioritas)"],
    ["p3", "P3 - Sedang (Normal)"],
    ["p4", "P4 - Rendah (Normal)"],
  ];
  for (const [k, label] of pLabels) {
    const y = pbY?.[k];
    const mo = pbM?.[k];
    line(
      `${label} — SLA %`,
      pct(y && y.total > 0 ? y.pct : null),
      pct(mo && mo.total > 0 ? mo.pct : null),
      `YTD: ${y?.done ?? 0} dari ${y?.total ?? 0} tiket  •  ${m.monthName}: ${mo?.done ?? 0} dari ${mo?.total ?? 0} tiket`,
      "pct"
    );
  }

  const statusKeys = permintaanStatusKeys(data);
  if (statusKeys.length) {
    section("   STATUS TIKET", C.periode);
    for (const s of statusKeys) {
      line(`Status ${s}`, T.permintaanStatuses?.[s] ?? 0, mp.statuses?.[s] ?? 0, "Jumlah tiket per status", "int");
    }
  }

  section("2. DAILY ACTIVITY", C.daily);
  const md = m.daily;
  line("Total Aktivitas", T.dailyTotal, md.total, "Catatan tugas & job list harian", "int");
  line("Done", T.dailyDone, md.done, "Aktivitas selesai", "int");
  line("In Progress", T.dailyInProgress, md.inProgress, "Sedang dikerjakan", "int");
  line("Revisi", T.dailyRevisi, md.revisi, "Perlu revisi", "int");
  line("Review", T.dailyReview, md.review, "Menunggu review", "int");
  line("Pending", T.dailyPending, md.pending, "Ditunda", "int");
  line("Waiting", T.dailyWaiting, md.waiting, "Menunggu pihak lain", "int");
  line("Tingkat Penyelesaian", pct(T.dailyRate), pct(md.total > 0 ? md.completionRate : null), "Done ÷ total aktivitas", "pct");

  section("3. ATTENDANCE (KEHADIRAN)", C.attendance);
  const ma = m.attendance;
  line("Hadir (PRS)", T.attendancePrs, ma.prs, "Hari hadir kerja normal", "int");
  line("Lembur (OVT)", T.attendanceOvt, ma.ovt, "Hari penugasan lembur", "int");
  line("Libur (OFF)", T.attendanceOff, ma.off, "Hari libur", "int");
  line("Absen (ABS)", T.attendanceAbs, ma.abs, "Tidak hadir", "int");
  line(
    "Total Jam Lembur",
    Math.round((T.attendanceTotalMinutes / 60) * 10) / 10,
    ma.overtimeHours,
    `YTD ${T.attendanceTotalMinutes.toLocaleString("id-ID")} menit`,
    "dec"
  );
  line("Tingkat Kehadiran", pct(T.attendanceRate), pct(ma.attendanceRate), "PRS ÷ (PRS + ABS)", "pct");

  section("4. SAFETY TOOLBOX MEETING HSE", C.stb);
  const ms = m.safetyToolboxMeeting;
  line("Personil Terdaftar", T.safetyToolboxMeetingPersonil, ms.personil, "YTD = jumlah personil terbanyak dalam satu bulan", "int");
  line("Shift Siang (H)", T.safetyToolboxMeetingCountH, ms.countH, "Standby 08:00 – 17:00", "int");
  line("Shift Malam (h)", T.safetyToolboxMeetingCountHSmall, ms.countHSmall, "Standby 17:00 – 08:00", "int");
  line("Lainnya", stbOtherYtd, ms.countOther, "Kode jadwal selain H / h", "int");
  line("Total Sesi Standby", T.safetyToolboxMeetingTotalStandby, ms.totalStandby, "Total sesi Safety Toolbox Meeting", "int");

  section("KPI KESELURUHAN", C.kpi);
  line(
    "KPI Grade",
    T.overallKpiGrade,
    m.kpiGrade,
    "Bobot: SLA Permintaan 40% • Daily Activity 35% • Attendance 25%",
    "grade"
  );

  // Daftar isi sheet
  r += 1;
  ws.mergeCells(r, 1, r, span);
  const idxTitle = ws.getCell(r, 1);
  idxTitle.value = "Isi Workbook";
  idxTitle.font = { name: FONT, size: 11, bold: true, color: { argb: C.text } };
  r++;
  const sheets: [string, string][] = [
    ["Rekap 12 Bulan", "Ringkasan seluruh modul per bulan (Jan – Des) + total"],
    ["Permintaan Design", "Detail tiket per bulan: SLA, durasi, eskalasi, prioritas P1–P4, status"],
    ["Daily Activity", "Detail status aktivitas harian per bulan"],
    ["Attendance", "Detail kehadiran & lembur per bulan"],
    ["Safety Toolbox HSE", "Detail roster standby Safety Toolbox Meeting per bulan"],
    ["Trend Harian", "Data per tanggal seluruh modul — filter kolom Bulan untuk melihat satu bulan"],
    ["Acuan SLA", "Acuan target SLA per prioritas & kriteria KPI Grade"],
  ];
  for (const [name, desc] of sheets) {
    const a = ws.getCell(r, 1);
    a.value = { text: name, hyperlink: `#'${name}'!A1` } as any;
    a.font = { name: FONT, size: 10, color: { argb: C.permintaan }, underline: true };
    a.alignment = { indent: 1 };
    ws.mergeCells(r, 2, r, span);
    const d = ws.getCell(r, 2);
    d.value = desc;
    d.font = { name: FONT, size: 10, color: { argb: C.muted } };
    r++;
  }
}

// ======================================================== 2. Rekap 12 Bulan --

function buildRekap12(wb: Workbook, data: YearIntegratedRekap, info: string) {
  const ws = wb.addWorksheet("Rekap 12 Bulan");
  const T = data.totals;
  const columns: Col[] = [
    { key: "bulan", header: "Bulan", width: 14, type: "text" },
    { key: "status", header: "Status Data", width: 15, type: "text" },
    { key: "pMasuk", header: "Tiket Masuk", width: 11, type: "int" },
    { key: "pSelesai", header: "Tiket Selesai", width: 11, type: "int" },
    { key: "pOnTime", header: "Tepat SLA", width: 11, type: "int" },
    { key: "pRes", header: "Resolution Rate", width: 12, type: "pct" },
    { key: "pSla", header: "SLA %", width: 10, type: "pct" },
    { key: "dTotal", header: "Total Aktivitas", width: 11, type: "int" },
    { key: "dDone", header: "Done", width: 10, type: "int" },
    { key: "dRate", header: "Penyelesaian", width: 12, type: "pct" },
    { key: "aPrs", header: "Hadir (PRS)", width: 10, type: "int" },
    { key: "aAbs", header: "Absen (ABS)", width: 10, type: "int" },
    { key: "aOvt", header: "Lembur (OVT)", width: 10, type: "int" },
    { key: "aJam", header: "Lembur (Jam)", width: 10, type: "dec" },
    { key: "aRate", header: "Tingkat Hadir", width: 11, type: "pct" },
    { key: "sH", header: "Siang (H)", width: 10, type: "int" },
    { key: "sh", header: "Malam (h)", width: 10, type: "int" },
    { key: "sTotal", header: "Total Sesi", width: 10, type: "int" },
    { key: "kpi", header: "KPI Grade", width: 14, type: "grade" },
  ];
  sheetHeader(
    ws,
    `Rekap 12 Bulan Terintegrasi ${data.year}`,
    "Ringkasan seluruh modul per bulan. Baris TOTAL otomatis menyesuaikan baris yang terfilter.",
    info,
    columns.length
  );

  const rows: Row[] = data.months.map((m) => ({
    muted: !m.active,
    values: [
      m.monthName,
      statusLabel(m),
      m.permintaan.masuk,
      m.permintaan.selesai,
      m.permintaan.onTime ?? 0,
      pct(m.permintaan.resRate),
      pct(m.permintaan.slaPct),
      m.daily.total,
      m.daily.done,
      pct(m.daily.completionRate),
      m.attendance.prs,
      m.attendance.abs,
      m.attendance.ovt,
      m.attendance.overtimeHours,
      pct(m.attendance.attendanceRate),
      m.safetyToolboxMeeting.countH,
      m.safetyToolboxMeeting.countHSmall,
      m.safetyToolboxMeeting.totalStandby,
      m.kpiGrade,
    ],
  }));

  writeTable(ws, {
    startRow: 5,
    groups: [
      { label: "Periode", span: 2, color: C.periode },
      { label: "1. Permintaan Design", span: 5, color: C.permintaan },
      { label: "2. Daily Activity", span: 3, color: C.daily },
      { label: "3. Attendance", span: 5, color: C.attendance },
      { label: "4. Safety Toolbox HSE", span: 3, color: C.stb },
      { label: "KPI", span: 1, color: C.kpi },
    ],
    columns,
    rows,
    totalLabel: "TOTAL (YTD)",
    total: (c, a, b) => [
      null,
      "",
      sum(c("pMasuk"), a, b, T.permintaanMasuk),
      sum(c("pSelesai"), a, b, T.permintaanSelesai),
      sum(c("pOnTime"), a, b),
      rate([c("pSelesai")], [c("pMasuk")], a, b, pct(T.permintaanResRate)),
      rate([c("pOnTime")], [c("pSelesai")], a, b, pct(T.permintaanSlaPct)),
      sum(c("dTotal"), a, b, T.dailyTotal),
      sum(c("dDone"), a, b, T.dailyDone),
      rate([c("dDone")], [c("dTotal")], a, b, pct(T.dailyRate)),
      sum(c("aPrs"), a, b, T.attendancePrs),
      sum(c("aAbs"), a, b, T.attendanceAbs),
      sum(c("aOvt"), a, b, T.attendanceOvt),
      sum(c("aJam"), a, b),
      rate([c("aPrs")], [c("aPrs"), c("aAbs")], a, b, pct(T.attendanceRate)),
      sum(c("sH"), a, b, T.safetyToolboxMeetingCountH),
      sum(c("sh"), a, b, T.safetyToolboxMeetingCountHSmall),
      sum(c("sTotal"), a, b, T.safetyToolboxMeetingTotalStandby),
      T.overallKpiGrade,
    ],
  });
}

// ===================================================== 3. Permintaan Design --

function buildPermintaan(wb: Workbook, data: YearIntegratedRekap, info: string) {
  const ws = wb.addWorksheet("Permintaan Design");
  const T = data.totals;
  const statusKeys = permintaanStatusKeys(data);

  const prioCols = (p: string, label: string): Col[] => [
    { key: `${p}d`, header: `${label} Tercapai`, width: 10, type: "int" },
    { key: `${p}t`, header: `${label} Total`, width: 9, type: "int" },
    { key: `${p}p`, header: `${label} SLA %`, width: 9, type: "pct" },
  ];

  const columns: Col[] = [
    { key: "bulan", header: "Bulan", width: 14, type: "text" },
    { key: "status", header: "Status Data", width: 15, type: "text" },
    { key: "masuk", header: "Tiket Masuk", width: 10, type: "int" },
    { key: "selesai", header: "Tiket Selesai", width: 10, type: "int" },
    { key: "onTime", header: "Tepat SLA", width: 10, type: "int" },
    { key: "res", header: "Resolution Rate", width: 12, type: "pct" },
    { key: "sla", header: "SLA %", width: 9, type: "pct" },
    { key: "slaGrade", header: "Grade SLA", width: 13, type: "grade" },
    { key: "dur", header: "Rata-rata Durasi (Jam)", width: 12, type: "dec" },
    { key: "esk", header: "Eskalasi (Tiket)", width: 10, type: "int" },
    { key: "eskPct", header: "Eskalasi %", width: 10, type: "pct" },
    ...prioCols("p1", "P1"),
    ...prioCols("p2", "P2"),
    ...prioCols("p3", "P3"),
    ...prioCols("p4", "P4"),
    ...statusKeys.map<Col>((s, i) => ({ key: `st${i}`, header: s, width: 11, type: "int" })),
    { key: "kpi", header: "KPI Grade", width: 14, type: "grade" },
  ];

  sheetHeader(
    ws,
    `Detail Permintaan Design ${data.year}`,
    "SLA dinilai dari waktu penyelesaian. Tiket yang pernah revisi = gagal SLA; tiket eskalasi vendor dikecualikan. Lihat sheet 'Acuan SLA'.",
    info,
    columns.length
  );

  const rows: Row[] = data.months.map((m) => {
    const p = m.permintaan;
    const pb = p.priorityBreakdown;
    const prio = (k: "p1" | "p2" | "p3" | "p4") => {
      const x = pb?.[k];
      return [x?.done ?? 0, x?.total ?? 0, pct(x && x.total > 0 ? x.pct : null)];
    };
    return {
      muted: !m.active,
      values: [
        m.monthName,
        statusLabel(m),
        p.masuk,
        p.selesai,
        p.onTime ?? 0,
        pct(p.resRate),
        pct(p.slaPct),
        p.selesai > 0 ? slaGradeFromPct(p.slaPct) : null,
        p.avgDurationHours,
        p.eskalasi,
        ratio(p.eskalasi, p.masuk),
        ...prio("p1"),
        ...prio("p2"),
        ...prio("p3"),
        ...prio("p4"),
        ...statusKeys.map((s) => p.statuses?.[s] ?? 0),
        m.kpiGrade,
      ],
    };
  });

  const pbY = T.priorityOverall;
  writeTable(ws, {
    startRow: 5,
    groups: [
      { label: "Periode", span: 2, color: C.periode },
      { label: "Volume & SLA", span: 6, color: C.permintaan },
      { label: "Durasi & Eskalasi", span: 3, color: C.periode },
      { label: "P1 - Kritis", span: 3, color: C.p1 },
      { label: "P2 - Tinggi", span: 3, color: C.p2 },
      { label: "P3 - Sedang", span: 3, color: C.p3 },
      { label: "P4 - Rendah", span: 3, color: C.p4 },
      ...(statusKeys.length ? [{ label: "Status Tiket", span: statusKeys.length, color: C.permintaan }] : []),
      { label: "KPI", span: 1, color: C.kpi },
    ],
    columns,
    rows,
    freezeCols: 2,
    totalLabel: "TOTAL (YTD)",
    total: (c, a, b) => {
      const prio = (k: "p1" | "p2" | "p3" | "p4") => [
        sum(c(`${k}d`), a, b, pbY?.[k].done),
        sum(c(`${k}t`), a, b, pbY?.[k].total),
        rate([c(`${k}d`)], [c(`${k}t`)], a, b, pct(pbY && pbY[k].total > 0 ? pbY[k].pct : null)),
      ];
      return [
        null,
        "",
        sum(c("masuk"), a, b, T.permintaanMasuk),
        sum(c("selesai"), a, b, T.permintaanSelesai),
        sum(c("onTime"), a, b),
        rate([c("selesai")], [c("masuk")], a, b, pct(T.permintaanResRate)),
        rate([c("onTime")], [c("selesai")], a, b, pct(T.permintaanSlaPct)),
        T.slaGradeYtd ?? null,
        avg(c("dur"), a, b, T.permintaanAvgHours),
        sum(c("esk"), a, b, T.permintaanEskalasi),
        rate([c("esk")], [c("masuk")], a, b, pct(T.escalationPct ?? null)),
        ...prio("p1"),
        ...prio("p2"),
        ...prio("p3"),
        ...prio("p4"),
        ...statusKeys.map((s, i) => sum(c(`st${i}`), a, b, T.permintaanStatuses?.[s] ?? 0)),
        T.overallKpiGrade,
      ];
    },
  });
}

// ======================================================== 4. Daily Activity --

function buildDaily(wb: Workbook, data: YearIntegratedRekap, info: string) {
  const ws = wb.addWorksheet("Daily Activity");
  const T = data.totals;
  const columns: Col[] = [
    { key: "bulan", header: "Bulan", width: 14, type: "text" },
    { key: "status", header: "Status Data", width: 15, type: "text" },
    { key: "total", header: "Total Aktivitas", width: 12, type: "int" },
    { key: "done", header: "Done", width: 10, type: "int" },
    { key: "ip", header: "In Progress", width: 11, type: "int" },
    { key: "rev", header: "Revisi", width: 10, type: "int" },
    { key: "review", header: "Review", width: 10, type: "int" },
    { key: "pend", header: "Pending", width: 10, type: "int" },
    { key: "wait", header: "Waiting", width: 10, type: "int" },
    { key: "rate", header: "Tingkat Penyelesaian", width: 13, type: "pct" },
  ];
  sheetHeader(ws, `Detail Daily Activity ${data.year}`, "Status aktivitas & job list harian tim per bulan.", info, columns.length);

  writeTable(ws, {
    startRow: 5,
    groups: [
      { label: "Periode", span: 2, color: C.periode },
      { label: "Status Aktivitas", span: 7, color: C.daily },
      { label: "Kinerja", span: 1, color: C.kpi },
    ],
    columns,
    rows: data.months.map((m) => ({
      muted: !m.active,
      values: [
        m.monthName,
        statusLabel(m),
        m.daily.total,
        m.daily.done,
        m.daily.inProgress,
        m.daily.revisi,
        m.daily.review,
        m.daily.pending,
        m.daily.waiting,
        pct(m.daily.completionRate),
      ],
    })),
    totalLabel: "TOTAL (YTD)",
    total: (c, a, b) => [
      null,
      "",
      sum(c("total"), a, b, T.dailyTotal),
      sum(c("done"), a, b, T.dailyDone),
      sum(c("ip"), a, b, T.dailyInProgress),
      sum(c("rev"), a, b, T.dailyRevisi),
      sum(c("review"), a, b, T.dailyReview),
      sum(c("pend"), a, b, T.dailyPending),
      sum(c("wait"), a, b, T.dailyWaiting),
      rate([c("done")], [c("total")], a, b, pct(T.dailyRate)),
    ],
  });
}

// ============================================================ 5. Attendance --

function buildAttendance(wb: Workbook, data: YearIntegratedRekap, info: string) {
  const ws = wb.addWorksheet("Attendance");
  const T = data.totals;
  const columns: Col[] = [
    { key: "bulan", header: "Bulan", width: 14, type: "text" },
    { key: "status", header: "Status Data", width: 15, type: "text" },
    { key: "rec", header: "Total Record", width: 11, type: "int" },
    { key: "prs", header: "Hadir (PRS)", width: 11, type: "int" },
    { key: "ovt", header: "Lembur (OVT)", width: 11, type: "int" },
    { key: "off", header: "Libur (OFF)", width: 11, type: "int" },
    { key: "abs", header: "Absen (ABS)", width: 11, type: "int" },
    { key: "min", header: "Lembur (Menit)", width: 12, type: "int" },
    { key: "jam", header: "Lembur (Jam)", width: 11, type: "dec" },
    { key: "rate", header: "Tingkat Kehadiran", width: 13, type: "pct" },
  ];
  sheetHeader(ws, `Detail Attendance ${data.year}`, "Tingkat kehadiran = PRS ÷ (PRS + ABS).", info, columns.length);

  writeTable(ws, {
    startRow: 5,
    groups: [
      { label: "Periode", span: 2, color: C.periode },
      { label: "Status Kehadiran", span: 5, color: C.attendance },
      { label: "Lembur", span: 2, color: C.periode },
      { label: "Kinerja", span: 1, color: C.kpi },
    ],
    columns,
    rows: data.months.map((m) => ({
      muted: !m.active,
      values: [
        m.monthName,
        statusLabel(m),
        m.attendance.totalRecords,
        m.attendance.prs,
        m.attendance.ovt,
        m.attendance.off,
        m.attendance.abs,
        m.attendance.overtimeMinutes,
        m.attendance.overtimeHours,
        pct(m.attendance.attendanceRate),
      ],
    })),
    totalLabel: "TOTAL (YTD)",
    total: (c, a, b) => [
      null,
      "",
      sum(c("rec"), a, b),
      sum(c("prs"), a, b, T.attendancePrs),
      sum(c("ovt"), a, b, T.attendanceOvt),
      sum(c("off"), a, b, T.attendanceOff),
      sum(c("abs"), a, b, T.attendanceAbs),
      sum(c("min"), a, b, T.attendanceTotalMinutes),
      { formula: `SUBTOTAL(109,${c("min")}${a}:${c("min")}${b})/60`, result: T.attendanceTotalMinutes / 60 },
      rate([c("prs")], [c("prs"), c("abs")], a, b, pct(T.attendanceRate)),
    ],
  });
}

// ==================================================== 6. Safety Toolbox HSE --

function buildStb(wb: Workbook, data: YearIntegratedRekap, info: string) {
  const ws = wb.addWorksheet("Safety Toolbox HSE");
  const T = data.totals;
  const columns: Col[] = [
    { key: "bulan", header: "Bulan", width: 14, type: "text" },
    { key: "status", header: "Status Data", width: 15, type: "text" },
    { key: "pers", header: "Personil Terdaftar", width: 12, type: "int" },
    { key: "h", header: "Shift Siang (H)", width: 12, type: "int" },
    { key: "hs", header: "Shift Malam (h)", width: 12, type: "int" },
    { key: "oth", header: "Lainnya", width: 10, type: "int" },
    { key: "tot", header: "Total Sesi Standby", width: 13, type: "int" },
  ];
  sheetHeader(
    ws,
    `Detail Safety Toolbox Meeting HSE ${data.year}`,
    "Roster standby: H = siang (08:00–17:00), h = malam (17:00–08:00). Personil total = jumlah terbanyak dalam satu bulan.",
    info,
    columns.length
  );
  writeTable(ws, {
    startRow: 5,
    groups: [
      { label: "Periode", span: 2, color: C.periode },
      { label: "Roster Standby", span: 5, color: C.stb },
    ],
    columns,
    rows: data.months.map((m) => ({
      muted: !m.active,
      values: [
        m.monthName,
        statusLabel(m),
        m.safetyToolboxMeeting.personil,
        m.safetyToolboxMeeting.countH,
        m.safetyToolboxMeeting.countHSmall,
        m.safetyToolboxMeeting.countOther,
        m.safetyToolboxMeeting.totalStandby,
      ],
    })),
    totalLabel: "TOTAL (YTD)",
    total: (c, a, b) => [
      null,
      "",
      max(c("pers"), a, b, T.safetyToolboxMeetingPersonil),
      sum(c("h"), a, b, T.safetyToolboxMeetingCountH),
      sum(c("hs"), a, b, T.safetyToolboxMeetingCountHSmall),
      sum(c("oth"), a, b),
      sum(c("tot"), a, b, T.safetyToolboxMeetingTotalStandby),
    ],
  });
}

// ========================================================== 7. Trend Harian --

function buildTrendHarian(wb: Workbook, data: YearIntegratedRekap, info: string) {
  const ws = wb.addWorksheet("Trend Harian");
  const columns: Col[] = [
    { key: "tgl", header: "Tanggal", width: 14, type: "date" },
    { key: "bulan", header: "Bulan", width: 12, type: "text" },
    { key: "hari", header: "Hari", width: 10, type: "text" },
    { key: "jenis", header: "Jenis Hari", width: 13, type: "text" },
    { key: "pMasuk", header: "Tiket Masuk", width: 10, type: "int" },
    { key: "pSelesai", header: "Tiket Selesai", width: 10, type: "int" },
    { key: "pSla", header: "SLA %", width: 9, type: "pct" },
    { key: "dTotal", header: "Total Aktivitas", width: 11, type: "int" },
    { key: "dDone", header: "Done", width: 9, type: "int" },
    { key: "dRate", header: "Penyelesaian", width: 11, type: "pct" },
    { key: "aTotal", header: "Total Record", width: 10, type: "int" },
    { key: "aPrs", header: "Hadir (PRS)", width: 10, type: "int" },
    { key: "aRate", header: "Tingkat Hadir", width: 10, type: "pct" },
    { key: "sH", header: "Siang (H)", width: 9, type: "int" },
    { key: "sh", header: "Malam (h)", width: 9, type: "int" },
    { key: "sTot", header: "Total Sesi", width: 9, type: "int" },
  ];
  sheetHeader(
    ws,
    `Trend Harian Terintegrasi ${data.year}`,
    "Data per tanggal untuk seluruh modul (sampai hari ini). Filter kolom 'Bulan' / 'Jenis Hari' untuk menyaring.",
    info,
    columns.length
  );

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const rows: Row[] = [];
  for (const m of data.months) {
    for (const d of m.dailyTrend ?? []) {
      if (d.dateStr > todayStr) continue;
      const [y, mo, da] = d.dateStr.split("-").map(Number);
      // Gunakan UTC agar Excel tidak bergeser karena zona waktu
      const date = new Date(Date.UTC(y, mo - 1, da));
      const dow = date.getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const hasData = d.masuk + d.selesai + d.dailyTotal + d.attTotal + d.stbTotal > 0;
      rows.push({
        muted: !hasData,
        accent: weekend ? { col: 2, color: C.weekend } : undefined,
        values: [
          date,
          m.monthName,
          HARI_ID[dow],
          weekend ? "Akhir Pekan" : "Hari Kerja",
          d.masuk,
          d.selesai,
          pct(d.sla),
          d.dailyTotal,
          d.dailyDone,
          pct(d.dailyRate),
          d.attTotal,
          d.attPrs,
          pct(d.attRate),
          d.stbH,
          d.stbHSmall,
          d.stbTotal,
        ],
      });
    }
  }

  if (rows.length === 0) {
    ws.getCell(5, 1).value = "Belum ada data harian untuk tahun ini.";
    ws.getCell(5, 1).font = { name: FONT, size: 10, italic: true, color: { argb: C.muted } };
    return;
  }

  writeTable(ws, {
    startRow: 5,
    groups: [
      { label: "Periode", span: 4, color: C.periode },
      { label: "1. Permintaan Design", span: 3, color: C.permintaan },
      { label: "2. Daily Activity", span: 3, color: C.daily },
      { label: "3. Attendance", span: 3, color: C.attendance },
      { label: "4. Safety Toolbox HSE", span: 3, color: C.stb },
    ],
    columns,
    rows,
    freezeCols: 1,
    totalLabel: "TOTAL TERFILTER",
    total: (c, a, b) => [
      null,
      "",
      "",
      "",
      sum(c("pMasuk"), a, b),
      sum(c("pSelesai"), a, b),
      null,
      sum(c("dTotal"), a, b),
      sum(c("dDone"), a, b),
      rate([c("dDone")], [c("dTotal")], a, b, null),
      sum(c("aTotal"), a, b),
      sum(c("aPrs"), a, b),
      null,
      sum(c("sH"), a, b),
      sum(c("sh"), a, b),
      sum(c("sTot"), a, b),
    ],
  });
}

// ============================================================= 8. Acuan SLA --

function buildAcuan(wb: Workbook, year: number) {
  const ws = wb.addWorksheet("Acuan SLA");
  const columns: Col[] = [
    { key: "prio", header: "Prioritas", width: 26, type: "text" },
    { key: "map", header: "Mapping Tiket", width: 52, type: "text" },
    { key: "resp", header: "Waktu Respon", width: 16, type: "text" },
    { key: "sel", header: "Waktu Penyelesaian", width: 20, type: "text" },
  ];
  sheetHeader(ws, `Acuan SLA Departemen Design ${year}`, "Referensi target SLA & kriteria penilaian KPI.", "", columns.length);

  const prio: [string, string, string, string, string][] = [
    ["P1 - Kritis (Urgent)", "tipe_desain = Urgent", "15 menit", "2 jam", C.p1],
    ["P2 - Tinggi (Prioritas)", "tipe_desain = Prioritas", "30 menit", "4 jam", C.p2],
    ["P3 - Sedang (Normal)", "tipe_desain = Normal & kategori = Troubleshoot", "2 jam", "24 jam (1 hari)", C.p3],
    ["P4 - Rendah (Normal)", "tipe_desain = Normal & kategori = Request/Instalasi", "4 jam", "48 jam (2 hari)", C.p4],
  ];
  const t1 = writeTable(ws, {
    startRow: 5,
    columns,
    rows: prio.map(([a, b, c, d, color]) => ({ values: [a, b, c, d], accent: { col: 0, color } })),
    freeze: false,
    filter: false,
  });

  let r = t1.nextRow + 1;
  const notes = [
    "Waktu dihitung kalender penuh (24 jam nonstop).",
    "Status SLA Tercapai hanya dinilai dari Waktu Penyelesaian (Waktu Respon untuk referensi/pemantauan).",
    "Tiket yang pernah Revisi otomatis dianggap Gagal SLA.",
    "Tiket yang pernah dieskalasi ke Vendor dikecualikan dari skor SLA (delay di luar kendali tim internal).",
  ];
  for (const n of notes) {
    ws.mergeCells(r, 1, r, 4);
    const cell = ws.getCell(r, 1);
    cell.value = `•  ${n}`;
    cell.font = { name: FONT, size: 10, color: { argb: C.muted } };
    cell.alignment = { indent: 1, wrapText: true, vertical: "middle" };
    r++;
  }

  r++;
  const gradeCols: Col[] = [
    { key: "g", header: "KPI Grade", width: 26, type: "grade" },
    { key: "s", header: "Rentang Skor", width: 52, type: "text" },
  ];
  writeTable(ws, {
    startRow: r,
    columns: gradeCols,
    rows: [
      { values: ["Sangat Baik", "≥ 90%"] },
      { values: ["Baik", "80% – 89%"] },
      { values: ["Cukup Baik", "60% – 79%"] },
      { values: ["Kurang Baik", "< 60%"] },
    ],
    freeze: false,
    filter: false,
  });
  ws.views = [{ showGridLines: false }];
}
