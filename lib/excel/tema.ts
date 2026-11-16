import type { Workbook, Worksheet, Cell, Fill } from "exceljs";

/* ============================================================================
 * Tema Excel bersama untuk semua fitur export.
 *
 * Gaya baku (mengikuti export Rekap Bulanan):
 *   - Judul (pita navy) + subjudul + info periode/ekspor di atas tabel
 *   - Baris grup kolom berwarna (opsional), header kolom navy
 *   - Baris zebra, border tipis, angka & persen bertipe numerik asli
 *   - AutoFilter + freeze panes di setiap tabel
 *   - Baris TOTAL memakai SUBTOTAL() sehingga ikut berubah saat difilter
 *
 * exceljs dimuat dinamis lewat bukuBaru() agar tidak membebani halaman.
 * ========================================================================== */

export type { Workbook, Worksheet };

// ---------------------------------------------------------------- palette --
export const XC = {
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
  weekendBg: "FFFFF1F2",

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

export type Badge = { bg: string; fg: string };

export const BADGE = {
  hijau: { bg: "FFD1FAE5", fg: "FF065F46" },
  biru: { bg: "FFDBEAFE", fg: "FF1E40AF" },
  kuning: { bg: "FFFEF3C7", fg: "FF92400E" },
  merah: { bg: "FFFFE4E6", fg: "FF9F1239" },
  ungu: { bg: "FFF3E8FF", fg: "FF6B21A8" },
  oranye: { bg: "FFFFEDD5", fg: "FF9A3412" },
  abu: { bg: "FFF1F5F9", fg: "FF475569" },
  indigo: { bg: "FFE0E7FF", fg: "FF3730A3" },
} satisfies Record<string, Badge>;

export const GRADE_STYLE: Record<string, Badge> = {
  "Sangat Baik": BADGE.hijau,
  Baik: BADGE.biru,
  "Cukup Baik": BADGE.kuning,
  "Kurang Baik": BADGE.merah,
  Cukup: BADGE.kuning,
  "Perlu Perhatian": BADGE.merah,
  "Baik Sekali": BADGE.hijau,
  Kurang: BADGE.oranye,
  "Sangat Kurang": BADGE.merah,
};

/** Warna status umum (Done, In Progress, Revisi, Pending, dst). Dicocokkan dari teks. */
export function badgeStatus(v: unknown): Badge | undefined {
  const s = String(v ?? "").toLowerCase();
  if (!s || s === "-") return undefined;
  if (/(done|selesai|tercapai|completed|hadir|prs)/.test(s) && !/tidak/.test(s)) return BADGE.hijau;
  if (/(progress|proses|berjalan|ovt|lembur)/.test(s)) return BADGE.biru;
  if (/(revisi|revision|abs|mangkir|tidak tercapai|batal|cancel|overdue|terlambat)/.test(s)) return BADGE.merah;
  if (/(review|pending|tunda|waiting|menunggu|planned|rencana|to do|todo|belum)/.test(s)) return BADGE.kuning;
  if (/(off|libur)/.test(s)) return BADGE.abu;
  return undefined;
}

export const FONT = "Calibri";

export const FMT = {
  int: "#,##0",
  dec: "#,##0.0",
  dec2: "#,##0.00",
  pct: "0.0%",
  date: "dd mmm yyyy",
  datetime: "dd mmm yyyy hh:mm",
  text: "@",
} as const;

export type ColType = "text" | "int" | "dec" | "dec2" | "pct" | "date" | "datetime" | "grade";

export interface Col {
  key: string;
  header: string;
  width: number;
  type: ColType;
  /** teks panjang dibungkus (tinggi baris menyesuaikan) */
  wrap?: boolean;
  /** rata tengah untuk teks pendek (kode, status) */
  center?: boolean;
  /** warna sel berdasarkan nilainya (status, predikat, dsb) */
  badge?: (v: unknown) => Badge | undefined;
}

export interface Group {
  label: string;
  span: number;
  color: string;
}

export type Formula = { formula: string; result?: number | string };
export type CellVal = string | number | Date | null | undefined | Formula;

export interface Row {
  values: CellVal[];
  muted?: boolean;
  /** baris disorot (mis. bulan/periode terpilih) */
  bold?: boolean;
  /** latar khusus baris (mis. akhir pekan) */
  fill?: string;
  /** index kolom yang teksnya diberi warna khusus */
  accent?: { col: number; color: string };
}

// ---------------------------------------------------------------- helpers --
export const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const thin = { style: "thin" as const, color: { argb: XC.border } };
export const BORDER_ALL = { top: thin, left: thin, bottom: thin, right: thin };

export function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Persen 0-100 → fraksi Excel (0-1). null tetap null. */
export const pct = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10) / 1000;

