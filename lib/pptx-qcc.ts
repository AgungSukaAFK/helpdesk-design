// Template presentasi gaya QCC (Quality Control Circle) untuk export PPTX.
// Ciri khas: cover berisi identitas gugus, header bar biru tua dengan label tahap
// PDCA di setiap slide, tabel berheader gelap, grafik native (bisa diedit di
// PowerPoint), slide rencana tindak lanjut, dan footer identitas + nomor halaman.
//
// Dipakai di browser saja (pptxgenjs di-import dinamis agar tidak ikut bundle awal).

import type PptxGenJS from "pptxgenjs";

export const QCC = {
  navy: "1F3864",
  blue: "2E75B6",
  sky: "DEEAF6",
  yellow: "FFC000",
  green: "70AD47",
  red: "C00000",
  orange: "ED7D31",
  gray: "595959",
  light: "F2F2F2",
  border: "BFBFBF",
  white: "FFFFFF",
  font: "Calibri",
} as const;

export type FasePdca = "PLAN" | "DO" | "CHECK" | "ACTION";

const WARNA_FASE: Record<FasePdca, string> = {
  PLAN: QCC.blue,
  DO: QCC.green,
  CHECK: QCC.yellow,
  ACTION: QCC.orange,
};

const W = 13.333;
const H = 7.5;
const MARGIN = 0.5;

export interface IdentitasDeck {
  judul: string;
  subjudul?: string;
  /** Nama gugus / tim, mis. "Design & Multimedia". */
  gugus: string;
  periode: string;
  perusahaan?: string;
  anggota?: string[];
  /** Nama file tanpa ekstensi. */
  namaFile: string;
}

export interface Deck {
  pptx: PptxGenJS;
  /** Slide isi: header bar + label fase + footer. Mengembalikan slide & y awal konten. */
  slide: (judul: string, fase?: FasePdca, langkah?: string) => { s: PptxGenJS.Slide; y: number };
  simpan: () => Promise<string>;
}

