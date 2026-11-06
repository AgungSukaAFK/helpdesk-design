// Prototipe: hitung semua metrik QCC untuk satu rentang tanggal (+ pembanding opsional).
// Di aplikasi, sumbernya tabel Supabase; bentuk keluaran JSON ini tetap sama.
// Pakai: node metrics.cjs <data-to-import> <tools-creative.json> <out.json> <mulai> <selesai> [banding-mulai banding-selesai]
const XLSX = require("xlsx"), path = require("path"), fs = require("fs");
const [, , base, toolsFile, outFile, mulai, selesai, bMulai, bSelesai] = process.argv;

const TIKET = ["Laporan_Tiket_Design_01Aug26_sd_31Aug26.xlsx", "Laporan_Tiket_Design_01Sep26_sd_30Sep26.xlsx", "Laporan_Tiket_Design_01Oct26_sd_12Oct26.xlsx"];
const STB = [["Absensi STB - GIS Agustus.xlsx", "2026-08"], ["Absensi STB - GIS September.xlsx", "2026-09"]];
const BULAN = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

const sum = (a) => a.reduce((x, y) => x + y, 0);
const r1 = (x) => Math.round(x * 10) / 10;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const pct = (a, b) => (b ? r1((a / b) * 100) : null);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const loadBackup = (n) => { const j = JSON.parse(fs.readFileSync(path.join(base, "backup", `2026-10-12_${n}.json`), "utf8")); return Array.isArray(j) ? j : j.data || j.rows || Object.values(j)[0]; };

const parseWaktu = (d, t) => {
  const m = String(d).match(/(\d{2})-(\d{2})-(\d{4})/), n = String(t).match(/(\d{1,2}):(\d{2})/);
  return m && n ? new Date(+m[3], m[2] - 1, +m[1], +n[1], +n[2]) : null;
};
const jenisTiket = (s) => {
  const t = String(s).toLowerCase();
  if (/fl[iy]?[ay]?er|fliyer|flayer/.test(t)) return "Flyer";
  if (/edit foto|photo editing|photo event/.test(t)) return "Edit foto";
  if (/sertifikat|label/.test(t)) return "Sertifikat & label";
  if (/poster/.test(t)) return "Poster";
  if (/campaign|sign|loto|stiker|danger/.test(t)) return "Media K3";
  if (t.trim() === "design" || /brosur|catalog/.test(t)) return "Desain umum";
  return "Lain-lain";
};
const divisi = (s) => ({ HR: "HR/GA", HSE: "K3" }[s] || s);

// ---------- muat sumber ----------
const tiket = [];
for (const f of TIKET) {
  const wb = XLSX.readFile(path.join(base, f));
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" })) {
    const b = parseWaktu(r["TGL BUAT"], r["JAM BUAT"]), p = parseWaktu(r["TGL PROSES"], r["JAM PROSES"]), s = parseWaktu(r["TGL SELESAI"], r["JAM SELESAI"]);
    if (!b) continue;
    tiket.push({ kode: r["KODE TIKET"], buat: b, tgl: iso(b), jenis: jenisTiket(r["UNIT / PERANGKAT"]), divisi: divisi(r.DIVISI), tunggu: p ? Math.round((p - b) / 6e4) : null, kerja: p && s ? Math.round((s - p) / 6e4) : null });
  }
}
// Tiket buatan aplikasi (bukan impor IT). Impor IT sudah terwakili ekspor di atas.
const permintaan = loadBackup("permintaan");
for (const p of permintaan) {
  if (/IT\d{6,}/.test(p.deskripsi || "")) continue;
  const b = new Date(p.created_at), pr = p.progress_at ? new Date(p.progress_at) : null, dn = p.done_at ? new Date(p.done_at) : null;
  // progress_at = done_at berarti waktu mulai tidak tercatat: jangan dihitung sebagai 0.
  const valid = pr && dn && pr.getTime() !== dn.getTime();
  tiket.push({ kode: p.id.slice(0, 8), buat: b, tgl: p.created_at.slice(0, 10), jenis: jenisTiket(p.project), divisi: divisi(p.departemen), tunggu: valid ? Math.round((pr - b) / 6e4) : null, kerja: valid ? Math.round((dn - pr) / 6e4) : null });
}
tiket.sort((a, b) => a.buat - b.buat);

