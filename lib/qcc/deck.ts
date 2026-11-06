// Generator PPT laporan QCC. Satu tema dan dua layout; semua teks dibentuk dari data,
// jadi berlaku untuk rentang apa pun. Slide yang syaratnya tidak terpenuhi dilewati
// dan dicatat di lampiran.
import fs from "node:fs";
import path from "node:path";
import pptxgen from "pptxgenjs";
import { BATAS_MENIT, MIN_TIKET, MIN_TITIK_KENDALI, type HasilPeriode, type ItemPareto, type LaporanQcc } from "@/lib/qcc/metrics";

const TIM = "Tim Creative";
const W = { kertas: 13.33, tepi: 0.6, atas: 1.5, tinggi: 5.1, sisi: 9.1 };
const LEBAR = W.kertas - W.tepi * 2;
const FONT_JUDUL = "Arial";
const FONT_ISI = "Calibri";
const C = {
  tinta: "16232E", navy: "0E3B5C", putih: "FFFFFF", kartu: "EEF3F6", biru: "00579B", hijau: "1A5E3A",
  oranye: "E8710A", biruMuda: "7FA6C4", abu: "6B7A86", garis: "C9D6DF",
};

type Pres = InstanceType<typeof pptxgen>;
type Slide = ReturnType<Pres["addSlide"]>;
type TeksOpsi = Parameters<Slide["addText"]>[1];
type Sel = string | { text: string; options?: Record<string, unknown> };

const angka = (v: number | null | undefined, d = 1) => (v == null ? "-" : v.toLocaleString("id-ID", { maximumFractionDigits: d }));

type Definisi = {
  id: string;
  judul: string;
  bagian: "Pembuka" | "Plan" | "Check" | "Act" | "Lampiran";
  langkah?: number;
  /** Berisi alasan jika slide tidak bisa dibuat. */
  syarat?: (l: LaporanQcc) => string | null;
  buat: (k: Konteks) => void;
};
type Konteks = { pres: Pres; U: HasilPeriode; B: HasilPeriode | null; dilewati: string[]; logo: Logo; tambah: (master: "KONTEN" | "GELAP", bagian: string) => Slide };
type Logo = { data: string; rasio: number };

function muatLogo(): Logo {
  const png = fs.readFileSync(path.join(process.cwd(), "public", "lourdes.png"));
  return { data: `image/png;base64,${png.toString("base64")}`, rasio: png.readUInt32BE(16) / png.readUInt32BE(20) };
}

const teks = (s: Slide, t: Parameters<Slide["addText"]>[0], o: TeksOpsi) => s.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: C.tinta, valign: "top", ...o });
const judul = (s: Slide, t: string) => s.addText(t, { placeholder: "title" });
const sumberKaki = (s: Slide, t: string) => teks(s, t, { x: W.tepi, y: 6.82, w: 9.4, h: 0.4, fontSize: 11, color: C.abu, valign: "middle", objectName: "Sumber" });