async function logoPng(): Promise<string | null> {
  // PowerPoint tidak mendukung WebP, jadi logo dikonversi ke PNG lewat canvas.
  try {
    const img = new Image();
    img.src = "/gmi-logo.webp";
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function buatDeck(id: IdentitasDeck): Promise<Deck> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = id.judul;
  pptx.company = id.perusahaan ?? "";
  pptx.author = id.gugus;
  pptx.theme = { headFontFace: QCC.font, bodyFontFace: QCC.font };

  const logo = await logoPng();

  // ===== Master slide isi =====
  pptx.defineSlideMaster({
    title: "QCC_ISI",
    background: { color: QCC.white },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.95, fill: { color: QCC.navy } } },
      { rect: { x: 0, y: 0.95, w: W, h: 0.06, fill: { color: QCC.yellow } } },
      { line: { x: MARGIN, y: H - 0.45, w: W - MARGIN * 2, h: 0, line: { color: QCC.border, width: 0.75 } } },
      {
        text: {
          text: `${id.gugus}${id.perusahaan ? ` · ${id.perusahaan}` : ""} · ${id.periode}`,
          options: { x: MARGIN, y: H - 0.42, w: 9, h: 0.35, fontSize: 9, color: QCC.gray, fontFace: QCC.font },
        },
      },
    ],
    slideNumber: { x: W - MARGIN - 0.6, y: H - 0.42, w: 0.6, h: 0.35, fontSize: 9, color: QCC.gray, align: "right" },
  });

  // ===== Cover =====
  const cover = pptx.addSlide();
  cover.background = { color: QCC.white };
  cover.addShape("rect", { x: 0, y: 0, w: 4.6, h: H, fill: { color: QCC.navy } });
  cover.addShape("rect", { x: 4.6, y: 0, w: 0.12, h: H, fill: { color: QCC.yellow } });
  // Roda PDCA di panel kiri
  const pusat = { x: 2.3, y: 3.75 };
  (["PLAN", "DO", "CHECK", "ACTION"] as FasePdca[]).forEach((f, i) => {
    const dx = i === 0 || i === 3 ? -1 : 0;
    const dy = i < 2 ? -1 : 0;
    cover.addShape("rect", {
      x: pusat.x + dx * 1.3,
      y: pusat.y + dy * 1.3,
      w: 1.3,
      h: 1.3,
      fill: { color: WARNA_FASE[f] },
      line: { color: QCC.navy, width: 3 },
    });
    cover.addText(f, {
      x: pusat.x + dx * 1.3,
      y: pusat.y + dy * 1.3,
      w: 1.3,
      h: 1.3,
      align: "center",
      valign: "middle",
      bold: true,
      fontSize: 13,
      color: QCC.white,
      fontFace: QCC.font,
    });
  });
  cover.addText("QCC", {
    x: 0.4, y: 0.5, w: 3.8, h: 0.6, fontSize: 28, bold: true, color: QCC.yellow, fontFace: QCC.font,
  });
  cover.addText("Quality Control Circle", {
    x: 0.4, y: 1.05, w: 3.8, h: 0.4, fontSize: 13, color: QCC.white, fontFace: QCC.font,
  });
  if (logo) cover.addImage({ data: logo, x: W - MARGIN - 1.1, y: 0.45, w: 1.1, h: 1.1, sizing: { type: "contain", w: 1.1, h: 1.1 } });
  cover.addText(id.judul, {
    x: 5.2, y: 1.9, w: 7.6, h: 1.5, fontSize: 34, bold: true, color: QCC.navy, fontFace: QCC.font, valign: "bottom",
  });
  if (id.subjudul) {
    cover.addText(id.subjudul, { x: 5.2, y: 3.45, w: 7.6, h: 0.6, fontSize: 16, color: QCC.gray, fontFace: QCC.font });
  }
  const identitas: [string, string][] = [
    ["Nama Gugus", id.gugus],
    ["Periode", id.periode],
    ...(id.perusahaan ? ([["Perusahaan", id.perusahaan]] as [string, string][]) : []),
    ...(id.anggota?.length ? ([["Anggota", id.anggota.join(", ")]] as [string, string][]) : []),
  ];
  cover.addTable(
    identitas.map(([k, v]) => [
      { text: k, options: { bold: true, color: QCC.white, fill: { color: QCC.blue } } },
      { text: v, options: { color: QCC.navy } },
    ]),
    {
      x: 5.2, y: 4.35, w: 7.4, colW: [1.8, 5.6], fontSize: 12, fontFace: QCC.font,
      border: { type: "solid", color: QCC.border, pt: 0.75 }, rowH: 0.38, valign: "middle",
    },
  );

  const slide: Deck["slide"] = (judul, fase, langkah) => {
    const s = pptx.addSlide({ masterName: "QCC_ISI" });
    s.addText(judul, {
      x: MARGIN, y: 0.12, w: fase ? 9.4 : W - MARGIN * 2 - (logo ? 1 : 0), h: 0.72,
      fontSize: 22, bold: true, color: QCC.white, fontFace: QCC.font, valign: "middle",
    });
    if (fase) {
      s.addShape("roundRect", {
        x: 10.05, y: 0.2, w: 2.0, h: 0.56, fill: { color: WARNA_FASE[fase] }, rectRadius: 0.1,
      });
      s.addText([
        { text: fase, options: { bold: true, fontSize: 13, breakLine: !!langkah } },
        ...(langkah ? [{ text: langkah, options: { fontSize: 9 } }] : []),
      ], {
        x: 10.05, y: 0.2, w: 2.0, h: 0.56, align: "center", valign: "middle", color: QCC.white, fontFace: QCC.font,
      });
    }
    if (logo) {
      s.addShape("rect", { x: W - MARGIN - 0.72, y: 0.12, w: 0.72, h: 0.72, fill: { color: QCC.white } });
      s.addImage({ data: logo, x: W - MARGIN - 0.68, y: 0.16, w: 0.64, h: 0.64, sizing: { type: "contain", w: 0.64, h: 0.64 } });
    }
    return { s, y: 1.3 };
  };

  const simpan = async () => {
    const fileName = `${id.namaFile}.pptx`;
    await pptx.writeFile({ fileName });
    return fileName;
  };

  return { pptx, slide, simpan };
}