export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/**
 * Tanggal untuk sel Excel. exceljs menulis Date sebagai UTC, jadi jam lokal (WIB)
 * dipindah ke komponen UTC agar yang tampil di Excel sama dengan di aplikasi.
 * `jam = false` membuang jam (tanggal saja). Nilai kosong/tidak valid → null.
 */
export function tglExcel(v: string | Date | null | undefined, jam = true): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), jam ? d.getHours() : 0, jam ? d.getMinutes() : 0));
}

/** Nama sheet aman untuk Excel (maks 31 karakter, tanpa karakter terlarang). */
export const namaSheet = (s: string) => s.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";

const isFormula = (v: CellVal): v is Formula =>
  typeof v === "object" && v !== null && !(v instanceof Date) && "formula" in v;

export function setValue(cell: Cell, v: CellVal) {
  if (v === "") {
    cell.value = null;
    return;
  }
  if (v === null || v === undefined) {
    cell.value = "-";
    return;
  }
  if (isFormula(v)) {
    cell.value = { formula: v.formula, result: v.result ?? undefined } as never;
    return;
  }
  cell.value = v as never;
}

export function styleBadge(cell: Cell, b: Badge | undefined) {
  if (!b) return;
  cell.fill = solid(b.bg);
  cell.font = { ...(cell.font || {}), name: FONT, size: 10, bold: true, color: { argb: b.fg } };
}

export function styleGrade(cell: Cell) {
  styleBadge(cell, typeof cell.value === "string" ? GRADE_STYLE[cell.value] : undefined);
}

const numFmt = (t: ColType) =>
  t === "int" ? FMT.int : t === "dec" ? FMT.dec : t === "dec2" ? FMT.dec2 : t === "pct" ? FMT.pct : t === "date" ? FMT.date : t === "datetime" ? FMT.datetime : undefined;

const isLeft = (c: Col) => (c.type === "text" && !c.center) || c.type === "date" || c.type === "datetime";

/** Judul (pita navy), subjudul, dan info di baris 1-3. Tabel umumnya mulai di baris 5. */
export function sheetHeader(ws: Worksheet, title: string, subtitle: string, info: string, span: number) {
  span = Math.max(span, 4);
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 15, bold: true, color: { argb: XC.white } };
  t.fill = solid(XC.navy);
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, span);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: FONT, size: 10, color: { argb: XC.muted } };
  s.alignment = { vertical: "middle", indent: 1, wrapText: true };
  ws.getRow(2).height = 18;

  ws.mergeCells(3, 1, 3, span);
  const i = ws.getCell(3, 1);
  i.value = info;
  i.font = { name: FONT, size: 9, italic: true, color: { argb: XC.faint } };
  i.alignment = { vertical: "middle", indent: 1 };
}