function kartu(k: Konteks, s: Slide, x: number, y: number, w: number, h: number, warna = C.kartu) {
  s.addShape(k.pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: warna }, line: { color: warna, width: 0 }, objectName: "Kartu" });
}
function pelacak(k: Konteks, s: Slide, langkah: number) {
  const r = 0.21, jarak = 0.035, x0 = W.kertas - W.tepi - 8 * r - 7 * jarak;
  for (let i = 1; i <= 8; i++) {
    const aktif = i === langkah;
    s.addText(String(i), { shape: k.pres.ShapeType.ellipse, objectName: `Langkah ${i}`, x: x0 + (i - 1) * (r + jarak), y: 0.45, w: r, h: r, margin: 0, align: "center", valign: "middle", fontSize: 10, bold: aktif, color: aktif ? C.putih : C.abu, fill: { color: aktif ? C.oranye : C.kartu } });
  }
}
function catatan(k: Konteks, s: Slide, x: number, y: number, w: number, h: number, kepala: string, baris: string[], besar?: { nilai: string; label: string }) {
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
function angkaBesar(s: Slide, x: number, y: number, w: number, nilai: string, label: string, warna: string) {
  teks(s, nilai, { x, y, w, h: 0.95, fontFace: FONT_JUDUL, fontSize: 44, bold: true, color: warna, valign: "middle" });
  teks(s, label, { x, y: y + 1.0, w, h: 0.75 });
}
function tabel(s: Slide, baris: Sel[][], o: Record<string, unknown>) {
  const kepala = { bold: true, color: C.putih, fill: { color: C.navy }, valign: "middle" };
  const isi = baris.map((r, i) => r.map((c) => {
    const sel = typeof c === "string" ? { text: c } : c;
    return { text: sel.text, options: { ...(i === 0 ? kepala : { color: C.tinta, valign: "middle" }), ...(sel.options ?? {}) } };
  }));
  s.addTable(isi as Parameters<Slide["addTable"]>[0], { fontSize: 14, border: { type: "solid", pt: 0.5, color: C.garis }, margin: [0.05, 0.1, 0.05, 0.1], ...o } as Parameters<Slide["addTable"]>[1]);
}

const sumbu = {
  catAxisLabelColor: C.abu, valAxisLabelColor: C.abu, catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, catAxisLabelFontFace: FONT_ISI, valAxisLabelFontFace: FONT_ISI,
  dataLabelFontFace: FONT_ISI, legendFontFace: FONT_ISI, dataLabelFontSize: 12, dataLabelColor: C.tinta, legendFontSize: 12, legendColor: C.abu,
  valGridLine: { color: C.garis, size: 0.5 }, catGridLine: { style: "none" as const },
};
const judulY = (t: string) => ({ showValAxisTitle: true, valAxisTitle: t, valAxisTitleFontSize: 12, valAxisTitleColor: C.abu, valAxisTitleFontFace: FONT_ISI });
const judulX = (t: string) => ({ showCatAxisTitle: true, catAxisTitle: t, catAxisTitleFontSize: 12, catAxisTitleColor: C.abu, catAxisTitleFontFace: FONT_ISI });

/** Bentuk baku materi QCC: batang terurut + garis kumulatif, item prioritas dibedakan warnanya. */
function grafikPareto(k: Konteks, s: Slide, P: ItemPareto[], nama: string) {
  const warna = P.map((p, i) => (i === 0 || p.kumulatif <= 80 ? C.oranye : C.biruMuda));
  const label = P.map((p) => p.nama);
  s.addChart([
    { type: k.pres.ChartType.bar, data: [{ name: `${nama} (jam)`, labels: label, values: P.map((p) => p.jam) }], options: { chartColors: warna, barGapWidthPct: 45, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", ...sumbu } },
    { type: k.pres.ChartType.line, data: [{ name: "Kumulatif (%)", labels: label, values: P.map((p) => p.kumulatif) }], options: { chartColors: [C.navy], lineSize: 2, lineDataSymbolSize: 7, secondaryValAxis: true, secondaryCatAxis: true, showValue: false } },
  ], {
    x: W.tepi, y: W.atas, w: 8.2, h: W.tinggi, altText: `Diagram Pareto ${nama}`, showLegend: true, legendPos: "b", ...sumbu,
    valAxes: [
      { showValAxisTitle: true, valAxisTitle: "Jam", valAxisTitleFontSize: 12, valAxisTitleColor: C.abu, valAxisLabelFontSize: 12, valAxisLabelColor: C.abu, valAxisMinVal: 0, valGridLine: { color: C.garis, size: 0.5 } },
      { showValAxisTitle: true, valAxisTitle: "Kumulatif %", valAxisTitleFontSize: 12, valAxisTitleColor: C.abu, valAxisLabelFontSize: 12, valAxisLabelColor: C.abu, valAxisMinVal: 0, valAxisMaxVal: 100, valGridLine: { style: "none" } },
    ],
    catAxes: [{ catAxisLabelFontSize: 12, catAxisLabelColor: C.abu }, { catAxisHidden: true }],
  } as never);
}

function barisBanding(label: string, a: number | null, b: number | null, polaritas: "Max" | "Min" | null, satuan = "", d = 1): Sel[] {
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

const kakiTiket = (U: HasilPeriode) => `Sumber: tiket desain, ${U.label}, n = ${U.tiket.nWaktu}. Waktu dalam jam kerja Senin–Jumat 08.00–17.00 WIB.`;
const SYARAT_N = (l: LaporanQcc) => (l.utama.tiket.nWaktu >= MIN_TIKET ? null : `butuh minimal ${MIN_TIKET} tiket`);

export const SLIDE: Definisi[] = [
  { id: "sampul", judul: "Sampul", bagian: "Pembuka", buat(k) {
    const s = k.tambah("GELAP", "Pembuka");
    judul(s, `Laporan QCC ${TIM}`);
    teks(s, k.U.label, { x: W.tepi, y: 3.0, w: 11, h: 0.5, fontSize: 24, bold: true, color: C.garis });
    if (k.B) teks(s, `Pembanding: ${k.B.label}`, { x: W.tepi, y: 3.6, w: 11, h: 0.4, fontSize: 16, color: C.garis });
    kartu(k, s, W.tepi, 6.05, 1.65, 0.75, C.putih);
    s.addImage({ data: k.logo.data, x: W.tepi + 0.17, y: 6.05 + (0.75 - 1.3 / k.logo.rasio) / 2, w: 1.3, h: 1.3 / k.logo.rasio, altText: "Logo Lourdes Auto Parts" });
  } },
  { id: "ringkasan", judul: "Ringkasan periode", bagian: "Pembuka", buat(k) {
    const s = k.tambah("KONTEN", "Pembuka");
    const T = k.U.tiket, A = k.U.aktivitas;
    judul(s, T.cepatPct == null ? "Ringkasan periode" : T.nWaktu < MIN_TIKET ? `${T.cepat} dari ${T.nWaktu} tiket mulai diproses dalam ${BATAS_MENIT} menit kerja` : `${angka(T.cepatPct)}% tiket mulai diproses dalam ${BATAS_MENIT} menit kerja`);
    const w = 3.65, g = 0.39, y = W.atas + 0.2;
    angkaBesar(s, W.tepi, y, w, angka(T.n, 0), `tiket desain masuk, ${T.nWaktu} punya catatan waktu lengkap`, C.biru);
    angkaBesar(s, W.tepi + w + g, y, w, `${angka(T.medianTunggu)} menit`, `median waktu tunggu, median kerja ${angka(T.medianKerja)} menit`, C.hijau);
    angkaBesar(s, W.tepi + 2 * (w + g), y, w, `${angka(A.jamTercatat)} jam`, `kerja tercatat di Daily Activity dari ${A.nBerjam} entri berjam`, C.oranye);
    const poin = [
      T.terlama && `Tiket terlama menunggu ${angka(T.terlama.menit, 0)} menit kerja (${T.terlama.tgl}, ${T.terlama.jenis}).`,
      k.U.fishbone.terkuat && `Indikasi penyebab terkuat: ${k.U.fishbone.terkuat.faktor}, ${k.U.fishbone.terkuat.teks}.`,
      k.U.kehadiran.wajib > 0 && `Kehadiran ${angka(k.U.kehadiran.ratePct)}% dari ${k.U.kehadiran.wajib} kehadiran wajib.`,
    ].filter(Boolean) as string[];
    catatan(k, s, W.tepi, 4.0, LEBAR, 2.3, "Yang perlu diperhatikan", poin.length ? poin : ["Belum ada data yang menonjol pada rentang ini."]);
    sumberKaki(s, `Periode ${k.U.label}. Waktu tunggu = tiket dibuat sampai mulai diproses, dalam jam kerja.`);
  } },
  { id: "peta-data", judul: "Sumber data", bagian: "Pembuka", buat(k) {
    const s = k.tambah("KONTEN", "Pembuka");
    const U = k.U;
    judul(s, "Semua sumber data pada rentang ini");
    tabel(s, [
      ["Sumber", "Data pada rentang", "Dipakai untuk"],
      ["Tiket desain", `${U.tiket.n} tiket`, "Pareto, histogram, control chart, scatter"],
      ["Rating dan revisi", `${U.suara.nDinilai} dinilai, ${U.suara.tiketRevisi} direvisi`, "Suara pelanggan"],
      ["Daily Activity", `${U.aktivitas.n} entri, ${angka(U.aktivitas.jamTercatat)} jam`, "Beban kerja per jenis"],
      ["Attendance", `${U.kehadiran.wajib} kehadiran wajib`, "Faktor Manusia"],
      ["Safety Toolbox", `${U.safety.sesi} kehadiran terjadwal`, "Aspek Safety"],
      ["Content Plan", `${U.konten.n} jadwal jatuh tempo`, "Capaian rencana"],
      ["Target Project", `${U.target.length} target aktif`, "Capaian rencana"],
      ["Evaluasi Designer", `${U.evaluasi.n} penilaian`, "Grafik radar aspek"],
    ], { x: W.tepi, y: W.atas, w: LEBAR, colW: [3.2, 4.0, 4.93], rowH: 0.5 });
    sumberKaki(s, `Periode ${U.label}.`);
  } },
  { id: "pareto", judul: "Pareto waktu tunggu", bagian: "Plan", langkah: 1,
    syarat: (l) => SYARAT_N(l) ?? (l.utama.tiket.pareto.length >= 4 ? null : "butuh minimal 4 faktor"),
    buat(k) {
      const s = k.tambah("KONTEN", "Plan");
      const T = k.U.tiket, top = T.pareto[0];
      judul(s, `${top.nama} menyumbang ${angka(top.kumulatif)}% total waktu tunggu`);
      pelacak(k, s, 1);
      grafikPareto(k, s, T.pareto, "Waktu tunggu");
      const poin = [`Dari ${top.n} tiket ${top.nama}.`];
      if (T.terlama?.jenis === top.nama) poin.push(`Tiket terlama ${T.terlama.kode} menyumbang ${angka(T.terlama.menit / 60)} jam.`);
      catatan(k, s, W.sisi, W.atas, W.kertas - W.tepi - W.sisi, W.tinggi, "Cara membaca", poin, { nilai: `${angka(top.jam)} jam`, label: `waktu tunggu ${top.nama}` });
      sumberKaki(s, kakiTiket(k.U));
    } },
  { id: "stratifikasi", judul: "Stratifikasi per divisi", bagian: "Plan", langkah: 1,
    syarat: (l) => SYARAT_N(l) ?? (l.utama.tiket.paretoDivisi.length >= 2 ? null : "butuh minimal 2 divisi"),
    buat(k) {
      const s = k.tambah("KONTEN", "Plan");
      const Q = k.U.tiket.paretoDivisi, d = Q[0];
      judul(s, `Tiket ${d.nama} menanggung ${angka(d.kumulatif)}% waktu tunggu`);
      pelacak(k, s, 1);
      s.addChart(k.pres.ChartType.bar, [{ name: "Waktu tunggu (jam)", labels: Q.map((q) => `${q.nama} (${q.n} tiket)`).reverse(), values: Q.map((q) => q.jam).reverse() }], {
        x: W.tepi, y: W.atas, w: 8.2, h: W.tinggi, barDir: "bar", altText: "Waktu tunggu per divisi pemohon", chartColors: Q.map((q) => (q === d ? C.oranye : C.biruMuda)).reverse(), barGapWidthPct: 45, showLegend: false,
        showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", ...sumbu, valAxisHidden: true, valGridLine: { style: "none" },
      });
      catatan(k, s, W.sisi, W.atas, W.kertas - W.tepi - W.sisi, W.tinggi, "Stratifikasi Who", [`${d.nama} mengajukan ${d.n} dari ${k.U.tiket.nWaktu} tiket.`, "Bandingkan jumlah tiket dengan jam tunggunya."], { nilai: `${angka(d.jam)} jam`, label: `waktu tunggu tiket ${d.nama}` });
      sumberKaki(s, kakiTiket(k.U));
    } },
  { id: "kandidat-tema", judul: "Kandidat tema", bagian: "Plan", langkah: 1,
    syarat: (l) => (l.utama.kandidat.length ? null : "tidak ada kandidat tema dari data"),
    buat(k) {
      const s = k.tambah("KONTEN", "Plan");
      const K = k.U.kandidat.slice(0, 5);
      judul(s, `Data periode ini memunculkan ${K.length} kandidat tema`);
      pelacak(k, s, 1);
      tabel(s, [["Kandidat tema", "Bukti", "Sumber"], ...K.map((c) => [c.tema, c.bukti, c.sumber])], { x: W.tepi, y: W.atas, w: LEBAR, colW: [6.3, 3.83, 2.0], rowH: 0.62 });
      sumberKaki(s, `Periode ${k.U.label}. Kandidat disusun otomatis. Tim memilih satu tema dan menetapkan targetnya.`);
    } },
  { id: "histogram", judul: "Histogram waktu tunggu", bagian: "Plan", langkah: 2, syarat: SYARAT_N, buat(k) {
    const s = k.tambah("KONTEN", "Plan");
    const T = k.U.tiket;
    judul(s, `${T.lambat} tiket menunggu lebih dari satu jam kerja`);
    pelacak(k, s, 2);
    s.addChart(k.pres.ChartType.bar, [{ name: "Jumlah tiket", labels: T.histogram.map((h) => h.label), values: T.histogram.map((h) => h.n) }], {
      x: W.tepi, y: W.atas, w: 8.2, h: W.tinggi, altText: "Histogram waktu tunggu tiket", chartColors: T.histogram.map((_, i) => (i < 2 ? C.biruMuda : C.oranye)), barGapWidthPct: 8, showLegend: false,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", ...sumbu, ...judulY("Jumlah tiket"), valAxisMinVal: 0,
    });
    catatan(k, s, W.sisi, W.atas, W.kertas - W.tepi - W.sisi, W.tinggi, "Temuan", [`${T.cepat} tiket mulai diproses dalam ${BATAS_MENIT} menit kerja.`, "Jika rata-rata jauh di atas median, beberapa tiket ekstrem mendorong angkanya."], { nilai: `${angka(T.medianTunggu)} menit`, label: `median, sedangkan rata-rata ${angka(T.rataTunggu, 0)} menit` });
    sumberKaki(s, `${kakiTiket(k.U)} Lebar kelas tidak sama.`);
  } },
  { id: "kendali", judul: "Control chart", bagian: "Plan", langkah: 2,
    syarat: (l) => (l.utama.tiket.nWaktu >= MIN_TITIK_KENDALI ? null : `butuh minimal ${MIN_TITIK_KENDALI} titik`),
    buat(k) {
      const s = k.tambah("KONTEN", "Plan");
      const T = k.U.tiket, K = T.kendali, label = K.titik.map((_, i) => String(i + 1));
      judul(s, K.diLuar ? `${K.diLuar} tiket berada di luar batas kendali` : "Waktu tunggu berada dalam batas kendali");
      pelacak(k, s, 2);
      s.addChart(k.pres.ChartType.line, [
        { name: "Waktu tunggu", labels: label, values: K.titik },
        { name: `UCL ${angka(K.ucl, 0)}`, labels: label, values: K.titik.map(() => K.ucl) },
        { name: `Rata-rata ${angka(K.cl, 0)}`, labels: label, values: K.titik.map(() => K.cl) },
      ], { x: W.tepi, y: W.atas, w: 8.2, h: W.tinggi, altText: "Peta kendali individu waktu tunggu per tiket", chartColors: [C.biru, C.oranye, C.hijau], lineSize: 2, lineDataSymbol: "none", showLegend: true, legendPos: "b", ...sumbu, ...judulY("Menit kerja"), ...judulX("Urutan tiket"), catAxisLabelFontSize: 10, catAxisLabelFrequency: 4, valAxisMinVal: 0 } as never);
      catatan(k, s, W.sisi, W.atas, W.kertas - W.tepi - W.sisi, W.tinggi, "Temuan", ["Periksa penyebab khusus tiap titik di atas UCL.", "Data sangat miring, jadi baca batas ini sebagai sinyal."], { nilai: `${angka(T.terlama!.menit, 0)} menit`, label: `tertinggi: ${T.terlama!.kode}, ${T.terlama!.tgl}` });
      sumberKaki(s, `${kakiTiket(k.U)} UCL = rata-rata + 2,66 × rata-rata moving range.`);
    } },
  { id: "beban-kerja", judul: "Beban kerja Daily Activity", bagian: "Plan", langkah: 2,
    syarat: (l) => (l.utama.aktivitas.pareto.length >= 4 ? null : "butuh minimal 4 jenis pekerjaan berjam"),
    buat(k) {
      const s = k.tambah("KONTEN", "Plan");
      const A = k.U.aktivitas, b = A.pareto[0];
      judul(s, `${b.nama} menyerap ${angka(b.kumulatif)}% jam kerja tercatat`);
      pelacak(k, s, 2);
      grafikPareto(k, s, A.pareto, "Jam kerja");
      catatan(k, s, W.sisi, W.atas, W.kertas - W.tepi - W.sisi, W.tinggi, "Daily Activity", [`${A.nBerjam} dari ${A.n} entri punya jam mulai dan selesai.`, `${A.tanpaJenis} entri belum punya jenis pekerjaan.`], { nilai: `${angka(A.jamTercatat)} jam`, label: "total jam tercatat" });
      sumberKaki(s, `Sumber: Daily Activity, ${k.U.label}. Hanya entri yang punya jam.`);
    } },
  { id: "kehadiran", judul: "Kehadiran dan Safety Toolbox", bagian: "Plan", langkah: 2,
    syarat: (l) => (l.utama.kehadiran.wajib > 0 || l.utama.safety.sesi > 0 ? null : "tidak ada data Attendance dan Safety Toolbox"),
    buat(k) {
      const s = k.tambah("KONTEN", "Plan");
      const h = k.U.kehadiran, f = k.U.safety;
      judul(s, [h.ratePct != null && `Kehadiran ${angka(h.ratePct)}%`, f.ratePct != null && `Safety Toolbox ${angka(f.ratePct)}%`].filter(Boolean).join(" dan "));
      pelacak(k, s, 2);
      const w = (LEBAR - 0.4) / 2;
      ([[h.ratePct, "Kehadiran kerja", h.wajib ? `${h.hadir} hadir, ${h.absen} absen dari ${h.wajib} kehadiran wajib` : "Tidak ada data pada rentang ini", W.tepi], [f.ratePct, "Safety Toolbox Meeting", f.sesi ? `${f.hadir} hadir dari ${f.sesi} kehadiran terjadwal` : "Tidak ada data pada rentang ini", W.tepi + w + 0.4]] as const).forEach(([v, l, d, x]) => {
        kartu(k, s, x, W.atas, w, 3.0);
        teks(s, l, { x: x + 0.3, y: W.atas + 0.3, w: w - 0.6, h: 0.35, fontSize: 16, bold: true, color: C.navy });
        teks(s, v == null ? "Belum ada" : `${angka(v)}%`, { x: x + 0.3, y: W.atas + 0.8, w: w - 0.6, h: 1.0, fontFace: FONT_JUDUL, fontSize: v == null ? 28 : 44, bold: true, color: v == null ? C.abu : C.hijau, valign: "middle" });
        teks(s, d, { x: x + 0.3, y: W.atas + 2.0, w: w - 0.6, h: 0.7 });
      });
      catatan(k, s, W.tepi, W.atas + 3.3, LEBAR, 1.8, "Kaitan dengan analisa", ["Dipakai sebagai faktor Manusia pada fishbone. Kehadiran rendah bisa menjelaskan antrean tiket."]);
      sumberKaki(s, `Sumber: Attendance dan Safety Toolbox, ${k.U.label}.`);
    } },
  { id: "fishbone", judul: "Fishbone sebab akibat", bagian: "Plan", langkah: 4, buat(k) {
    const s = k.tambah("KONTEN", "Plan");
    const F = k.U.fishbone;
    judul(s, F.terkuat ? `${F.terkuat.faktor} menjadi indikasi penyebab terkuat` : F.jumlahMasalah ? "Belum ada penyebab dominan dari data" : "Tidak ada tiket yang tertahan pada rentang ini");
    pelacak(k, s, 4);
    const spine = 4.0, kepalaX = 10.55, kolom = 3.25, tinggi = 1.65;
    s.addShape(k.pres.ShapeType.line, { x: W.tepi, y: spine, w: kepalaX - W.tepi, h: 0, line: { color: C.navy, width: 3 }, objectName: "Tulang utama" });
    kartu(k, s, kepalaX, spine - 0.85, W.kertas - W.tepi - kepalaX, 1.7, C.navy);
    teks(s, F.masalah, { x: kepalaX + 0.15, y: spine - 0.72, w: W.kertas - W.tepi - kepalaX - 0.3, h: 1.45, fontSize: 15, bold: true, color: C.putih, valign: "middle" });
    const tulang = (t: (typeof F.tulang)[number], x: number, atas: boolean) => {
      s.addShape(k.pres.ShapeType.line, { x: x + 0.15, y: atas ? spine - tinggi : spine, w: 0.55, h: tinggi, flipV: !atas, line: { color: C.biru, width: 2 }, objectName: `Tulang ${t.faktor}` });
      s.addText(t.faktor, { shape: k.pres.ShapeType.roundRect, rectRadius: 0.06, objectName: `Faktor ${t.faktor}`, x, y: atas ? spine - tinggi - 0.36 : spine + tinggi, w: 1.4, h: 0.36, margin: 0, align: "center", valign: "middle", fontSize: 14, bold: true, color: C.putih, fill: { color: C.biru } });
      const baris = t.sebab.length
        ? t.sebab.map((c, i) => { const kuat = F.terkuat?.teks === c.teks; return { text: c.teks, options: { bold: kuat, color: kuat ? C.oranye : C.tinta, breakLine: i < t.sebab.length - 1, paraSpaceAfter: 3 } }; })
        : [{ text: "Belum ada indikasi", options: { color: C.abu } }];
      teks(s, baris, { x: x + 0.82, y: atas ? spine - tinggi + 0.1 : spine + 0.15, w: kolom - 0.95, h: tinggi - 0.25 });
    };
    F.tulang.slice(0, 3).forEach((t, i) => tulang(t, W.tepi + i * kolom, true));
    F.tulang.slice(3).forEach((t, i) => tulang(t, W.tepi + i * kolom, false));
    teks(s, [{ text: "Oranye tebal", options: { bold: true, color: C.oranye } }, { text: " = indikasi terkuat, minimal 25% tiket lambat." }], { x: W.tepi + 2 * kolom + 0.15, y: 5.0, w: 5.2, h: 0.32 });
    sumberKaki(s, `Disusun otomatis dari tiket dan Daily Activity, ${k.U.label}. Ini indikasi, konfirmasi akar masalah dengan 5 Why.`);
  } },
  { id: "scatter", judul: "Diagram pencar", bagian: "Plan", langkah: 4,
    syarat: (l) => SYARAT_N(l) ?? (l.utama.tiket.scatter.r != null ? null : "data tidak bervariasi"),
    buat(k) {
      const s = k.tambah("KONTEN", "Plan");
      const T = k.U.tiket, r = T.scatter.r!, lemah = Math.abs(r) < 0.3;
      judul(s, lemah ? "Waktu tunggu tidak berkaitan dengan lama pengerjaan" : "Waktu tunggu berkaitan dengan lama pengerjaan");
      pelacak(k, s, 4);
      s.addChart(k.pres.ChartType.scatter, [{ name: "Waktu kerja (menit)", values: T.scatter.x }, { name: "Waktu tunggu (menit)", values: T.scatter.y }], {
        x: W.tepi, y: W.atas, w: 8.2, h: W.tinggi, altText: "Diagram pencar waktu kerja dan waktu tunggu", chartColors: [C.biru], lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 8, showLegend: false, ...sumbu,
        showTitle: true, title: "Waktu tunggu (menit) terhadap waktu kerja", titleFontSize: 14, titleColor: C.navy, titleFontFace: FONT_ISI, ...judulX("Waktu kerja (menit)"), valAxisMinVal: 0, catAxisMinVal: 0,
      } as never);
      catatan(k, s, W.sisi, W.atas, W.kertas - W.tepi - W.sisi, W.tinggi, "Korelasi", lemah ? ["Tiket yang lama dikerjakan belum tentu lama menunggu.", "Analisa diarahkan ke alur masuk tiket."] : ["Waktu tunggu bergerak bersama lama pengerjaan.", "Periksa hubungan ini bersama tim."], { nilai: `r = ${angka(r, 2)}`, label: lemah ? "hubungan lemah" : "ada hubungan" });
      sumberKaki(s, `${kakiTiket(k.U)} Korelasi Pearson.`);
    } },
  { id: "perbandingan", judul: "Perbandingan dua rentang", bagian: "Check", langkah: 7,
    syarat: (l) => (l.banding ? null : "rentang pembanding tidak dipilih"),
    buat(k) {
      const s = k.tambah("KONTEN", "Check");
      const U = k.U, B = k.B!, a = U.tiket.cepatPct, b = B.tiket.cepatPct, d = a != null && b != null ? a - b : null;
      judul(s, d == null ? "Perbandingan dua rentang" : d === 0 ? `Tiket ≤ ${BATAS_MENIT} menit kerja tidak berubah` : `Tiket ≤ ${BATAS_MENIT} menit kerja ${d > 0 ? "naik" : "turun"} ${angka(Math.abs(d))} poin`);
      pelacak(k, s, 7);
      tabel(s, [
        ["Metrik", "Pembanding", "Periode ini", "Arah"],
        barisBanding(`Tiket mulai diproses ≤ ${BATAS_MENIT} menit kerja`, a, b, "Max", "%"),
        barisBanding("Median waktu tunggu", U.tiket.medianTunggu, B.tiket.medianTunggu, "Min", " menit"),
        barisBanding("Tiket selesai tepat tenggat", U.tiket.tepatPct, B.tiket.tepatPct, "Max", "%"),
        barisBanding("Jumlah tiket masuk", U.tiket.n, B.tiket.n, null, "", 0),
        barisBanding("Entri Daily Activity tanpa jenis", U.aktivitas.tanpaJenisPct, B.aktivitas.tanpaJenisPct, "Min", "%"),
        barisBanding("Kehadiran kerja", U.kehadiran.ratePct, B.kehadiran.ratePct, "Max", "%"),
        barisBanding("Kehadiran Safety Toolbox", U.safety.ratePct, B.safety.ratePct, "Max", "%"),
      ], { x: W.tepi, y: W.atas, w: LEBAR, colW: [5.33, 2.4, 2.4, 2.0], rowH: 0.58 });
      sumberKaki(s, `Periode ini n = ${U.tiket.nWaktu}, pembanding n = ${B.tiket.nWaktu}. Selisih di bawah 5% dianggap hampir sama.`);
    } },
  { id: "suara", judul: "Suara pelanggan", bagian: "Check", langkah: 7,
    syarat: (l) => (l.utama.evaluasi.aspek.length ? null : "tidak ada data Evaluasi Designer"),
    buat(k) {
      const s = k.tambah("KONTEN", "Check");
      const E = k.U.evaluasi, V = k.U.suara;
      judul(s, `${E.terendah!.aspek.join(" dan ")} menjadi aspek evaluasi terendah`);
      pelacak(k, s, 7);
      s.addChart(k.pres.ChartType.radar, [{ name: "Rata-rata tim", labels: E.aspek.map((a) => a.label), values: E.aspek.map((a) => a.nilai) }], { x: W.tepi, y: W.atas, w: 8.2, h: W.tinggi, altText: "Grafik radar aspek evaluasi desain", radarStyle: "marker", chartColors: [C.biru], lineSize: 2, showLegend: false, ...sumbu, valAxisMinVal: 0, valAxisMaxVal: 5, valAxisMajorUnit: 1, catAxisLabelFontSize: 14 } as never);
      const poin = [`Rata-rata tim dari ${E.n} penilaian, bukan nilai per orang.`];
      if (V.nDinilai) poin.push(`Rating pemohon rata-rata ${angka(V.rataRating)} dari ${V.nDinilai} tiket.`);
      poin.push(`${V.tiketRevisi} dari ${k.U.tiket.n} tiket direvisi.`);
      catatan(k, s, W.sisi, W.atas, W.kertas - W.tepi - W.sisi, W.tinggi, "Suara pelanggan", poin, { nilai: `${angka(E.terendah!.nilai, 2)} / 5`, label: "skor aspek terendah" });
      sumberKaki(s, `Sumber: Evaluasi Designer, rating, dan revisi tiket. Periode ${k.U.label}.`);
    } },
  { id: "capaian", judul: "Capaian rencana", bagian: "Check", langkah: 7,
    syarat: (l) => (l.utama.target.length ? null : "tidak ada Target Project aktif"),
    buat(k) {
      const s = k.tambah("KONTEN", "Check");
      const T = k.U.target, rendah = T[0], L = [...T].reverse();
      judul(s, `${rendah.nama} baru mencapai ${angka(rendah.capaian)}% rencana`);
      pelacak(k, s, 7);
      s.addChart(k.pres.ChartType.bar, [{ name: "Capaian (%)", labels: L.map((t) => `${t.nama} (${t.realisasi}/${t.rencana})`), values: L.map((t) => t.capaian) }], { x: W.tepi, y: W.atas, w: 8.2, h: W.tinggi, barDir: "bar", altText: "Capaian target project", chartColors: L.map((t) => (t === rendah ? C.oranye : C.biruMuda)), barGapWidthPct: 45, showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", ...sumbu, valAxisHidden: true, valGridLine: { style: "none" }, valAxisMinVal: 0, valAxisMaxVal: 110 });
      const K = k.U.konten;
      catatan(k, s, W.sisi, W.atas, W.kertas - W.tepi - W.sisi, W.tinggi, "Content Plan", K.status.length ? K.status.map(([n, v]) => `${n}: ${v}`) : ["Tidak ada jadwal jatuh tempo."], { nilai: angka(K.n, 0), label: "konten jatuh tempo pada rentang ini" });
      sumberKaki(s, "Target Project adalah posisi terakhir, bukan nilai per rentang.");
    } },
  { id: "tindak-lanjut", judul: "Tindak lanjut", bagian: "Act", langkah: 8,
    syarat: (l) => (l.utama.kandidat.length ? null : "tidak ada bahan tindak lanjut"),
    buat(k) {
      const s = k.tambah("KONTEN", "Act");
      const w = (LEBAR - 0.4) / 2, utama = k.U.kandidat[0];
      judul(s, "Tindak lanjut untuk rentang berikutnya");
      pelacak(k, s, 8);
      [["Standarisasi", "SOP, instruksi kerja, dan standar parameter disusun setelah perbaikan terbukti."], ["Monitoring", "Buat laporan rentang berikutnya dan pilih rentang ini sebagai pembanding."], ["Pencatatan", "Lengkapi jenis pekerjaan, jam, dan penyebab pada data baru."]].forEach(([a, b], i) => {
        const tinggi = 1.57, y = W.atas + i * (tinggi + 0.195);
        kartu(k, s, W.tepi, y, w, tinggi);
        teks(s, a, { x: W.tepi + 0.3, y: y + 0.25, w: w - 0.6, h: 0.35, fontSize: 16, bold: true, color: C.navy });
        teks(s, b, { x: W.tepi + 0.3, y: y + 0.68, w: w - 0.6, h: 0.75 });
      });
      const x = W.tepi + w + 0.4;
      kartu(k, s, x, W.atas, w, W.tinggi, C.navy);
      teks(s, "Prioritas berikutnya", { x: x + 0.3, y: W.atas + 0.25, w: w - 0.6, h: 0.35, fontSize: 15, bold: true, color: C.garis });
      teks(s, utama.tema, { x: x + 0.3, y: W.atas + 0.75, w: w - 0.6, h: 1.6, fontFace: FONT_JUDUL, fontSize: 24, bold: true, color: C.putih });
      teks(s, `Kondisi saat ini: ${utama.bukti}.`, { x: x + 0.3, y: W.atas + 2.6, w: w - 0.6, h: 0.7, fontSize: 15, color: C.putih });
      teks(s, "Tema akhir dipilih tim bersama atasan.", { x: x + 0.3, y: W.atas + 3.4, w: w - 0.6, h: 0.5, color: C.garis });
      sumberKaki(s, `Periode ${k.U.label}. Prioritas diambil dari kandidat tema pertama.`);
    } },
  { id: "lampiran", judul: "Batasan data", bagian: "Lampiran", buat(k) {
    const s = k.tambah("KONTEN", "Lampiran");
    const w = (LEBAR - 0.4) / 2, T = k.U.tiket;
    judul(s, "Batasan data dan slide yang dilewati");
    catatan(k, s, W.tepi, W.atas, w, W.tinggi, "Batasan data", [
      `${T.tanpaWaktu} tiket tanpa catatan waktu mulai, tidak ikut dihitung.`,
      "Waktu dihitung pada jam kerja Senin–Jumat 08.00–17.00 WIB, tanpa tanggal merah.",
      `${T.nDue} tiket punya tenggat asli. Tiket impor tidak punya.`,
      "Fishbone berisi indikasi dari data, bukan akar masalah final.",
    ]);
    catatan(k, s, W.tepi + w + 0.4, W.atas, w, W.tinggi, "Slide yang dilewati", k.dilewati.length ? k.dilewati.slice(0, 7).concat(k.dilewati.length > 7 ? [`dan ${k.dilewati.length - 7} lainnya`] : []) : ["Tidak ada"]);
    sumberKaki(s, `Periode ${k.U.label}.`);
  } },
  { id: "penutup", judul: "Penutup", bagian: "Lampiran", buat(k) {
    const s = k.tambah("GELAP", "Lampiran");
    judul(s, "Berikutnya: pilih tema dan tetapkan target");
    teks(s, ["Konfirmasi fishbone dengan 5 Why bersama tim", "Pilih satu kandidat tema dan tetapkan target", "Bandingkan dengan laporan rentang berikutnya"].map((l, i) => ({ text: l, options: { bullet: { indent: 16 }, breakLine: i < 2, paraSpaceAfter: 8 } })), { x: W.tepi, y: 3.5, w: 10, h: 1.7, fontSize: 18, color: C.putih });
  } },
];

export type InfoSlide = { id: string; judul: string; langkah: number | null; alasan: string | null };

/** Daftar slide beserta alasan jika tidak bisa dibuat, untuk ditampilkan di halaman. */
export function daftarSlide(l: LaporanQcc): InfoSlide[] {
  return SLIDE.map((d) => ({ id: d.id, judul: d.judul, langkah: d.langkah ?? null, alasan: d.syarat?.(l) ?? null }));
}

export async function buatPpt(l: LaporanQcc, tanpa: string[] = []): Promise<Buffer> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = `Laporan QCC ${TIM}, ${l.utama.label}`;
  pres.author = TIM;
  pres.company = "Lourdes Auto Parts";
  pres.theme = { headFontFace: FONT_JUDUL, bodyFontFace: FONT_ISI };

  const logo = muatLogo();
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

  const dilewati: string[] = [];
  const aktif = SLIDE.filter((d) => {
    if (tanpa.includes(d.id)) return false;
    const alasan = d.syarat?.(l);
    if (alasan) dilewati.push(`${d.judul}: ${alasan}`);
    return !alasan;
  });

  const k: Konteks = {
    pres, U: l.utama, B: l.banding, dilewati, logo,
    tambah: (masterName, sectionTitle) => pres.addSlide({ masterName, sectionTitle }),
  };
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