// ===================== KOMPONEN SLIDE =====================

/** Slide daftar isi bergaya langkah PDCA. */
export function slideAgenda(deck: Deck, langkah: { fase: FasePdca; judul: string; ket: string }[]) {
  const { s, y } = deck.slide("Agenda Presentasi");
  const tinggi = Math.min(1.25, (H - y - 0.8) / langkah.length);
  langkah.forEach((l, i) => {
    const yy = y + i * tinggi;
    s.addShape("rect", { x: MARGIN, y: yy + 0.05, w: 1.6, h: tinggi - 0.15, fill: { color: WARNA_FASE[l.fase] } });
    s.addText(l.fase, {
      x: MARGIN, y: yy + 0.05, w: 1.6, h: tinggi - 0.15, align: "center", valign: "middle",
      bold: true, fontSize: 14, color: QCC.white, fontFace: QCC.font,
    });
    s.addShape("rect", {
      x: MARGIN + 1.6, y: yy + 0.05, w: W - MARGIN * 2 - 1.6, h: tinggi - 0.15,
      fill: { color: i % 2 ? QCC.white : QCC.light }, line: { color: QCC.border, width: 0.5 },
    });
    s.addText([
      { text: `${i + 1}. ${l.judul}`, options: { bold: true, fontSize: 15, color: QCC.navy, breakLine: true } },
      { text: l.ket, options: { fontSize: 11, color: QCC.gray } },
    ], { x: MARGIN + 1.8, y: yy + 0.05, w: W - MARGIN * 2 - 2, h: tinggi - 0.15, valign: "middle", fontFace: QCC.font });
  });
}

export interface KartuKpi {
  label: string;
  nilai: string;
  ket?: string;
  warna?: string;
}

/** Deretan kartu angka KPI. Mengembalikan y di bawah kartu. */
export function kartuKpi(s: PptxGenJS.Slide, kartu: KartuKpi[], y: number, h = 1.25) {
  const gap = 0.2;
  const w = (W - MARGIN * 2 - gap * (kartu.length - 1)) / kartu.length;
  kartu.forEach((k, i) => {
    const x = MARGIN + i * (w + gap);
    const warna = k.warna ?? QCC.blue;
    s.addShape("rect", { x, y, w, h, fill: { color: QCC.white }, line: { color: QCC.border, width: 0.75 } });
    s.addShape("rect", { x, y, w: 0.09, h, fill: { color: warna } });
    s.addText(k.label, { x: x + 0.2, y: y + 0.08, w: w - 0.3, h: 0.32, fontSize: 10, color: QCC.gray, fontFace: QCC.font });
    s.addText(k.nilai, { x: x + 0.2, y: y + 0.38, w: w - 0.3, h: 0.5, fontSize: 24, bold: true, color: warna, fontFace: QCC.font });
    if (k.ket) {
      s.addText(k.ket, { x: x + 0.2, y: y + 0.86, w: w - 0.3, h: 0.32, fontSize: 9, color: QCC.gray, fontFace: QCC.font });
    }
  });
  return y + h + 0.25;
}

type Sel = string | number | null | undefined;

export interface OpsiTabel {
  colW: number[];
  /** Posisi kiri tabel (default: margin kiri). */
  x?: number;
  /** Baris per slide; tabel panjang dilanjutkan di slide berikutnya. */
  barisPerSlide?: number;
  fontSize?: number;
  align?: ("left" | "center" | "right")[];
  /** Warna teks per sel (mis. status). */
  warnaSel?: (baris: Sel[], kolom: number) => string | undefined;
}

const toText = (v: Sel) => (v === null || v === undefined || v === "" ? "-" : String(v));