/** Teks info baku baris ke-3. */
export const infoEkspor = (bagian: string[] = []) =>
  [
    ...bagian,
    `Diekspor ${new Date().toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    "Gunakan tombol filter (▼) di header tabel untuk menyaring",
  ].join("  •  ");

/**
 * Tulis satu tabel bergaya standar. Mengembalikan posisi baris agar
 * pemanggil bisa membuat rumus total.
 */
export function writeTable(
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
  const adaWrap = columns.some((c) => c.wrap);
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
        gc.border = { ...BORDER_ALL, left: { style: "thin", color: { argb: XC.white } }, right: { style: "thin", color: { argb: XC.white } } };
      }
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: XC.white } };
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
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: XC.white } };
    cell.fill = solid(XC.headerBg);
    cell.alignment = { horizontal: isLeft(c) ? "left" : "center", vertical: "middle", wrapText: true, indent: isLeft(c) ? 1 : 0 };
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
        bold: i === 0 || row.bold,
        color: { argb: row.muted || isDash ? XC.faint : XC.text },
      };
      if (row.accent && row.accent.col === i && !row.muted) {
        cell.font = { ...cell.font, color: { argb: row.accent.color }, bold: true };
      }
      if (row.fill) cell.fill = solid(row.fill);
      else if (zebra) cell.fill = solid(XC.zebra);
      cell.border = BORDER_ALL;
      cell.alignment = {
        horizontal: isLeft(c) ? "left" : "center",
        vertical: adaWrap ? "top" : "middle",
        indent: isLeft(c) ? 1 : 0,
        wrapText: c.wrap,
      };
      if (!isDash) {
        const f = numFmt(c.type);
        if (f) cell.numFmt = f;
      }
      if (!row.muted && !isDash) {
        if (c.type === "grade") styleGrade(cell);
        if (c.badge) styleBadge(cell, c.badge(cell.value));
      }
    });
    if (!adaWrap) ws.getRow(r).height = 18;
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
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: XC.text } };
      cell.fill = solid(XC.totalBg);
      cell.border = { ...BORDER_ALL, top: { style: "medium", color: { argb: XC.headerBg } } };
      cell.alignment = { horizontal: isLeft(c) ? "left" : "center", vertical: "middle", indent: isLeft(c) ? 1 : 0 };
      if (cell.value !== "-") {
        const f = numFmt(c.type);
        if (f && c.type !== "date" && c.type !== "datetime") cell.numFmt = f;
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

/**
 * Tabel indikator dua/tiga kolom bergaya ringkasan (seperti sheet "Ringkasan" Rekap Bulanan).
 * `bagian` = judul seksi berwarna, `baris` = [label, nilai, tipe, keterangan?].
 */
export function writeRingkasan(
  ws: Worksheet,
  opts: {
    startRow: number;
    kolomNilai: string[];
    bagian: { judul: string; warna: string; baris: { label: string; nilai: CellVal[]; tipe: ColType | ColType[]; ket?: string; badge?: Badge }[] }[];
    lebar?: number[];
  }
) {
  const nNilai = opts.kolomNilai.length;
  const span = nNilai + 2;
  const lebar = opts.lebar ?? [40, ...opts.kolomNilai.map(() => 20), 52];
  lebar.forEach((w, i) => {
    const col = ws.getColumn(i + 1);
    if (!col.width || col.width < w) col.width = w;
  });

  let r = opts.startRow;
  ["Indikator", ...opts.kolomNilai, "Keterangan"].forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    const kiri = i === 0 || i === span - 1;
    cell.value = h;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: XC.white } };
    cell.fill = solid(XC.headerBg);
    cell.alignment = { horizontal: kiri ? "left" : "center", vertical: "middle", indent: kiri ? 1 : 0 };
    cell.border = BORDER_ALL;
  });
  ws.getRow(r).height = 22;
  const headerRow = r;
  r++;

  for (const b of opts.bagian) {
    ws.mergeCells(r, 1, r, span);
    const sc = ws.getCell(r, 1);
    sc.value = b.judul;
    sc.font = { name: FONT, size: 10, bold: true, color: { argb: XC.white } };
    sc.fill = solid(b.warna);
    sc.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(r).height = 20;
    r++;

    b.baris.forEach((ln, idx) => {
      const vals: CellVal[] = [ln.label, ...ln.nilai, ln.ket ?? ""];
      vals.forEach((v, i) => {
        const cell = ws.getCell(r, i + 1);
        setValue(cell, v);
        const kiri = i === 0 || i === span - 1;
        const isDash = cell.value === "-";
        cell.font = { name: FONT, size: 10, bold: i === 0, color: { argb: i === span - 1 || isDash ? XC.muted : XC.text } };
        cell.border = BORDER_ALL;
        if (idx % 2 === 1) cell.fill = solid(XC.zebra);
        cell.alignment = { horizontal: kiri ? "left" : "center", vertical: "middle", indent: kiri ? 1 : 0, wrapText: i === span - 1 };
        if (i > 0 && i < span - 1 && !isDash) {
          const tipe = Array.isArray(ln.tipe) ? ln.tipe[i - 1] ?? ln.tipe[0] : ln.tipe;
          const f = numFmt(tipe);
          if (f) cell.numFmt = f;
          if (tipe === "grade") styleGrade(cell);
          if (ln.badge) styleBadge(cell, ln.badge);
        }
      });
      ws.getRow(r).height = 18;
      r++;
    });
  }
  return { headerRow, nextRow: r };
}

// Rumus SUBTOTAL yang ikut menyesuaikan filter
export const sum = (col: string, a: number, b: number, result?: number): Formula => ({
  formula: `SUBTOTAL(109,${col}${a}:${col}${b})`,
  result,
});
export const count = (col: string, a: number, b: number, result?: number): Formula => ({
  formula: `SUBTOTAL(103,${col}${a}:${col}${b})`,
  result,
});
export const avg = (col: string, a: number, b: number, result?: number | null): Formula => ({
  formula: `IFERROR(SUBTOTAL(101,${col}${a}:${col}${b}),"-")`,
  result: result ?? "-",
});
export const max = (col: string, a: number, b: number, result?: number): Formula => ({
  formula: `SUBTOTAL(104,${col}${a}:${col}${b})`,
  result,
});
/** rasio SUBTOTAL(num) / SUBTOTAL(den), num & den bisa berupa beberapa kolom */
export const rate = (num: string[], den: string[], a: number, b: number, result: number | null): Formula => {
  const s = (cols: string[]) => cols.map((c) => `SUBTOTAL(109,${c}${a}:${c}${b})`).join("+");
  return { formula: `IFERROR((${s(num)})/(${s(den)}),"-")`, result: result ?? "-" };
};
/** jumlah baris terfilter yang nilainya sama dengan `teks` (mis. status Done) */
export const countIfVisible = (col: string, a: number, b: number, teks: string, result?: number): Formula => ({
  formula: `SUMPRODUCT(SUBTOTAL(103,OFFSET(${col}${a},ROW(${col}${a}:${col}${b})-ROW(${col}${a}),0)),--(${col}${a}:${col}${b}="${teks.replace(/"/g, '""')}"))`,
  result,
});

