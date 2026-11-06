// Prototipe generator laporan QCC per rentang tanggal. Semua teks dibentuk dari data,
// jadi berlaku untuk rentang apa pun. Tiap slide punya syarat `when`; slide yang tidak
// memenuhi syarat dilewati dan dicatat di lampiran.
// Pakai: node deck.cjs <data.json> <logo.png> <output.pptx> <apply_theme.js> <isian.json | ->
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const [, , dataFile, logoFile, outFile, applyThemeFile, isianFile] = process.argv;
const { applyTheme } = require(applyThemeFile);
const { utama: U, banding: B, wlaItem } = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const I = isianFile && isianFile !== "-" ? JSON.parse(fs.readFileSync(isianFile, "utf8")) : {};
const TIM = "Tim Creative";

const THEME = {
  name: "QCC Creative", headFontFace: "Arial", bodyFontFace: "Calibri",
  colors: { dk1: "16232E", lt1: "FFFFFF", dk2: "0E3B5C", lt2: "EEF3F6", accent1: "00579B", accent2: "1A5E3A", accent3: "E8710A", accent4: "7FA6C4", accent5: "6B7A86", accent6: "C9D6DF", hlink: "00579B", folHlink: "6B7A86" },
};
const H = THEME.colors;
const W = 13.33, MX = 0.6, CW = W - MX * 2, TOP = 1.5, TINGGI = 5.1, SISI = 9.1;
const MIN_N = 10; // di bawah ini persentase tiket menyesatkan

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = `Laporan QCC ${TIM}, ${U.label}`;
pres.author = TIM;
pres.company = "Lourdes Auto Parts";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

const png = fs.readFileSync(logoFile);
const logoRatio = png.readUInt32BE(16) / png.readUInt32BE(20);
const LOGO_W = 1.15;

pres.defineSlideMaster({
  title: "KONTEN", background: { color: C.background1 },
  objects: [
    { image: { path: logoFile, x: W - MX - LOGO_W - 0.5, y: 6.82, w: LOGO_W, h: LOGO_W / logoRatio } },
    { placeholder: { options: { name: "title", type: "title", x: MX, y: 0.4, w: 9.9, h: 1.0, fontFace: THEME.headFontFace, fontSize: 28, bold: true, color: C.text2, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: W - MX - 0.4, y: 6.88, w: 0.4, h: 0.3, fontFace: THEME.bodyFontFace, fontSize: 11, color: C.accent5, align: "right" },
});
pres.defineSlideMaster({
  title: "GELAP", background: { color: C.text2 },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: MX, y: 2.1, w: 11.9, h: 2.1, fontFace: THEME.headFontFace, fontSize: 38, bold: true, color: C.background1, align: "left", valign: "top", margin: 0 }, text: "" } }],
});

// ---------- helper ----------
const num = (v, d = 1) => (v == null ? "-" : Number(v).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: d }));
const text = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top", ...o });
const judul = (s, t) => s.addText(t, { placeholder: "title" });