function addTabel(s: PptxGenJS.Slide, header: string[], rows: Sel[][], y: number, o: OpsiTabel) {
  const fontSize = o.fontSize ?? 10;
  const data: PptxGenJS.TableRow[] = [
    header.map((h, i) => ({
      text: h,
      options: { bold: true, color: QCC.white, fill: { color: QCC.navy }, align: o.align?.[i] ?? "center" },
    })),
    ...rows.map((r, ri) =>
      r.map((c, ci) => ({
        text: toText(c),
        options: {
          fill: { color: ri % 2 ? QCC.white : QCC.light },
          align: o.align?.[ci] ?? "left",
          color: o.warnaSel?.(r, ci) ?? "262626",
          bold: !!o.warnaSel?.(r, ci),
        },
      })),
    ),
  ];
  s.addTable(data, {
    x: o.x ?? MARGIN, y, colW: o.colW, fontSize, fontFace: QCC.font, valign: "middle",
    border: { type: "solid", color: QCC.border, pt: 0.5 }, margin: 0.05,
  });
}

/** Tabel yang otomatis dipecah ke beberapa slide dengan header berulang. */
export function slideTabel(
  deck: Deck,
  judul: string,
  fase: FasePdca | undefined,
  langkah: string | undefined,
  header: string[],
  rows: Sel[][],
  o: OpsiTabel,
  catatan?: string,
) {
  const per = o.barisPerSlide ?? 10;
  const halaman = Math.max(1, Math.ceil(rows.length / per));
  for (let i = 0; i < halaman; i++) {
    const potong = rows.slice(i * per, (i + 1) * per);
    const { s, y } = deck.slide(halaman > 1 ? `${judul} (${i + 1}/${halaman})` : judul, fase, langkah);
    if (rows.length === 0) {
      s.addText("Tidak ada data.", { x: MARGIN, y, w: 6, h: 0.5, fontSize: 14, color: QCC.gray, italic: true });
      continue;
    }
    addTabel(s, header, potong, y, o);
    if (catatan && i === halaman - 1) {
      s.addText(catatan, { x: MARGIN, y: H - 0.95, w: W - MARGIN * 2, h: 0.4, fontSize: 9, italic: true, color: QCC.gray, fontFace: QCC.font });
    }
  }
}

export function tabelDiSlide(s: PptxGenJS.Slide, header: string[], rows: Sel[][], y: number, o: OpsiTabel) {
  addTabel(s, header, rows, y, o);
}

/** Kotak kesimpulan/analisa dengan aksen kuning. */
export function kotakCatatan(s: PptxGenJS.Slide, judul: string, poin: string[], x: number, y: number, w: number, h: number) {
  s.addShape("rect", { x, y, w, h, fill: { color: "FFF8E1" }, line: { color: QCC.yellow, width: 1 } });
  s.addText(
    [
      { text: judul, options: { bold: true, fontSize: 12, color: QCC.navy, breakLine: true } },
      ...poin.map((p) => ({ text: p, options: { fontSize: 11, color: "262626", bullet: true, breakLine: true } })),
    ],
    { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: h - 0.2, valign: "top", fontFace: QCC.font, paraSpaceAfter: 4 },
  );
}

export function slidePenutup(deck: Deck, pesan = "Terima Kasih") {
  const s = deck.pptx.addSlide();
  s.background = { color: QCC.navy };
  s.addShape("rect", { x: 0, y: H / 2 + 0.75, w: W, h: 0.08, fill: { color: QCC.yellow } });
  s.addText(pesan, {
    x: 0, y: H / 2 - 1, w: W, h: 1.4, align: "center", fontSize: 44, bold: true, color: QCC.white, fontFace: QCC.font,
  });
  s.addText("Plan · Do · Check · Action", {
    x: 0, y: H / 2 + 0.95, w: W, h: 0.5, align: "center", fontSize: 16, color: QCC.yellow, fontFace: QCC.font,
  });
}

export const LEBAR_KONTEN = W - MARGIN * 2;
export const X_KIRI = MARGIN;
export const TINGGI_SLIDE = H;

export const fmtPct = (v: number | null | undefined, digit = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "-" : `${Number(v.toFixed(digit))}%`;