const aktivitas = loadBackup("daily_activities");
const attendance = loadBackup("attendance").map((a) => {
  const m = String(a.date_text).match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  return { ...a, tgl: m ? `${m[3]}-${BULAN[m[2]]}-${m[1].padStart(2, "0")}` : null };
});
const stb = [];
for (const [f, ym] of STB) {
  const wb = XLSX.readFile(path.join(base, f));
  const a = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const hi = a.findIndex((r) => r[2] === 1);
  for (const r of a.slice(hi + 2)) {
    if (!String(r[1]).trim()) continue;
    r.forEach((v, i) => { const k = String(v).trim(), d = a[hi][i]; if (typeof d === "number" && k) stb.push({ tgl: `${ym}-${String(d).padStart(2, "0")}`, hadir: k === "H" }); });
  }
}
const tools = JSON.parse(fs.readFileSync(toolsFile, "utf8"));

// ---------- alat QCC ----------
function pareto(items, maxFaktor = 8) {
  const sorted = items.filter((i) => i.nama !== "Lain-lain" && i.nilai > 0).sort((a, b) => b.nilai - a.nilai);
  const lain = items.filter((i) => i.nama === "Lain-lain" && i.nilai > 0);
  lain.push(...sorted.splice(maxFaktor));
  const merged = lain.length ? [...sorted, { nama: "Lain-lain", n: sum(lain.map((i) => i.n)), nilai: sum(lain.map((i) => i.nilai)) }] : sorted;
  const total = sum(merged.map((i) => i.nilai)); let c = 0;
  return merged.map((i) => ({ ...i, jam: r1(i.nilai / 60), kumulatif: r1(((c += i.nilai) / total) * 100) }));
}
function kelompok(rows, key, val) {
  const m = {};
  for (const t of rows) { m[t[key]] ??= { nama: t[key], n: 0, nilai: 0 }; m[t[key]].n++; m[t[key]].nilai += val(t); }
  return Object.values(m);
}
const pearson = (x, y) => {
  const mx = sum(x) / x.length, my = sum(y) / y.length, c = sum(x.map((v, i) => (v - mx) * (y[i] - my)));
  const d = Math.sqrt(sum(x.map((v) => (v - mx) ** 2)) * sum(y.map((v) => (v - my) ** 2)));
  return d ? Math.round((c / d) * 100) / 100 : null;
};
const KELAS = [[0, 15, "0–15 mnt"], [15, 60, "15–60 mnt"], [60, 240, "1–4 jam"], [240, 480, "4–8 jam"], [480, 1440, "8–24 jam"], [1440, Infinity, "> 24 jam"]];
const menit = (t) => { const [h, m] = String(t).split(":"); return +h * 60 + +m; };
const fmtTgl = (d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function hitung(a, b) {
  const dalam = (t) => t && t >= a && t <= b;
  const T = tiket.filter((t) => dalam(t.tgl)), W = T.filter((t) => t.tunggu != null);
  const tunggu = W.map((t) => t.tunggu), kerja = W.map((t) => t.kerja), n = W.length;

  const mr = tunggu.slice(1).map((v, i) => Math.abs(v - tunggu[i]));
  const cl = n ? sum(tunggu) / n : 0, mrBar = mr.length ? sum(mr) / mr.length : 0, ucl = cl + 2.66 * mrBar;
  const terlama = n ? W.reduce((x, y) => (y.tunggu > x.tunggu ? y : x)) : null;
  const le60 = tunggu.filter((v) => v <= 60).length;

  const P = permintaan.filter((p) => dalam(p.created_at.slice(0, 10)));
  const rated = P.filter((p) => p.rating != null);

  const A = aktivitas.filter((x) => dalam(x.activity_date));
  const berjam = A.filter((x) => x.jam_mulai && x.jam_selesai).map((x) => ({ jenis: x.jenis_pekerjaan || "Lain-lain", durasi: menit(x.jam_selesai) - menit(x.jam_mulai) }));

  const att = attendance.filter((x) => dalam(x.tgl));
  const prs = att.filter((x) => x.status === "PRS").length, abs = att.filter((x) => x.status === "ABS").length;
  const S = stb.filter((x) => dalam(x.tgl));

  const CP = tools.content_plan.filter((c) => dalam(String(c.due_date).slice(0, 10)));
  const status = {}; CP.forEach((c) => { status[c.status] = (status[c.status] || 0) + 1; });
  const TP = tools.target_project.filter((p) => String(p.tgl_mulai).slice(0, 10) <= b && (!p.deadline || String(p.deadline).slice(0, 10) >= a));
  const E = tools.evaluasi_designer.filter((e) => e.periode >= a.slice(0, 7) && e.periode <= b.slice(0, 7));
  const avg = (k) => (E.length ? Math.round((sum(E.map((e) => e[k])) / E.length) * 100) / 100 : null);

  return {
    mulai: a, selesai: b, label: `${fmtTgl(a)} – ${fmtTgl(b)}`,
    tiket: {
      n: T.length, nWaktu: n, tanpaWaktu: T.length - n, le60, le60Pct: pct(le60, n), lebih60: n - le60,
      medianTunggu: median(tunggu), rataTunggu: n ? Math.round(cl) : null, medianKerja: median(kerja),
      totalTungguJam: r1(sum(tunggu) / 60), totalKerjaJam: r1(sum(kerja) / 60),
      terlama: terlama && { kode: terlama.kode, tgl: fmtTgl(terlama.buat), menit: terlama.tunggu, jenis: terlama.jenis },
      pareto: pareto(kelompok(W, "jenis", (t) => t.tunggu), 6),
      paretoDivisi: pareto(kelompok(W, "divisi", (t) => t.tunggu), 8),
      histogram: KELAS.map(([x, y, label]) => ({ label, n: tunggu.filter((v) => v >= x && v < y).length })),
      kendali: { cl: Math.round(cl), ucl: Math.round(ucl), lcl: Math.max(0, Math.round(cl - 2.66 * mrBar)), titik: tunggu, diLuar: W.filter((t) => t.tunggu > ucl).length },
      scatter: { x: kerja, y: tunggu, r: n > 2 ? pearson(kerja, tunggu) : null },
    },
    suara: { nDinilai: rated.length, rataRating: rated.length ? r1(sum(rated.map((p) => p.rating)) / rated.length) : null, nTiketDb: P.length, tiketRevisi: P.filter((p) => p.revision_count > 0).length },
    aktivitas: {
      n: A.length, tanpaJenis: A.filter((x) => !x.jenis_pekerjaan).length, nBerjam: berjam.length, dariTiket: A.filter((x) => x.request_id).length,
      jamTercatat: r1(sum(berjam.map((x) => x.durasi)) / 60), pareto: pareto(kelompok(berjam, "jenis", (x) => x.durasi), 6),
    },
    kehadiran: { hariKerja: prs + abs, hadir: prs, absen: abs, ratePct: pct(prs, prs + abs), libur: att.length - prs - abs },
    safety: { sesi: S.length, hadir: S.filter((x) => x.hadir).length, ratePct: pct(S.filter((x) => x.hadir).length, S.length) },
    konten: { n: CP.length, status },
    target: TP.map((p) => ({ nama: p.aktivitas, rencana: p.rencana, realisasi: p.realisasi, capaian: pct(p.realisasi, p.rencana) })).sort((x, y) => x.capaian - y.capaian),
    evaluasi: { n: E.length, aspek: [["Kreativitas", "kreativitas"], ["Brief", "brief"], ["Deadline", "deadline"], ["Kualitas", "kualitas"], ["Komunikasi", "komunikasi"], ["Revisi", "revisi"]].map(([l, k]) => ({ label: l, nilai: avg(k) })) },
  };
}

const data = { utama: hitung(mulai, selesai), banding: bMulai ? hitung(bMulai, bSelesai) : null, wlaItem: tools.wla_item_n };
fs.writeFileSync(outFile, JSON.stringify(data, null, 1));
const u = data.utama, c = data.banding;
const ring = (x) => ({ label: x.label, tiket: x.tiket.n, nWaktu: x.tiket.nWaktu, le60Pct: x.tiket.le60Pct, medTunggu: x.tiket.medianTunggu, medKerja: x.tiket.medianKerja, terlama: x.tiket.terlama, pareto: x.tiket.pareto.map((p) => `${p.nama}:${p.jam}`).join(" "), divisi: x.tiket.paretoDivisi.map((p) => `${p.nama}:${p.jam}`).join(" "), kendali: [x.tiket.kendali.cl, x.tiket.kendali.ucl, x.tiket.kendali.diLuar], r: x.tiket.scatter.r, suara: x.suara, aktivitas: { n: x.aktivitas.n, tanpaJenis: x.aktivitas.tanpaJenis, berjam: x.aktivitas.nBerjam, dariTiket: x.aktivitas.dariTiket, jam: x.aktivitas.jamTercatat, pareto: x.aktivitas.pareto.map((p) => `${p.nama}:${p.jam}`).join(" ") }, kehadiran: x.kehadiran, safety: x.safety, konten: x.konten, target: x.target.map((t) => `${t.nama}:${t.capaian}`).join(" "), evaluasi: x.evaluasi.aspek.map((e) => `${e.label}:${e.nilai}`).join(" ") });
console.log(JSON.stringify({ utama: ring(u), banding: c && ring(c) }, null, 1));