const PILL = {
  sistem: { label: "Data sistem", fill: "accent2" },
  contoh: { label: "Contoh isian", fill: "accent3" },
  campur: { label: "Data + contoh isian", fill: "accent1" },
};
function tracker(s, step) {
  const r = 0.21, gap = 0.035, x0 = W - MX - 8 * r - 7 * gap;
  for (let i = 1; i <= 8; i++) {
    const on = i === step;
    s.addText(String(i), { shape: pres.shapes.OVAL, objectName: `Langkah ${i}`, x: x0 + (i - 1) * (r + gap), y: 0.45, w: r, h: r, margin: 0, align: "center", valign: "middle", fontSize: 10, bold: on, color: on ? C.background1 : C.accent5, fill: { color: on ? C.accent3 : C.background2 } });
  }
}
function pill(s, kind) {
  const p = PILL[kind], w = 1.9;
  s.addText(p.label, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, objectName: "Asal data", x: W - MX - w, y: 0.78, w, h: 0.3, margin: 0, align: "center", valign: "middle", fontSize: 11, bold: true, color: C.background1, fill: { color: C[p.fill] } });
}
const caption = (s, t) => text(s, t, { x: MX, y: 6.82, w: 9.4, h: 0.4, fontSize: 11, color: C.accent5, valign: "middle", objectName: "Sumber" });
function card(s, x, y, w, h, fill = C.background2) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: "Kartu" });
}
function note(s, x, y, w, h, heading, lines, big) {
  card(s, x, y, w, h);
  text(s, heading, { x: x + 0.25, y: y + 0.22, w: w - 0.5, h: 0.32, bold: true, fontSize: 15, color: C.text2 });
  if (big) {
    text(s, big.nilai, { x: x + 0.25, y: y + 0.62, w: w - 0.5, h: 0.8, fontFace: THEME.headFontFace, fontSize: 34, bold: true, color: C.accent3, valign: "middle" });
    text(s, big.label, { x: x + 0.25, y: y + 1.45, w: w - 0.5, h: 0.55, fontSize: 14, color: C.accent5 });
    y += 1.5; h -= 1.5;
  }
  text(s, lines.map((l, i) => ({ text: l, options: { bullet: { indent: 14 }, breakLine: i < lines.length - 1, paraSpaceAfter: 7 } })), { x: x + 0.25, y: y + 0.62, w: w - 0.5, h: h - 0.8, fontSize: 14 });
}
function stat(s, x, y, w, value, label, color = C.accent1) {
  text(s, value, { x, y, w, h: 0.95, fontFace: THEME.headFontFace, fontSize: 44, bold: true, color, valign: "middle" });
  text(s, label, { x, y: y + 1.0, w, h: 0.75, fontSize: 14 });
}
const axis = {
  catAxisLabelColor: H.accent5, valAxisLabelColor: H.accent5, catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt",
  dataLabelFontSize: 12, dataLabelColor: H.dk1, legendFontSize: 12, legendColor: H.accent5, valGridLine: { color: H.accent6, size: 0.5 }, catGridLine: { style: "none" },
};
const sumbuY = (t) => ({ showValAxisTitle: true, valAxisTitle: t, valAxisTitleFontSize: 12, valAxisTitleColor: H.accent5, valAxisTitleFontFace: "+mn-lt" });
const sumbuX = (t) => ({ showCatAxisTitle: true, catAxisTitle: t, catAxisTitleFontSize: 12, catAxisTitleColor: H.accent5, catAxisTitleFontFace: "+mn-lt" });
function table(s, rows, o) {
  const head = { bold: true, color: C.background1, fill: { color: C.text2 }, valign: "middle" };
  const body = rows.map((r, i) => r.map((c) => { const cell = typeof c === "object" ? c : { text: String(c) }; return { text: cell.text, options: { ...(i === 0 ? head : { color: C.text1, valign: "middle" }), ...(cell.options || {}) } }; }));
  s.addTable(body, { fontSize: 14, border: { type: "solid", pt: 0.5, color: H.accent6 }, margin: [0.05, 0.1, 0.05, 0.1], ...o });
}
function chartPareto(s, P, satuan) {
  const warna = P.map((p, i) => (i === 0 || p.kumulatif <= 80 ? H.accent3 : H.accent4));
  s.addChart([
    { type: pres.charts.BAR, data: [{ name: `${satuan} (jam)`, labels: P.map((p) => p.nama), values: P.map((p) => p.jam) }], options: { chartColors: warna, barGapWidthPct: 45, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", ...axis } },
    { type: pres.charts.LINE, data: [{ name: "Kumulatif (%)", labels: P.map((p) => p.nama), values: P.map((p) => p.kumulatif) }], options: { chartColors: [H.dk2], lineSize: 2, lineDataSymbolSize: 7, secondaryValAxis: true, secondaryCatAxis: true, showValue: false } },
  ], {
    x: MX, y: TOP, w: 8.2, h: TINGGI, altText: `Diagram Pareto ${satuan}`, showLegend: true, legendPos: "b", ...axis,
    valAxes: [{ showValAxisTitle: true, valAxisTitle: "Jam", valAxisTitleFontSize: 12, valAxisTitleColor: H.accent5, valAxisLabelFontSize: 12, valAxisLabelColor: H.accent5, valAxisMinVal: 0, valGridLine: { color: H.accent6, size: 0.5 } }, { showValAxisTitle: true, valAxisTitle: "Kumulatif %", valAxisTitleFontSize: 12, valAxisTitleColor: H.accent5, valAxisLabelFontSize: 12, valAxisLabelColor: H.accent5, valAxisMinVal: 0, valAxisMaxVal: 100, valGridLine: { style: "none" } }],
    catAxes: [{ catAxisLabelFontSize: 12, catAxisLabelColor: H.accent5 }, { catAxisHidden: true }],
  });
}

// ---------- angka turunan ----------
const T = U.tiket, A = U.aktivitas, P = T.pareto, top = P[0], lama = T.terlama;
const sumber = `Periode ${U.label}.`;
const sumberTiket = `Sumber: tiket desain, ${U.label}, n = ${T.nWaktu} tiket dengan waktu lengkap.`;
const pctJenisKosong = A.n ? (A.tanpaJenis / A.n) * 100 : 0;
const skor = (x) => x.s.reduce((a, b) => a + b, 0);
const solusi = I.solusi ? [...I.solusi].sort((a, b) => skor(b) - skor(a)) : [];
const aspek = U.evaluasi.aspek.filter((a) => a.nilai != null);
const minAspek = aspek.length ? Math.min(...aspek.map((a) => a.nilai)) : null;
const aspekRendah = aspek.filter((a) => a.nilai === minAspek).map((a) => a.label);
const targetRendah = U.target[0];

const kandidat = [
  T.nWaktu >= MIN_N && T.lebih60 > 0 && { tema: "Meningkatkan tiket desain yang mulai diproses ≤ 60 menit", bukti: `${num(T.le60Pct)}% (${T.le60} dari ${T.nWaktu} tiket)`, sumber: "Tiket" },
  targetRendah && targetRendah.capaian < 80 && { tema: `Meningkatkan realisasi ${targetRendah.nama}`, bukti: `${num(targetRendah.capaian)}% dari rencana`, sumber: "Target Project" },
  pctJenisKosong > 10 && { tema: "Meningkatkan kelengkapan pencatatan Daily Activity", bukti: `${num(pctJenisKosong)}% entri tanpa jenis pekerjaan`, sumber: "Daily Activity" },
  aspek.length > 0 && { tema: `Meningkatkan nilai ${aspekRendah.join(" dan ")} pada evaluasi desain`, bukti: `Skor ${num(minAspek, 2)} dari 5, terendah dari ${aspek.length} aspek`, sumber: "Evaluasi" },
].filter(Boolean);

function baris(label, a, b, polaritas, satuan = "", d = 1) {
  let hasil = "Netral", warna = C.accent5;
  if (a == null || b == null) hasil = "Tidak ada data";
  else if (polaritas && b !== 0 && Math.abs(a - b) / Math.abs(b) < 0.05) hasil = "Hampir sama";
  else if (polaritas) {
    const baik = polaritas === "Max" ? a > b : a < b;
    hasil = baik ? "Membaik" : "Menurun"; warna = baik ? C.accent2 : C.accent3;
  }
  return [label, `${num(b, d)}${b == null ? "" : satuan}`, `${num(a, d)}${a == null ? "" : satuan}`, { text: hasil, options: { bold: true, color: warna } }];
}

// ---------- daftar slide ----------
const SLIDES = [
  { id: "sampul", section: "Pembuka", render() {
    const s = add("GELAP", "Pembuka");
    judul(s, `Laporan QCC ${TIM}`);
    text(s, U.label, { x: MX, y: 3.0, w: 11, h: 0.5, fontSize: 24, bold: true, color: C.accent6 });
    if (B) text(s, `Pembanding: ${B.label}`, { x: MX, y: 3.6, w: 11, h: 0.4, fontSize: 16, color: C.accent6 });
    card(s, MX, 6.05, 1.65, 0.75, C.background1);
    s.addImage({ path: logoFile, x: MX + 0.17, y: 6.05 + (0.75 - 1.3 / logoRatio) / 2, w: 1.3, h: 1.3 / logoRatio, altText: "Logo Lourdes Auto Parts" });
  } },
  { id: "ringkasan", section: "Pembuka", render() {
    const s = add("KONTEN", "Pembuka");
    judul(s, T.le60Pct == null ? "Ringkasan periode" : T.nWaktu < MIN_N ? `${T.le60} dari ${T.nWaktu} tiket mulai diproses dalam 60 menit` : `${num(T.le60Pct)}% tiket mulai diproses dalam 60 menit`);
    pill(s, "sistem");
    const w = 3.65, g = 0.39;
    stat(s, MX, TOP + 0.2, w, num(T.n, 0), `tiket desain masuk, ${T.nWaktu} punya catatan waktu lengkap`, C.accent1);
    stat(s, MX + w + g, TOP + 0.2, w, `${num(T.medianTunggu)} menit`, `median waktu tunggu, median kerja ${num(T.medianKerja)} menit`, C.accent2);
    stat(s, MX + 2 * (w + g), TOP + 0.2, w, `${num(A.jamTercatat)} jam`, `kerja tercatat di Daily Activity dari ${A.nBerjam} entri berjam`, C.accent3);
    const poin = [
      lama && `Tiket terlama menunggu ${num(lama.menit, 0)} menit (${lama.tgl}, ${lama.jenis}).`,
      U.kehadiran.hariKerja > 0 && `Kehadiran ${num(U.kehadiran.ratePct)}% dari ${U.kehadiran.hariKerja} kehadiran wajib.`,
      "Waktu tiket dihitung per jam kalender, jadi malam dan hari libur ikut terhitung.",
    ].filter(Boolean);
    note(s, MX, 4.0, CW, 2.3, "Yang perlu diperhatikan", poin);
    caption(s, `${sumber} Waktu tunggu = tiket dibuat sampai mulai diproses.`);
  } },
  { id: "peta-data", section: "Pembuka", render() {
    const s = add("KONTEN", "Pembuka");
    judul(s, "Semua sumber data pada rentang ini");
    pill(s, "sistem");
    const k = U.konten;
    table(s, [
      ["Sumber", "Data pada rentang", "Dipakai untuk"],
      ["Tiket desain", `${T.n} tiket`, "Pareto, histogram, control chart, scatter"],
      ["Rating dan revisi", `${U.suara.nDinilai} dinilai, ${U.suara.tiketRevisi} direvisi`, "Suara pelanggan"],
      ["Daily Activity", `${A.n} entri, ${num(A.jamTercatat)} jam`, "Beban kerja per jenis"],
      ["Attendance", `${U.kehadiran.hariKerja} kehadiran wajib`, "Faktor Man"],
      ["Safety Toolbox", `${U.safety.sesi} kehadiran terjadwal`, "Aspek Safety"],
      ["Content Plan", `${k.n} jadwal jatuh tempo`, "Capaian rencana"],
      ["Target Project", `${U.target.length} target aktif`, "Capaian rencana"],
      ["Evaluasi Designer", `${U.evaluasi.n} penilaian`, "Grafik radar aspek"],
    ], { x: MX, y: TOP, w: CW, colW: [3.2, 4.0, 4.93], rowH: 0.5 });
    caption(s, `${sumber} WLA (${wlaItem} item) tidak berperiode, jadi tidak ikut difilter.`);
  } },
  { id: "pareto", step: 1, section: "Plan", when: () => T.nWaktu >= MIN_N && P.length >= 4, skip: "Pareto tiket butuh minimal 10 tiket dan 4 faktor", render() {
    const s = add("KONTEN", "Plan");
    judul(s, `${top.nama} menyumbang ${num(top.kumulatif)}% total waktu tunggu`);
    tracker(s, 1); pill(s, "sistem");
    chartPareto(s, P, "Waktu tunggu");
    const poin = [`Dari ${top.n} tiket ${top.nama}.`];
    if (lama && lama.jenis === top.nama) poin.push(`Tiket terlama ${lama.kode} menyumbang ${num(lama.menit / 60)} jam.`);
    note(s, SISI, TOP, W - MX - SISI, TINGGI, "Cara membaca", poin, { nilai: `${num(top.jam)} jam`, label: `waktu tunggu ${top.nama}` });
    caption(s, `${sumberTiket} Jenis desain dinormalisasi.`);
  } },
  { id: "stratifikasi", step: 1, section: "Plan", when: () => T.nWaktu >= MIN_N && T.paretoDivisi.length >= 2, skip: "Stratifikasi butuh minimal 10 tiket dan 2 divisi", render() {
    const s = add("KONTEN", "Plan");
    const Q = T.paretoDivisi, d = Q[0];
    judul(s, `Tiket ${d.nama} menanggung ${num(d.kumulatif)}% waktu tunggu`);
    tracker(s, 1); pill(s, "sistem");
    s.addChart(pres.charts.BAR, [{ name: "Waktu tunggu (jam)", labels: Q.map((q) => `${q.nama} (${q.n} tiket)`).reverse(), values: Q.map((q) => q.jam).reverse() }], {
      x: MX, y: TOP, w: 8.2, h: TINGGI, barDir: "bar", altText: "Waktu tunggu per divisi pemohon", chartColors: Q.map((q) => (q === d ? H.accent3 : H.accent4)).reverse(), barGapWidthPct: 45, showLegend: false,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", ...axis, valAxisHidden: true, valGridLine: { style: "none" },
    });
    note(s, SISI, TOP, W - MX - SISI, TINGGI, "Stratifikasi Who", [`${d.nama} mengajukan ${d.n} dari ${T.nWaktu} tiket.`, "Bandingkan jumlah tiket dengan jam tunggunya."], { nilai: `${num(d.jam)} jam`, label: `waktu tunggu tiket ${d.nama}` });
    caption(s, `${sumberTiket} Nama divisi disatukan, mis. HR menjadi HR/GA.`);
  } },
  { id: "kandidat-tema", step: 1, section: "Plan", when: () => kandidat.length > 0, skip: "Tidak ada kandidat tema dari data", render() {
    const s = add("KONTEN", "Plan");
    judul(s, `Data periode ini memunculkan ${kandidat.length} kandidat tema`);
    tracker(s, 1); pill(s, "sistem");
    table(s, [["Kandidat tema", "Bukti", "Sumber"], ...kandidat.map((k) => [k.tema, k.bukti, k.sumber])], { x: MX, y: TOP, w: CW, colW: [6.3, 3.83, 2.0], rowH: 0.72 });
    const y = TOP + 0.72 * (kandidat.length + 1) + 0.3;
    note(s, MX, y, CW, Math.min(1.75, 6.6 - y), "Aturan penulisan tema", ["Diawali kata kerja, satu masalah, dan tidak menyebut solusi. Tim memilih tema dan menentukan nilai targetnya."]);
    caption(s, `${sumber} Kandidat disusun otomatis dari aturan data.`);
  } },
  { id: "histogram", step: 2, section: "Plan", when: () => T.nWaktu >= MIN_N, skip: "Histogram butuh minimal 10 tiket", render() {
    const s = add("KONTEN", "Plan");
    judul(s, `${T.lebih60} tiket menunggu lebih dari satu jam`);
    tracker(s, 2); pill(s, "sistem");
    s.addChart(pres.charts.BAR, [{ name: "Jumlah tiket", labels: T.histogram.map((h) => h.label), values: T.histogram.map((h) => h.n) }], {
      x: MX, y: TOP, w: 8.2, h: TINGGI, altText: "Histogram waktu tunggu tiket", chartColors: T.histogram.map((_, i) => (i < 2 ? H.accent4 : H.accent3)), barGapWidthPct: 8, showLegend: false,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", ...axis, ...sumbuY("Jumlah tiket"), valAxisMinVal: 0,
    });
    note(s, SISI, TOP, W - MX - SISI, TINGGI, "Temuan", [`${T.le60} tiket mulai diproses dalam 60 menit.`, "Jika rata-rata jauh di atas median, beberapa tiket ekstrem mendorong angkanya."], { nilai: `${num(T.medianTunggu)} menit`, label: `median, sedangkan rata-rata ${num(T.rataTunggu, 0)} menit` });
    caption(s, `${sumberTiket} Lebar kelas tidak sama.`);
  } },
  { id: "kendali", step: 2, section: "Plan", when: () => T.nWaktu >= 20, skip: "Control chart butuh minimal 20 titik", render() {
    const s = add("KONTEN", "Plan");
    const K = T.kendali, labels = K.titik.map((_, i) => String(i + 1));
    judul(s, K.diLuar ? `${K.diLuar} tiket berada di luar batas kendali` : "Waktu tunggu berada dalam batas kendali");
    tracker(s, 2); pill(s, "sistem");
    s.addChart(pres.charts.LINE, [
      { name: "Waktu tunggu", labels, values: K.titik },
      { name: `UCL ${num(K.ucl, 0)}`, labels, values: K.titik.map(() => K.ucl) },
      { name: `Rata-rata ${num(K.cl, 0)}`, labels, values: K.titik.map(() => K.cl) },
    ], { x: MX, y: TOP, w: 8.2, h: TINGGI, altText: "Peta kendali individu waktu tunggu per tiket", chartColors: [H.accent1, H.accent3, H.accent2], lineSize: 2, lineDataSymbol: "none", showLegend: true, legendPos: "b", ...axis, ...sumbuY("Menit"), ...sumbuX("Urutan tiket"), catAxisLabelFontSize: 10, catAxisLabelFrequency: 4, valAxisMinVal: 0 });
    note(s, SISI, TOP, W - MX - SISI, TINGGI, "Temuan", ["Periksa penyebab khusus tiap titik di atas UCL.", "Data sangat miring, jadi baca batas ini sebagai sinyal."], { nilai: `${num(lama.menit, 0)} menit`, label: `tertinggi: ${lama.kode}, ${lama.tgl}` });
    caption(s, `${sumberTiket} Peta individu: UCL = rata-rata + 2,66 × rata-rata moving range.`);
  } },
  { id: "beban-kerja", step: 2, section: "Plan", when: () => A.pareto.length >= 4, skip: "Beban kerja butuh minimal 4 jenis pekerjaan berjam", render() {
    const s = add("KONTEN", "Plan");
    const b = A.pareto[0];
    judul(s, `${b.nama} menyerap ${num(b.kumulatif)}% jam kerja tercatat`);
    tracker(s, 2); pill(s, "sistem");
    chartPareto(s, A.pareto, "Jam kerja");
    note(s, SISI, TOP, W - MX - SISI, TINGGI, "Daily Activity", [`${A.nBerjam} dari ${A.n} entri punya jam mulai dan selesai.`, `${A.tanpaJenis} entri belum punya jenis pekerjaan.`], { nilai: `${num(A.jamTercatat)} jam`, label: "total jam tercatat" });
    caption(s, `Sumber: Daily Activity, ${U.label}. Hanya entri yang punya jam.`);
  } },
  { id: "kehadiran", step: 2, section: "Plan", when: () => U.kehadiran.hariKerja > 0 || U.safety.sesi > 0, skip: "Tidak ada data Attendance dan Safety Toolbox", render() {
    const s = add("KONTEN", "Plan");
    const h = U.kehadiran, f = U.safety;
    judul(s, [h.ratePct != null && `Kehadiran ${num(h.ratePct)}%`, f.ratePct != null && `Safety Toolbox ${num(f.ratePct)}%`].filter(Boolean).join(" dan "));
    tracker(s, 2); pill(s, "sistem");
    const w = (CW - 0.4) / 2;
    [[h.ratePct, "Kehadiran kerja", h.hariKerja ? `${h.hadir} hadir, ${h.absen} absen dari ${h.hariKerja} kehadiran wajib` : "Tidak ada data pada rentang ini", MX], [f.ratePct, "Safety Toolbox Meeting", f.sesi ? `${f.hadir} hadir dari ${f.sesi} kehadiran terjadwal` : "Tidak ada data pada rentang ini", MX + w + 0.4]].forEach(([v, l, d, x]) => {
      card(s, x, TOP, w, 3.0);
      text(s, l, { x: x + 0.3, y: TOP + 0.3, w: w - 0.6, h: 0.35, fontSize: 16, bold: true, color: C.text2 });
      text(s, v == null ? "Belum ada" : `${num(v)}%`, { x: x + 0.3, y: TOP + 0.8, w: w - 0.6, h: 1.0, fontFace: THEME.headFontFace, fontSize: v == null ? 28 : 44, bold: true, color: v == null ? C.accent5 : C.accent2, valign: "middle" });
      text(s, d, { x: x + 0.3, y: TOP + 2.0, w: w - 0.6, h: 0.7, fontSize: 14 });
    });
    note(s, MX, TOP + 3.3, CW, 1.8, "Kaitan dengan analisa", ["Dipakai sebagai faktor Man pada 4M1E. Kehadiran rendah bisa menjelaskan antrean tiket, kehadiran tinggi berarti penyebabnya ada di tempat lain."]);
    caption(s, `Sumber: Attendance dan Safety Toolbox, ${U.label}.`);
  } },
  { id: "target", step: 3, section: "Plan", when: () => I.target && T.nWaktu >= MIN_N, skip: "Target belum diisi tim", render() {
    const s = add("KONTEN", "Plan");
    const t = I.target.persen;
    judul(s, `Target naik ${num(t - T.le60Pct)} poin dari kondisi saat ini`);
    tracker(s, 3); pill(s, "campur");
    s.addChart(pres.charts.BAR, [{ name: "Tiket ≤ 60 menit (%)", labels: ["Saat ini", "Target"], values: [T.le60Pct, t] }], { x: MX, y: TOP, w: 5.6, h: TINGGI, altText: "Kondisi saat ini dan target", chartColors: [H.accent4, H.accent3], barGapWidthPct: 60, showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", ...axis, ...sumbuY("Persen tiket"), valAxisMinVal: 0, valAxisMaxVal: 100 });
    const x = 6.6, w = W - MX - x;
    [["S", "Spesifik", "Tiket desain yang mulai diproses ≤ 60 menit"], ["M", "Terukur", "Waktu dibuat sampai mulai diproses"], ["A", "Menantang", `Dari ${T.le60} menjadi sekitar ${Math.ceil((t / 100) * T.nWaktu)} dari ${T.nWaktu} tiket`], ["R", "Relevan", "Mendukung KPI ketepatan waktu"], ["T", "Berbatas waktu", "Dievaluasi dengan rentang berikutnya"]].forEach(([l, h, d], i) => {
      const y = TOP + i * 1.02;
      s.addText(l, { shape: pres.shapes.OVAL, objectName: "Huruf SMART", x, y: y + 0.08, w: 0.62, h: 0.62, margin: 0, align: "center", valign: "middle", fontSize: 18, bold: true, color: C.background1, fill: { color: C.accent1 } });
      text(s, h, { x: x + 0.82, y, w: w - 0.82, h: 0.34, fontSize: 15, bold: true, color: C.text2 });
      text(s, d, { x: x + 0.82, y: y + 0.36, w: w - 0.82, h: 0.5, fontSize: 14 });
    });
    caption(s, `Nilai saat ini dari data tiket. Target ${t}% adalah contoh isian.`);
  } },
  { id: "scatter", step: 4, section: "Plan", when: () => T.nWaktu >= MIN_N && T.scatter.r != null, skip: "Scatter butuh minimal 10 tiket", render() {
    const s = add("KONTEN", "Plan");
    const r = T.scatter.r, lemah = Math.abs(r) < 0.3;
    judul(s, lemah ? "Waktu tunggu tidak berkaitan dengan lama pengerjaan" : "Waktu tunggu berkaitan dengan lama pengerjaan");
    tracker(s, 4); pill(s, "sistem");
    s.addChart(pres.charts.SCATTER, [{ name: "Waktu kerja (menit)", values: T.scatter.x }, { name: "Waktu tunggu (menit)", values: T.scatter.y }], {
      x: MX, y: TOP, w: 8.2, h: TINGGI, altText: "Diagram pencar waktu kerja dan waktu tunggu", chartColors: [H.accent1], lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 8, showLegend: false, ...axis,
      showTitle: true, title: "Waktu tunggu (menit) terhadap waktu kerja", titleFontSize: 14, titleColor: H.dk2, titleFontFace: "+mn-lt", ...sumbuX("Waktu kerja (menit)"), valAxisMinVal: 0, catAxisMinVal: 0,
    });
    note(s, SISI, TOP, W - MX - SISI, TINGGI, "Korelasi", lemah ? ["Tiket yang lama dikerjakan belum tentu lama menunggu.", "Analisa diarahkan ke alur masuk tiket."] : ["Tiket yang lama dikerjakan cenderung berbeda waktu tunggunya.", "Periksa hubungan ini bersama tim."], { nilai: `r = ${num(r, 2)}`, label: lemah ? "hubungan lemah" : "ada hubungan" });
    caption(s, `${sumberTiket} Korelasi Pearson, peka terhadap nilai ekstrem.`);
  } },
  { id: "fishbone", step: 4, section: "Plan", when: () => I.fishbone, skip: "Fishbone belum diisi tim", render() {
    const s = add("KONTEN", "Plan");
    judul(s, "Penyebab diduga ada pada alur brief dan antrean");
    tracker(s, 4); pill(s, "contoh");
    const spineY = 4.0, headX = 10.55;
    s.addShape(pres.shapes.LINE, { x: MX, y: spineY, w: headX - MX, h: 0, line: { color: C.text2, width: 3 }, objectName: "Tulang utama" });
    card(s, headX, spineY - 0.85, W - MX - headX, 1.7, C.text2);
    text(s, `${T.lebih60} tiket menunggu lebih dari 60 menit`, { x: headX + 0.15, y: spineY - 0.72, w: W - MX - headX - 0.3, h: 1.45, fontSize: 15, bold: true, color: C.background1, valign: "middle" });
    const colW = 3.25, hgt = 1.65;
    const bone = (f, x, atas) => {
      s.addShape(pres.shapes.LINE, { x: x + 0.15, y: atas ? spineY - hgt : spineY, w: 0.55, h: hgt, flipV: !atas, line: { color: C.accent1, width: 2 }, objectName: `Tulang ${f.faktor}` });
      s.addText(f.faktor, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, objectName: `Faktor ${f.faktor}`, x, y: atas ? spineY - hgt - 0.36 : spineY + hgt, w: 1.4, h: 0.36, margin: 0, align: "center", valign: "middle", fontSize: 14, bold: true, color: C.background1, fill: { color: C.accent1 } });
      const runs = f.sebab.map((t, i) => ({ text: t, options: { bold: f.akar === i, color: f.akar === i ? C.accent3 : C.text1, breakLine: i < f.sebab.length - 1, paraSpaceAfter: 3 } }));
      text(s, runs, { x: x + 0.82, y: atas ? spineY - hgt + 0.1 : spineY + 0.15, w: colW - 0.95, h: hgt - 0.25, fontSize: 14 });
    };
    I.fishbone.filter((f) => f.atas).forEach((f, i) => bone(f, MX + i * colW, true));
    I.fishbone.filter((f) => !f.atas).forEach((f, i) => bone(f, MX + i * colW, false));
    text(s, [{ text: "Oranye tebal", options: { bold: true, color: C.accent3 } }, { text: " = akar masalah terpilih setelah 5 Why." }], { x: MX + 2 * colW + 0.15, y: 5.0, w: 5.2, h: 0.32, fontSize: 14 });
    caption(s, `Isi fishbone adalah contoh isian. Angka ${T.lebih60} tiket dari data sistem.`);
  } },
  { id: "pareto-penyebab", step: 4, section: "Plan", when: () => false, skip: "Pareto penyebab menunggu kode penyebab pada tiket baru", render() {} },
  { id: "matriks", step: 5, section: "Plan", when: () => solusi.length > 0, skip: "Matriks solusi belum diisi tim", render() {
    const s = add("KONTEN", "Plan");
    const seri = solusi.length > 1 && skor(solusi[0]) === skor(solusi[1]);
    judul(s, seri ? "Dua ide perbaikan mendapat skor tertinggi yang sama" : `${solusi[0].ide} mendapat skor tertinggi`);
    tracker(s, 5); pill(s, "contoh");
    const ctr = (t, e = {}) => ({ text: String(t), options: { align: "center", ...e } });
    table(s, [
      ["Akar masalah", "Ide perbaikan", ctr("Biaya"), ctr("Waktu"), ctr("Kualitas"), ctr("Risiko"), ctr("Total")],
      ...solusi.map((x, i) => [x.akar, x.ide, ...x.s.map((v) => ctr(v)), ctr(skor(x), { bold: true, color: i === 0 ? C.background1 : C.text1, fill: { color: i === 0 ? C.accent3 : C.background2 } })]),
    ], { x: MX, y: TOP + 0.1, w: CW, colW: [3.1, 3.63, 1.05, 1.05, 1.15, 1.05, 1.1], rowH: 0.72 });
    note(s, MX, 4.8, CW, 1.7, "Cara memberi skor", ["Skala 1 sampai 5 untuk tiap aspek. Skor 5 berarti biaya rendah, cepat, kualitas baik, dan risiko rendah.", "Total dihitung otomatis, lalu diputuskan bersama Facilitator."]);
    caption(s, "Akar masalah, ide, dan skor adalah contoh isian.");
  } },
  { id: "5w2h", step: 5, section: "Plan", when: () => I.w2h, skip: "5W2H belum diisi tim", render() {
    const s = add("KONTEN", "Plan");
    judul(s, "Rencana perbaikan terpilih dalam format 5W2H");
    tracker(s, 5); pill(s, "contoh");
    const w = (CW - 0.3) / 2, ch = 1.08, g = 0.14;
    I.w2h.forEach(([k, v], i) => {
      const x = MX + (i < 4 ? 0 : 1) * (w + 0.3), y = TOP + (i < 4 ? i : i - 4) * (ch + g);
      card(s, x, y, w, ch);
      text(s, k, { x: x + 0.25, y, w: 1.35, h: ch, fontFace: THEME.headFontFace, fontSize: 16, bold: true, color: C.accent1, valign: "middle" });
      text(s, v, { x: x + 1.65, y, w: w - 1.85, h: ch, fontSize: 14, valign: "middle" });
    });
    if (solusi.length) {
      const sx = MX + w + 0.3, sy = TOP + 3 * (ch + g);
      card(s, sx, sy, w, ch, C.text2);
      text(s, `${skor(solusi[0])} / 20`, { x: sx + 0.25, y: sy, w: 1.6, h: ch, fontFace: THEME.headFontFace, fontSize: 22, bold: true, color: C.background1, valign: "middle" });
      text(s, "skor matriks ide terpilih", { x: sx + 1.95, y: sy, w: w - 2.15, h: ch, fontSize: 14, color: C.background1, valign: "middle" });
    }
    caption(s, "Semua isi 5W2H adalah contoh isian.");
  } },
  { id: "pelaksanaan", step: 6, section: "Do", when: () => I.pelaksanaan, skip: "Pelaksanaan perbaikan belum diisi tim", render() {} },
  { id: "perbandingan", step: 7, section: "Check", when: () => B, skip: "Rentang pembanding tidak dipilih", render() {
    const s = add("KONTEN", "Check");
    const a = T.le60Pct, b = B.tiket.le60Pct, d = a != null && b != null ? a - b : null;
    judul(s, d == null ? "Perbandingan dua rentang" : d === 0 ? "Tiket ≤ 60 menit tidak berubah" : `Tiket ≤ 60 menit ${d > 0 ? "naik" : "turun"} ${num(Math.abs(d))} poin`);
    tracker(s, 7); pill(s, "sistem");
    const persenKosong = (x) => (x.aktivitas.n ? (x.aktivitas.tanpaJenis / x.aktivitas.n) * 100 : null);
    table(s, [
      ["Metrik", "Pembanding", "Periode ini", "Arah"],
      baris("Tiket mulai diproses ≤ 60 menit", a, b, "Max", "%"),
      baris("Median waktu tunggu", T.medianTunggu, B.tiket.medianTunggu, "Min", " menit"),
      baris("Median waktu kerja", T.medianKerja, B.tiket.medianKerja, null, " menit"),
      baris("Jumlah tiket masuk", T.n, B.tiket.n, null, "", 0),
      baris("Entri Daily Activity tanpa jenis", persenKosong(U), persenKosong(B), "Min", "%"),
      baris("Kehadiran kerja", U.kehadiran.ratePct, B.kehadiran.ratePct, "Max", "%"),
      baris("Kehadiran Safety Toolbox", U.safety.ratePct, B.safety.ratePct, "Max", "%"),
    ], { x: MX, y: TOP, w: CW, colW: [5.33, 2.4, 2.4, 2.0], rowH: 0.58 });
    caption(s, `Periode ini ${U.label}, n = ${T.nWaktu}. Pembanding ${B.label}, n = ${B.tiket.nWaktu}. Selisih kecil pada data sedikit belum tentu berarti.`);
  } },
  { id: "suara", step: 7, section: "Check", when: () => aspek.length > 0, skip: "Tidak ada data Evaluasi Designer", render() {
    const s = add("KONTEN", "Check");
    judul(s, `${aspekRendah.join(" dan ")} menjadi aspek evaluasi terendah`);
    tracker(s, 7); pill(s, "sistem");
    s.addChart(pres.charts.RADAR, [{ name: "Rata-rata tim", labels: aspek.map((a) => a.label), values: aspek.map((a) => a.nilai) }], { x: MX, y: TOP, w: 8.2, h: TINGGI, altText: "Grafik radar aspek evaluasi desain", radarStyle: "marker", chartColors: [H.accent1], lineSize: 2, showLegend: false, ...axis, valAxisMinVal: 0, valAxisMaxVal: 5, valAxisMajorUnit: 1, catAxisLabelFontSize: 14 });
    const poin = [`Rata-rata tim dari ${U.evaluasi.n} penilaian, bukan nilai per orang.`];
    if (U.suara.nDinilai) poin.push(`Rating pemohon rata-rata ${num(U.suara.rataRating)} dari ${U.suara.nDinilai} tiket.`);
    if (U.suara.nTiketDb) poin.push(`${U.suara.tiketRevisi} dari ${U.suara.nTiketDb} tiket direvisi.`);
    note(s, SISI, TOP, W - MX - SISI, TINGGI, "Suara pelanggan", poin, { nilai: `${num(minAspek, 2)} / 5`, label: "skor aspek terendah" });
    caption(s, `Sumber: Evaluasi Designer, rating, dan revisi tiket. ${sumber}`);
  } },
  { id: "capaian", step: 7, section: "Check", when: () => U.target.length > 0, skip: "Tidak ada Target Project aktif", render() {
    const s = add("KONTEN", "Check");
    judul(s, `${targetRendah.nama} baru mencapai ${num(targetRendah.capaian)}% rencana`);
    tracker(s, 7); pill(s, "sistem");
    const L = [...U.target].reverse();
    s.addChart(pres.charts.BAR, [{ name: "Capaian (%)", labels: L.map((t) => `${t.nama} (${t.realisasi}/${t.rencana})`), values: L.map((t) => t.capaian) }], { x: MX, y: TOP, w: 8.2, h: TINGGI, barDir: "bar", altText: "Capaian target project", chartColors: L.map((t) => (t === targetRendah ? H.accent3 : H.accent4)), barGapWidthPct: 45, showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", ...axis, valAxisHidden: true, valGridLine: { style: "none" }, valAxisMinVal: 0, valAxisMaxVal: 110 });
    const k = U.konten, st = Object.entries(k.status).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n}: ${v}`);
    note(s, SISI, TOP, W - MX - SISI, TINGGI, "Content Plan", st.length ? st : ["Tidak ada jadwal jatuh tempo."], { nilai: num(k.n, 0), label: "konten jatuh tempo pada rentang ini" });
    caption(s, "Target Project adalah posisi terakhir, bukan nilai per rentang.");
  } },
  { id: "tindak-lanjut", step: 8, section: "Act", when: () => kandidat.length > 0, skip: "Tidak ada bahan tindak lanjut", render() {
    const s = add("KONTEN", "Act");
    judul(s, "Tindak lanjut untuk rentang berikutnya");
    tracker(s, 8); pill(s, "sistem");
    const w = (CW - 0.4) / 2;
    [["Standarisasi", "SOP, instruksi kerja, dan standar parameter diisi tim setelah perbaikan terbukti."], ["Monitoring", "Buat laporan rentang berikutnya dan pilih rentang ini sebagai pembanding."], ["Pencatatan", "Lengkapi jenis pekerjaan, jam, dan kode penyebab pada data baru."]].forEach(([k, v], i) => {
      const ch = 1.57, y = TOP + i * (ch + 0.195);
      card(s, MX, y, w, ch);
      text(s, k, { x: MX + 0.3, y: y + 0.25, w: w - 0.6, h: 0.35, fontSize: 16, bold: true, color: C.text2 });
      text(s, v, { x: MX + 0.3, y: y + 0.68, w: w - 0.6, h: 0.75, fontSize: 14 });
    });
    const x = MX + w + 0.4;
    card(s, x, TOP, w, TINGGI, C.text2);
    text(s, "Prioritas berikutnya", { x: x + 0.3, y: TOP + 0.25, w: w - 0.6, h: 0.35, fontSize: 15, bold: true, color: C.accent6 });
    text(s, kandidat[0].tema, { x: x + 0.3, y: TOP + 0.75, w: w - 0.6, h: 1.8, fontFace: THEME.headFontFace, fontSize: 24, bold: true, color: C.background1 });
    text(s, `Kondisi saat ini: ${kandidat[0].bukti}.`, { x: x + 0.3, y: TOP + 2.45, w: w - 0.6, h: 0.7, fontSize: 15, color: C.background1 });
    text(s, "Tema akhir dipilih tim bersama atasan.", { x: x + 0.3, y: TOP + 3.3, w: w - 0.6, h: 0.5, fontSize: 14, color: C.accent6 });
    caption(s, `${sumber} Prioritas diambil dari kandidat tema pertama.`);
  } },
  { id: "lampiran", section: "Lampiran", render() {
    const s = add("KONTEN", "Lampiran");
    judul(s, "Batasan data dan slide yang dilewati");
    pill(s, "sistem");
    const w = (CW - 0.4) / 2, h = 2.9;
    note(s, MX, TOP, w, h, "Batasan data", [`${T.tanpaWaktu} tiket tanpa catatan waktu mulai, tidak ikut dihitung.`, "Waktu dihitung per jam kalender.", "Jenis desain dinormalisasi dari teks bebas.", "Tiket impor tidak punya due date asli."]);
    note(s, MX + w + 0.4, TOP, w, h, "Slide yang dilewati", SKIPPED.length ? SKIPPED.slice(0, 5).concat(SKIPPED.length > 5 ? [`dan ${SKIPPED.length - 5} lainnya`] : []) : ["Tidak ada"]);
    text(s, "Arti label asal data", { x: MX, y: TOP + h + 0.25, w: CW, h: 0.35, fontSize: 16, bold: true, color: C.text2 });
    [["sistem", "Dihitung dari data pada rentang"], ["contoh", "Isian ilustrasi, bukan hasil tim"], ["campur", "Gabungan keduanya"]].forEach(([k, d], i) => {
      const p = PILL[k], cw = (CW - 0.6) / 3, x = MX + i * (cw + 0.3), y = TOP + h + 0.7;
      s.addText(p.label, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, objectName: "Label", x, y, w: 1.9, h: 0.32, margin: 0, align: "center", valign: "middle", fontSize: 12, bold: true, color: C.background1, fill: { color: C[p.fill] } });
      text(s, d, { x, y: y + 0.42, w: cw, h: 0.35, fontSize: 14 });
    });
    caption(s, sumber);
  } },
  { id: "penutup", section: "Lampiran", render() {
    const s = add("GELAP", "Lampiran");
    judul(s, "Berikutnya: pilih tema dan tetapkan target");
    text(s, ["Pilih satu kandidat tema bersama atasan", "Isi analisa sebab akibat dan rencana perbaikan", "Bandingkan dengan laporan rentang berikutnya"].map((l, i) => ({ text: l, options: { bullet: { indent: 16 }, breakLine: i < 2, paraSpaceAfter: 8 } })), { x: MX, y: 3.5, w: 10, h: 1.7, fontSize: 18, color: C.background1 });
  } },
];

const SKIPPED = [];
const add = (masterName, sectionTitle) => pres.addSlide({ masterName, sectionTitle });
const aktif = SLIDES.filter((x) => { const ok = !x.when || x.when(); if (!ok) SKIPPED.push(x.skip); return ok; });
let bagian = null;
for (const sl of aktif) {
  if (sl.section !== bagian) { pres.addSection({ title: sl.section }); bagian = sl.section; }
  sl.render();
}

(async () => {
  await pres.writeFile({ fileName: outFile });
  await applyTheme(outFile, THEME);
  console.log(`OK ${aktif.length} slide [${aktif.map((x) => x.id).join(", ")}]`);
  console.log(`Dilewati ${SKIPPED.length}: ${SKIPPED.join("; ")}`);
})();
