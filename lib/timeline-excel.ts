// Import & export Excel untuk Timeline Creative Tim.
// Format mengikuti "Timeline Creative Tim.xlsx": sheet "Timeline Post Topic" dan
// sheet "Timeline Desain" (kolom data di kiri, sel harian per bulan di kanan).
// Importer mencari baris header berdasarkan nama kolom, jadi file hasil export
// (yang punya judul di atas tabel) bisa diimport ulang.

import type { Cell, Worksheet } from "exceljs";
import {
  BADGE, BORDER_ALL, FONT, XC, bukuBaru, infoEkspor, namaSheet, sheetHeader, solid, tglExcel, unduhWorkbook, writeTable,
  type Col, type Group, type Row,
} from "@/lib/excel/tema";
import {
  APPROVAL_OPTIONS, BULAN, DESIGN_OPTIONS, POST_TOPIC_OPTIONS, STATUS_OPTIONS, cocokkanPilihan, fmtTgl, namaHari, parseTgl,
  rentangBar, statusStyle, type TimelineDesain, type TimelinePostTopic,
} from "@/lib/timeline";

export type PostImport = Omit<TimelinePostTopic, "id" | "created_at">;
export type DesainImport = Omit<TimelineDesain, "id" | "created_at" | "post_topic_id">;

export interface HasilImport {
  posts: PostImport[];
  desain: DesainImport[];
}

// ------------------------------------------------------------------ import --
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function teksSel(cell: Cell): string {
  const v = cell.value as unknown;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return fmtTgl(new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown; hyperlink?: string };
    if (o.richText) return o.richText.map((t) => t.text).join("").trim();
    if (o.hyperlink && typeof o.text !== "string") return o.hyperlink;
    if (typeof o.text === "string") return o.text.trim();
    if (o.result !== undefined && o.result !== null) return String(o.result).trim();
    return "";
  }
  const s = String(v).trim();
  return s === "-" ? "" : s;
}

/** Link: utamakan URL hyperlink, kalau tidak ada pakai teksnya. */
function linkSel(cell: Cell): string {
  const v = cell.value as { hyperlink?: string } | null;
  if (v && typeof v === "object" && typeof v.hyperlink === "string") return v.hyperlink;
  return teksSel(cell);
}

