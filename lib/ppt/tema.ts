// Tema PPT bersama (dipakai laporan QCC dan Rekap Bulanan) agar semua deck
// punya tata letak, warna, huruf, dan komponen yang sama.
import fs from "node:fs";
import path from "node:path";
import pptxgen from "pptxgenjs";

export const W = { kertas: 13.33, tepi: 0.6, atas: 1.5, tinggi: 5.1, sisi: 9.1 };
export const LEBAR = W.kertas - W.tepi * 2;
export const FONT_JUDUL = "Arial";
export const FONT_ISI = "Calibri";
export const C = {
  tinta: "16232E", navy: "0E3B5C", putih: "FFFFFF", kartu: "EEF3F6", biru: "00579B", hijau: "1A5E3A",
  oranye: "E8710A", biruMuda: "7FA6C4", abu: "6B7A86", garis: "C9D6DF",
};

export type Pres = InstanceType<typeof pptxgen>;
export type Slide = ReturnType<Pres["addSlide"]>;
export type TeksOpsi = Parameters<Slide["addText"]>[1];
export type Sel = string | { text: string; options?: Record<string, unknown> };
export type Logo = { data: string; rasio: number };
type AdaPres = { pres: Pres };

export const angka = (v: number | null | undefined, d = 1) => (v == null ? "-" : v.toLocaleString("id-ID", { maximumFractionDigits: d }));

export function muatLogo(): Logo {
  const png = fs.readFileSync(path.join(process.cwd(), "public", "lourdes.png"));
  return { data: `image/png;base64,${png.toString("base64")}`, rasio: png.readUInt32BE(16) / png.readUInt32BE(20) };
}

export const teks = (s: Slide, t: Parameters<Slide["addText"]>[0], o: TeksOpsi) => s.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: C.tinta, valign: "top", ...o });
export const judul = (s: Slide, t: string) => s.addText(t, { placeholder: "title" });
export const sumberKaki = (s: Slide, t: string) => teks(s, t, { x: W.tepi, y: 6.82, w: 9.4, h: 0.4, fontSize: 11, color: C.abu, valign: "middle", objectName: "Sumber" });

export function kartu(k: AdaPres, s: Slide, x: number, y: number, w: number, h: number, warna = C.kartu) {
  s.addShape(k.pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: warna }, line: { color: warna, width: 0 }, objectName: "Kartu" });
}
export function catatan(k: AdaPres, s: Slide, x: number, y: number, w: number, h: number, kepala: string, baris: string[], besar?: { nilai: string; label: string }) {
  kartu(k, s, x, y, w, h);
  teks(s, kepala, { x: x + 0.25, y: y + 0.22, w: w - 0.5, h: 0.32, bold: true, fontSize: 15, color: C.navy });
  if (besar) {
    teks(s, besar.nilai, { x: x + 0.25, y: y + 0.62, w: w - 0.5, h: 0.8, fontFace: FONT_JUDUL, fontSize: 34, bold: true, color: C.oranye, valign: "middle" });
    teks(s, besar.label, { x: x + 0.25, y: y + 1.45, w: w - 0.5, h: 0.55, color: C.abu });
    y += 1.5;
    h -= 1.5;
  }
  teks(s, baris.map((b, i) => ({ text: b, options: { bullet: { indent: 14 }, breakLine: i < baris.length - 1, paraSpaceAfter: 7 } })), { x: x + 0.25, y: y + 0.62, w: w - 0.5, h: h - 0.8 });
}
export function angkaBesar(s: Slide, x: number, y: number, w: number, nilai: string, label: string, warna: string) {
  teks(s, nilai, { x, y, w, h: 0.95, fontFace: FONT_JUDUL, fontSize: 44, bold: true, color: warna, valign: "middle" });
  teks(s, label, { x, y: y + 1.0, w, h: 0.75 });
}
export function tabel(s: Slide, baris: Sel[][], o: Record<string, unknown>) {
  const kepala = { bold: true, color: C.putih, fill: { color: C.navy }, valign: "middle" };
  const isi = baris.map((r, i) => r.map((c) => {
    const sel = typeof c === "string" ? { text: c } : c;
    return { text: sel.text, options: { ...(i === 0 ? kepala : { color: C.tinta, valign: "middle" }), ...(sel.options ?? {}) } };
  }));
  s.addTable(isi as Parameters<Slide["addTable"]>[0], { fontSize: 14, border: { type: "solid", pt: 0.5, color: C.garis }, margin: [0.05, 0.1, 0.05, 0.1], ...o } as Parameters<Slide["addTable"]>[1]);
}

