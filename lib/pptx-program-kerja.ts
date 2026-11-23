import type { ProgramKerjaRecord } from "@/lib/program-kerja-seed";
import { CANONICAL_QUARTALS } from "@/lib/program-kerja-seed";
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
  fmtPct,
} from "@/lib/pptx-qcc";

const STATUS_URUT = ["Done", "In Progress", "Review", "Planned", "Tertunda"];

const warnaStatus = (status: string) => {
  const s = status.toLowerCase();
  if (s === "done") return QCC.green;
  if (s.includes("progress") || s === "review") return QCC.blue;
  if (s.includes("tunda")) return QCC.red;
  return QCC.gray;
};

const WARNA_CHART: Record<string, string> = {
  Done: QCC.green,
  "In Progress": QCC.blue,
  Review: QCC.yellow,
  Planned: "A5A5A5",
  Tertunda: QCC.red,
};

const ringkasQuartal = (q: string) => q.replace("Quartal ", "Q");

export async function exportProgramKerjaPptx(records: ProgramKerjaRecord[], year: number, gugus = "Design & Multimedia") {
  const data = [...records].sort((a, b) => a.quartal.localeCompare(b.quartal));
  const total = data.length;
  const hitung = (st: string) => data.filter((r) => (r.status || "Planned") === st).length;
  const done = hitung("Done");
  const berjalan = hitung("In Progress") + hitung("Review");
  const tertunda = hitung("Tertunda");
  const rataProgress = total ? data.reduce((n, r) => n + (Number(r.progress) || 0), 0) / total : 0;

  const deck = await buatDeck({
    judul: `Program Kerja ${year}`,
    subjudul: `Rencana, realisasi & evaluasi program kerja ${gugus}`,
    gugus,
    periode: `Tahun ${year}`,
    namaFile: `QCC_Program_Kerja_${gugus.replace(/[^a-z0-9]+/gi, "_")}_${year}`,
  });

  slideAgenda(deck, [
    { fase: "PLAN", judul: "Ringkasan & Rencana Program", ket: "Jumlah program, fokus tiap quartal, tujuan, PIC & deadline" },
    { fase: "DO", judul: "Realisasi Program", ket: "Realisasi yang sudah dijalankan dan progresnya" },
    { fase: "CHECK", judul: "Evaluasi Pencapaian", ket: "Distribusi status dan progres per quartal" },
    { fase: "ACTION", judul: "Kendala & Tindak Lanjut", ket: "Risiko/kendala dan rencana perbaikan" },
  ]);

  // ===== PLAN: ringkasan =====
  {
    const { s, y } = deck.slide("Ringkasan Program Kerja", "PLAN", "Langkah 1");
    const y2 = kartuKpi(s, [
      { label: "Total Program", nilai: String(total), ket: `Tahun ${year}`, warna: QCC.navy },
      { label: "Selesai (Done)", nilai: String(done), ket: fmtPct(total ? (done / total) * 100 : null, 0) + " dari total", warna: QCC.green },
      { label: "Berjalan", nilai: String(berjalan), ket: "In Progress / Review", warna: QCC.blue },
      { label: "Tertunda", nilai: String(tertunda), warna: QCC.red },
      { label: "Rata-rata Progress", nilai: fmtPct(rataProgress, 0), warna: QCC.orange },
    ], y);

    const perQ = CANONICAL_QUARTALS.map((q) => {
      const isi = data.filter((r) => r.quartal === q);
      return {
        q,
        jumlah: isi.length,
        progress: isi.length ? isi.reduce((n, r) => n + (Number(r.progress) || 0), 0) / isi.length : 0,
        fokus: isi.find((r) => r.quartal_fokus)?.quartal_fokus || "",
      };
    });
    s.addChart(
      "bar",
      [{ name: "Jumlah Program", labels: perQ.map((p) => ringkasQuartal(p.q)), values: perQ.map((p) => p.jumlah) }],
      {
        x: X_KIRI, y: y2, w: 6, h: 3.9, barDir: "col", chartColors: [QCC.blue],
        showTitle: true, title: "Jumlah Program per Quartal", titleFontSize: 12,
        showValue: true, dataLabelFontSize: 10, catAxisLabelFontSize: 11, valAxisLabelFontSize: 9,
        valGridLine: { color: "E7E6E6", size: 0.5 },
      },
    );
    kotakCatatan(
      s,
      "Fokus per Quartal",
      perQ.map((p) => `${p.q}: ${p.fokus || "-"} (${p.jumlah} program, progress ${fmtPct(p.progress, 0)})`),
      X_KIRI + 6.3, y2, LEBAR_KONTEN - 6.3, 3.9,
    );
  }

  // ===== PLAN: rencana per quartal =====
  for (const q of CANONICAL_QUARTALS) {
    const isi = data.filter((r) => r.quartal === q);
    if (isi.length === 0) continue;
    const fokus = isi.find((r) => r.quartal_fokus)?.quartal_fokus;
    slideTabel(
      deck,
      `Rencana Program — ${q}`,
      "PLAN",
      "Langkah 2",
      ["No", "Program Kerja", "Tujuan", "PIC", "Deadline"],
      isi.map((r, i) => [i + 1, r.program_kerja, r.tujuan, r.pic, r.deadline]),
      { colW: [0.5, 4.2, 4.6, 1.5, 1.53], barisPerSlide: 8, align: ["center", "left", "left", "left", "center"] },
      fokus ? `Fokus ${q}: ${fokus}` : undefined,
    );
  }

  // ===== DO: realisasi =====
  slideTabel(
    deck,
    "Realisasi Program Kerja",
    "DO",
    "Langkah 3",
    ["Q", "Program Kerja", "Realisasi", "Realisasi Aktual", "Status", "Progress"],
    data.map((r) => [ringkasQuartal(r.quartal), r.program_kerja, r.realisasi, r.realisasi_aktual, r.status || "Planned", `${Number(r.progress) || 0}%`]),
    {
      colW: [0.5, 3.6, 4.6, 1.5, 1.1, 1.03],
      barisPerSlide: 9,
      align: ["center", "left", "left", "left", "center", "center"],
      warnaSel: (row, col) => (col === 4 ? warnaStatus(String(row[4])) : undefined),
    },
  );

  // ===== CHECK: evaluasi =====
  {
    const { s, y } = deck.slide("Evaluasi Pencapaian Program", "CHECK", "Langkah 4");
    const statusAda = [...new Set([...STATUS_URUT, ...data.map((r) => r.status || "Planned")])]
      .map((st) => ({ st, n: hitung(st) }))
      .filter((x) => x.n > 0);
    if (statusAda.length) {
      s.addChart(
        "doughnut",
        [{ name: "Status", labels: statusAda.map((x) => x.st), values: statusAda.map((x) => x.n) }],
        {
          x: X_KIRI, y, w: 5, h: 4.6, holeSize: 55,
          chartColors: statusAda.map((x) => WARNA_CHART[x.st] ?? QCC.orange),
          showTitle: true, title: "Distribusi Status", titleFontSize: 12,
          showLegend: true, legendPos: "b", legendFontSize: 10, showPercent: true, showValue: false, dataLabelColor: QCC.white,
        },
      );
    }
    const perQ = CANONICAL_QUARTALS.map((q) => {
      const isi = data.filter((r) => r.quartal === q);
      return {
        label: ringkasQuartal(q),
        progress: isi.length ? Math.round(isi.reduce((n, r) => n + (Number(r.progress) || 0), 0) / isi.length) : 0,
        done: isi.length ? Math.round((isi.filter((r) => r.status === "Done").length / isi.length) * 100) : 0,
      };
    });
    s.addChart(
      "bar",
      [
        { name: "Rata-rata Progress (%)", labels: perQ.map((p) => p.label), values: perQ.map((p) => p.progress) },
        { name: "Program Selesai (%)", labels: perQ.map((p) => p.label), values: perQ.map((p) => p.done) },
      ],
      {
        x: X_KIRI + 5.3, y, w: LEBAR_KONTEN - 5.3, h: 3.2, barDir: "col", chartColors: [QCC.blue, QCC.green],
        showTitle: true, title: "Progress & Penyelesaian per Quartal", titleFontSize: 12,
        showValue: true, dataLabelFontSize: 9, valAxisMaxVal: 100, valAxisLabelFontSize: 9,
        showLegend: true, legendPos: "b", legendFontSize: 10, valGridLine: { color: "E7E6E6", size: 0.5 },
      },
    );
    const belum = data.filter((r) => r.status !== "Done").length;
    kotakCatatan(
      s,
      "Hasil Evaluasi",
      [
        `${done} dari ${total} program selesai (${fmtPct(total ? (done / total) * 100 : null, 0)}).`,
        `Rata-rata progress seluruh program ${fmtPct(rataProgress, 0)}.`,
        belum ? `${belum} program masih perlu dikawal hingga selesai.` : "Seluruh program telah selesai.",
      ],
      X_KIRI + 5.3, y + 3.35, LEBAR_KONTEN - 5.3, 1.25,
    );
  }

  // ===== ACTION: kendala & tindak lanjut =====
  const perluTindakLanjut = data.filter((r) => r.status !== "Done" || (r.risiko_kendala || "").trim());
  slideTabel(
    deck,
    "Kendala & Rencana Tindak Lanjut",
    "ACTION",
    "Langkah 5",
    ["Program Kerja", "Status", "Risiko / Kendala", "Tindak Lanjut / Keterangan", "PIC", "Target"],
    perluTindakLanjut.map((r) => [
      r.program_kerja, `${r.status || "Planned"} (${Number(r.progress) || 0}%)`, r.risiko_kendala, r.keterangan, r.pic, r.deadline,
    ]),
    {
      colW: [3.0, 1.35, 2.9, 2.9, 1.1, 1.08],
      barisPerSlide: 8,
      align: ["left", "center", "left", "left", "left", "center"],
      warnaSel: (row, col) => (col === 1 ? warnaStatus(String(row[1]).split(" (")[0]) : undefined),
    },
    "Program berstatus selain Done atau yang memiliki catatan risiko/kendala.",
  );

  slidePenutup(deck);
  return deck.simpan();
}