// ------------------------------------------------------------- workbook --
export async function bukuBaru(): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Helpdesk Design";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

/** Tab berwarna, ukuran cetak landscape A4 muat lebar, lalu unduh. */
export async function unduhWorkbook(wb: Workbook, fileName: string, tabColors: string[] = []) {
  wb.worksheets.forEach((ws, i) => {
    ws.properties.tabColor = { argb: tabColors[i] ?? XC.navy };
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
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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

/**
 * Template import: header di baris 1 (format yang dibaca importer tidak berubah),
 * diberi gaya, lebar kolom, freeze, dan contoh baris bergaris miring abu.
 */
export function writeTemplate(ws: Worksheet, headers: { header: string; width: number }[], contoh: CellVal[][], startRow = 1) {
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h.width;
    const cell = ws.getCell(startRow, i + 1);
    cell.value = h.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: XC.white } };
    cell.fill = solid(XC.headerBg);
    cell.alignment = { horizontal: "left", vertical: "middle", indent: 1, wrapText: true };
    cell.border = BORDER_ALL;
  });
  ws.getRow(startRow).height = 26;
  contoh.forEach((row, ri) => {
    row.forEach((v, i) => {
      const cell = ws.getCell(startRow + 1 + ri, i + 1);
      setValue(cell, v);
      cell.font = { name: FONT, size: 10, italic: true, color: { argb: XC.muted } };
      cell.border = BORDER_ALL;
      cell.alignment = { vertical: "top", wrapText: true, indent: 1 };
    });
  });
  ws.views = [{ state: "frozen", ySplit: startRow, showGridLines: true }];
}