function tanggalSel(cell: Cell): string | null {
  const v = cell.value as unknown;
  if (v instanceof Date) return fmtTgl(new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const r = (v && typeof v === "object" && "result" in (v as object)) ? (v as { result: unknown }).result : v;
  if (r instanceof Date) return fmtTgl(new Date(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate()));
  if (typeof r === "number" && r > 20000 && r < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(r) * 86400000);
    return fmtTgl(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = teksSel(cell);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return fmtTgl(new Date(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return fmtTgl(new Date(y, +m[2] - 1, +m[1]));
  }
  return null;
}

function jamSel(cell: Cell): string {
  const v = cell.value as unknown;
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, "0")}.${String(v.getUTCMinutes()).padStart(2, "0")}`;
  if (typeof v === "number" && v < 1) {
    const menit = Math.round(v * 24 * 60);
    return `${String(Math.floor(menit / 60)).padStart(2, "0")}.${String(menit % 60).padStart(2, "0")}`;
  }
  return teksSel(cell).replace(":", ".");
}

/** Cari baris header (15 baris pertama) yang memuat semua kunci. Kembalikan nomor baris + peta kolom. */
function cariHeader(ws: Worksheet, wajib: string[]) {
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const kolom: { key: string; col: number }[] = [];
    ws.getRow(r).eachCell((cell, col) => {
      const k = norm(teksSel(cell));
      if (k) kolom.push({ key: k, col });
    });
    if (wajib.every((w) => kolom.some((k) => k.key === w))) return { row: r, kolom };
  }
  return null;
}

function bacaDesain(ws: Worksheet): DesainImport[] {
  const h = cariHeader(ws, ["design", "duedate"]);
  if (!h) return [];
  const col = (...keys: string[]) => h.kolom.find((k) => keys.includes(k.key))?.col;
  const statusCols = h.kolom.filter((k) => k.key === "status").map((k) => k.col);
  const cStatus = statusCols[0];
  const cApproval = col("statusapproval", "approval") ?? statusCols[1];
  const c = {
    no: col("no"),
    design: col("design"),
    date: col("date", "startdate", "tanggalmulai"),
    due: col("duedate"),
    project: col("typeofproject", "project"),
    layout: col("layoutukuran", "layout", "ukuran"),
    visual: col("visualtype"),
    vlink: col("visuallinkdrive", "visuallink"),
    asset: col("linktoasset"),
  };
  const out: DesainImport[] = [];
  for (let r = h.row + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (n?: number) => (n ? teksSel(row.getCell(n)) : "");
    const design = get(c.design);
    const project = get(c.project).replace(/\s*\n\s*/g, " ");
    const date = c.date ? tanggalSel(row.getCell(c.date)) : null;
    const due = c.due ? tanggalSel(row.getCell(c.due)) : null;
    // Baris template kosong / catatan / legenda tidak punya judul maupun tanggal
    if (!project && !date && !due) continue;
    const no = Number(get(c.no));
    out.push({
      no: Number.isFinite(no) && no > 0 ? no : null,
      design: design ? cocokkanPilihan(design, DESIGN_OPTIONS) : "Flyer",
      status: get(cStatus) ? cocokkanPilihan(get(cStatus), STATUS_OPTIONS) : "Schedule",
      date,
      due_date: due,
      approval_status: get(cApproval) ? cocokkanPilihan(get(cApproval), APPROVAL_OPTIONS) : null,
      type_of_project: project || null,
      layout_ukuran: get(c.layout) || null,
      visual_type: get(c.visual) || null,
      visual_link: c.vlink ? linkSel(row.getCell(c.vlink)) || null : null,
      asset_link: c.asset ? linkSel(row.getCell(c.asset)) || null : null,
    });
  }
  return out;
}

function bacaPost(ws: Worksheet): PostImport[] {
  const h = cariHeader(ws, ["design", "date", "posttopictype"]) ?? cariHeader(ws, ["design", "date", "posttopic"]);
  if (!h) return [];
  const col = (...keys: string[]) => h.kolom.find((k) => keys.includes(k.key))?.col;
  const c = {
    no: col("no"),
    design: col("design"),
    date: col("date"),
    time: col("time", "jam"),
    topic: col("posttopictype", "posttopic"),
    project: col("typeofproject", "project"),
    visual: col("visualtype"),
    vlink: col("visuallinkdrive", "visuallink"),
    asset: col("linktoasset"),
    channel: col("linktobepublishpost", "publish", "channel"),
  };
  const out: PostImport[] = [];
  for (let r = h.row + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (n?: number) => (n ? teksSel(row.getCell(n)) : "");
    const project = get(c.project).replace(/\s*\n\s*/g, " ");
    const date = c.date ? tanggalSel(row.getCell(c.date)) : null;
    if (!project || !date) continue;
    const no = Number(get(c.no));
    out.push({
      no: Number.isFinite(no) && no > 0 ? no : null,
      design: get(c.design) ? cocokkanPilihan(get(c.design), DESIGN_OPTIONS) : "Flyer",
      post_date: date,
      post_time: c.time ? jamSel(row.getCell(c.time)) || null : null,
      post_topic: get(c.topic) ? cocokkanPilihan(get(c.topic), POST_TOPIC_OPTIONS) : null,
      project_name: project,
      visual_type: get(c.visual) || null,
      visual_link: c.vlink ? linkSel(row.getCell(c.vlink)) || null : null,
      asset_link: c.asset ? linkSel(row.getCell(c.asset)) || null : null,
      publish_channels: get(c.channel) || null,
    });
  }
  return out;
}

export async function bacaFileTimeline(file: File): Promise<HasilImport> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const hasil: HasilImport = { posts: [], desain: [] };
  wb.eachSheet((ws) => {
    // Sheet desain dikenali dari kolom "Due Date", sheet post dari "Post Topic"
    if (cariHeader(ws, ["design", "duedate"])) hasil.desain.push(...bacaDesain(ws));
    else hasil.posts.push(...bacaPost(ws));
  });
  return hasil;
}

// ------------------------------------------------------------------ export --
const BULAN_WARNA = ["FF1E3A8A", "FF334155"];

const badgeApproval = (v: unknown) => {
  const s = String(v ?? "");
  return s === "Done" ? BADGE.hijau : s === "Approve" ? BADGE.biru : s === "Revisi" ? BADGE.merah : s === "Review" ? BADGE.kuning : undefined;
};
const badgeProgres = (v: unknown) => {
  const s = String(v ?? "");
  return s === "Published" ? BADGE.hijau : s === "Designed" ? BADGE.oranye : s === "In Progress" ? BADGE.biru : s === "Schedule" ? BADGE.abu : undefined;
};

export async function eksporTimeline(opts: {
  tahun: number;
  desain: TimelineDesain[];
  posts: TimelinePostTopic[];
}) {
  const { tahun } = opts;
  const wb = await bukuBaru();

  // ---- Sheet 1: Timeline Post Topic
  const wsPost = wb.addWorksheet(namaSheet("Timeline Post Topic"));
  const postCols: Col[] = [
    { key: "no", header: "No.", width: 6, type: "int" },
    { key: "design", header: "Design", width: 14, type: "text" },
    { key: "day", header: "Day", width: 10, type: "text", center: true },
    { key: "date", header: "Date", width: 14, type: "date" },
    { key: "time", header: "Time", width: 8, type: "text", center: true },
    { key: "topic", header: "Post Topic/Type", width: 18, type: "text" },
    { key: "project", header: "Type of Project", width: 34, type: "text", wrap: true },
    { key: "visual", header: "Visual Type", width: 12, type: "text", center: true },
    { key: "vlink", header: "Visual Link (Drive)", width: 24, type: "text" },
    { key: "asset", header: "Link To Asset", width: 16, type: "text" },
    { key: "channel", header: "Link To Be Publish Post", width: 22, type: "text" },
  ];
  sheetHeader(wsPost, `Timeline Post Topic Creative Team ${tahun}`, "Jadwal posting (hari H) per topik.", infoEkspor([`Tahun ${tahun}`, `${opts.posts.length} jadwal`]), postCols.length);
  writeTable(wsPost, {
    startRow: 5,
    columns: postCols,
    freezeCols: 2,
    rows: opts.posts.map<Row>((p, i) => ({
      values: [
        p.no ?? i + 1, p.design, namaHari(p.post_date), tglExcel(p.post_date, false), p.post_time ?? "", p.post_topic ?? "",
        p.project_name, p.visual_type ?? "", p.visual_link ?? "", p.asset_link ?? "", p.publish_channels ?? "",
      ],
    })),
  });

  // ---- Sheet 2: Timeline Desain (Gantt)
  const ws = wb.addWorksheet(namaSheet("Timeline Desain"));
  const kiri: Col[] = [
    { key: "no", header: "No.", width: 6, type: "int" },
    { key: "design", header: "Design", width: 14, type: "text" },
    { key: "status", header: "Status", width: 12, type: "text", center: true, badge: badgeProgres },
    { key: "date", header: "Date", width: 13, type: "date" },
    { key: "due", header: "Due Date", width: 13, type: "date" },
    { key: "approval", header: "Status Approval", width: 12, type: "text", center: true, badge: badgeApproval },
    { key: "project", header: "Type of Project", width: 30, type: "text", wrap: true },
    { key: "layout", header: "Layout / Ukuran", width: 14, type: "text" },
    { key: "visual", header: "Visual Type", width: 11, type: "text", center: true },
    { key: "vlink", header: "Visual Link (Drive)", width: 20, type: "text" },
    { key: "asset", header: "Link To Asset", width: 14, type: "text" },
  ];
  const hari: string[] = [];
  const groups: Group[] = [{ label: "DATA DESAIN", span: kiri.length, color: XC.headerBg }];
  for (let m = 0; m < 12; m++) {
    const n = new Date(tahun, m + 1, 0).getDate();
    for (let d = 1; d <= n; d++) hari.push(fmtTgl(new Date(tahun, m, d)));
    groups.push({ label: `${BULAN[m]} ${tahun}`, span: n, color: BULAN_WARNA[m % 2] });
  }
  const kolomHari: Col[] = hari.map((h) => ({ key: h, header: String(parseTgl(h)!.getDate()), width: 3.3, type: "text", center: true }));
  const postById = new Map(opts.posts.map((p) => [p.id, p]));

  sheetHeader(
    ws,
    `Timeline Tim Kreatif ${tahun}`,
    "Bar harian mengikuti kolom Date → Due Date dan diwarnai sesuai Status. H = hari tayang post topic. Date = 1 minggu sebelum Due Date, Due Date = 1 minggu sebelum hari H.",
    infoEkspor([`Tahun ${tahun}`, `${opts.desain.length} desain`]),
    kiri.length,
  );
  const t = writeTable(ws, {
    startRow: 5,
    groups,
    columns: [...kiri, ...kolomHari],
    filter: false,
    freezeCols: 3,
    rows: opts.desain.map<Row>((r, i) => ({
      values: [
        r.no ?? i + 1, r.design, r.status, tglExcel(r.date, false), tglExcel(r.due_date, false), r.approval_status ?? "",
        r.type_of_project ?? "", r.layout_ukuran ?? "", r.visual_type ?? "", r.visual_link ?? "", r.asset_link ?? "",
        ...hari.map(() => ""),
      ],
    })),
  });

  // Header hari: akhir pekan merah
  hari.forEach((h, i) => {
    const dow = parseTgl(h)!.getDay();
    if (dow === 0 || dow === 6) {
      const cell = ws.getCell(t.headerRow, kiri.length + 1 + i);
      cell.fill = solid(XC.weekend);
    }
  });
  ws.getRow(t.headerRow).height = 22;

  // Isi bar per baris
  opts.desain.forEach((r, ri) => {
    const rowNo = t.firstDataRow + ri;
    const bar = rentangBar(r);
    const hariH = r.post_topic_id ? postById.get(r.post_topic_id)?.post_date : undefined;
    const warna = statusStyle(r.status).argb;
    hari.forEach((h, i) => {
      const cell = ws.getCell(rowNo, kiri.length + 1 + i);
      cell.border = { left: { style: "hair", color: { argb: XC.border } }, right: { style: "hair", color: { argb: XC.border } }, top: BORDER_ALL.top, bottom: BORDER_ALL.bottom };
      const dow = parseTgl(h)!.getDay();
      if (bar && h >= bar.mulai && h <= bar.akhir) cell.fill = solid(warna);
      else if (dow === 0 || dow === 6) cell.fill = solid(XC.weekendBg);
      else cell.fill = solid(XC.white);
      if (h === hariH) {
        cell.value = "H";
        cell.fill = solid(XC.p1);
        cell.font = { name: FONT, size: 8, bold: true, color: { argb: XC.white } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    });
  });

  if (opts.desain.length) {
    ws.autoFilter = { from: { row: t.headerRow, column: 1 }, to: { row: t.lastDataRow, column: kiri.length } };
  }

  // Legenda
  let lr = t.nextRow + 1;
  ws.getCell(lr, 2).value = "Keterangan warna:";
  ws.getCell(lr, 2).font = { name: FONT, size: 10, bold: true, color: { argb: XC.text } };
  for (const s of [...STATUS_OPTIONS, "H"]) {
    lr++;
    const sw = ws.getCell(lr, 2);
    sw.fill = solid(s === "H" ? XC.p1 : statusStyle(s).argb);
    sw.border = BORDER_ALL;
    const lb = ws.getCell(lr, 3);
    lb.value = s === "H" ? "Hari H (tayang)" : s;
    lb.font = { name: FONT, size: 10, color: { argb: XC.text } };
  }

  return unduhWorkbook(wb, `Timeline Creative Tim ${tahun}.xlsx`, [XC.daily, XC.permintaan]);
}