export const sumbu = {
  catAxisLabelColor: C.abu, valAxisLabelColor: C.abu, catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, catAxisLabelFontFace: FONT_ISI, valAxisLabelFontFace: FONT_ISI,
  dataLabelFontFace: FONT_ISI, legendFontFace: FONT_ISI, dataLabelFontSize: 12, dataLabelColor: C.tinta, legendFontSize: 12, legendColor: C.abu,
  valGridLine: { color: C.garis, size: 0.5 }, catGridLine: { style: "none" as const },
};
export const judulY = (t: string) => ({ showValAxisTitle: true, valAxisTitle: t, valAxisTitleFontSize: 12, valAxisTitleColor: C.abu, valAxisTitleFontFace: FONT_ISI });
export const judulX = (t: string) => ({ showCatAxisTitle: true, catAxisTitle: t, catAxisTitleFontSize: 12, catAxisTitleColor: C.abu, catAxisTitleFontFace: FONT_ISI });

/** Baris tabel perbandingan: label, pembanding, periode ini, arah (Membaik/Menurun/Hampir sama). */
export function barisBanding(label: string, a: number | null, b: number | null, polaritas: "Max" | "Min" | null, satuan = "", d = 1): Sel[] {
  let hasil = "Netral", warna = C.abu;
  if (a == null || b == null) hasil = "Tidak ada data";
  else if (polaritas && b !== 0 && Math.abs(a - b) / Math.abs(b) < 0.05) hasil = "Hampir sama";
  else if (polaritas) {
    const baik = polaritas === "Max" ? a > b : a < b;
    hasil = baik ? "Membaik" : "Menurun";
    warna = baik ? C.hijau : C.oranye;
  }
  return [label, `${angka(b, d)}${b == null ? "" : satuan}`, `${angka(a, d)}${a == null ? "" : satuan}`, { text: hasil, options: { bold: true, color: warna } }];
}

/** Dua master baku: KONTEN (putih, judul navy, logo + nomor slide) dan GELAP (sampul/penutup). */
export function pasangMaster(pres: Pres, logo: Logo) {
  pres.layout = "LAYOUT_WIDE";
  pres.company = "Lourdes Auto Parts";
  pres.theme = { headFontFace: FONT_JUDUL, bodyFontFace: FONT_ISI };
  const lebarLogo = 1.15;
  pres.defineSlideMaster({
    title: "KONTEN",
    background: { color: C.putih },
    objects: [
      { image: { data: logo.data, x: W.kertas - W.tepi - lebarLogo - 0.5, y: 6.82, w: lebarLogo, h: lebarLogo / logo.rasio } },
      { placeholder: { options: { name: "title", type: "title", x: W.tepi, y: 0.4, w: 9.9, h: 1.0, fontFace: FONT_JUDUL, fontSize: 28, bold: true, color: C.navy, align: "left", valign: "top", margin: 0 }, text: "" } },
    ],
    slideNumber: { x: W.kertas - W.tepi - 0.4, y: 6.88, w: 0.4, h: 0.3, fontFace: FONT_ISI, fontSize: 11, color: C.abu, align: "right" },
  });
  pres.defineSlideMaster({
    title: "GELAP",
    background: { color: C.navy },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: W.tepi, y: 2.1, w: 11.9, h: 2.1, fontFace: FONT_JUDUL, fontSize: 38, bold: true, color: C.putih, align: "left", valign: "top", margin: 0 }, text: "" } }],
  });
}
