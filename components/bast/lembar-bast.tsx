/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { PENUTUP_BAST, hariTanggal, tanggalSingkat, type ModeBarang } from "@/lib/bast";

// Lembar BAST mengikuti "BAST GMI IT DESIGN Site BA.pdf": kop Garuda Mart
// Indonesia + ISO, judul & nomor, pihak penyerah, daftar/tabel barang,
// perwakilan penerima, klausul, penutup, lalu blok Submitted by / Received by.
// Bagian yang belum diisi (nama penerima, TTD) dibiarkan kosong supaya surat
// juga bisa dicetak dan ditandatangani basah. Selalu hitam-putih seperti kertas.

export interface DataLembarBast {
  no_dokumen: string;
  tanggal: string;
  kota: string;
  penyerah_nama: string;
  penyerah_divisi: string;
  judul_barang: string;
  mode: ModeBarang;
  kolom: string[];
  items: string[][];
  penerima_instansi: string;
  penerima_nama?: string | null;
  penerima_dept?: string | null;
  klausul?: string | null;
  penyerah_ttd_url?: string | null;
  penerima_ttd_url?: string | null;
}

const KOP = "/bast-kop.webp";
const FOOTER = "/bast-footer.webp";

/** Isi surat; ukuran memakai em sehingga sama di layar (px) maupun cetak (pt). */
function IsiBast({ data }: { data: DataLembarBast }) {
  const isian = (v?: string | null) =>
    v ? <span>{v}</span> : <span className="inline-block w-[14em] border-b border-dotted border-neutral-400 align-bottom">&nbsp;</span>;

  return (
    <div className="leading-[1.35]">
      <div className="mb-[1.6em] text-center font-['Times_New_Roman',Times,serif] text-[1.17em] font-bold leading-snug">
        <div>BERITA ACARA SERAH TERIMA</div>
        <div>NO.{data.no_dokumen}</div>
      </div>

      <p>
        Pada Hari ini <b>{hariTanggal(data.tanggal)}</b> kami yang bertanda tangan di bawah ini:
      </p>
      <table className="border-collapse">
        <tbody>
          <tr>
            <td className="w-[5.5em] p-0 align-top">Nama</td>
            <td className="p-0 align-top">: {data.penyerah_nama}</td>
          </tr>
          <tr>
            <td className="p-0 align-top">Divisi</td>
            <td className="p-0 align-top">: {data.penyerah_divisi}</td>
          </tr>
        </tbody>
      </table>
      <p>Telah Menyerahkan:</p>

      <p className="mt-[1.3em] font-bold">{data.judul_barang}</p>
      {data.mode === "tabel" ? (
        <table className="mt-[0.4em] w-full border-collapse text-[0.93em]">
          <thead>
            <tr className="bg-neutral-100 [print-color-adjust:exact]">
              <th className="w-[2.6em] border border-black px-[0.4em] py-[0.2em] text-center">No</th>
              {data.kolom.map((k, i) => (
                <th key={i} className="border border-black px-[0.5em] py-[0.2em] text-left">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((r, i) => (
              <tr key={i} className="break-inside-avoid">
                <td className="border border-black px-[0.4em] py-[0.15em] text-center align-top">{i + 1}</td>
                {data.kolom.map((_, c) => (
                  <td key={c} className="border border-black px-[0.5em] py-[0.15em] align-top">
                    {r[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ol className="m-0 list-none p-0">
          {data.items.map((r, i) => (
            <li key={i} className="flex">
              <span className="w-[1.9em] shrink-0">{i + 1}.</span>
              <span className="min-w-0">{r[0]}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-[1.6em] break-inside-avoid">
        <p>Kepada {data.penerima_instansi} yang di wakilkan oleh</p>
        <table className="border-collapse">
          <tbody>
            <tr>
              <td className="w-[5.5em] p-0 align-top">Nama</td>
              <td className="p-0 align-top">: {isian(data.penerima_nama)}</td>
            </tr>
            <tr>
              <td className="p-0 align-top">Dept</td>
              <td className="p-0 align-top">: {isian(data.penerima_dept)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.klausul &&
        data.klausul
          .split(/\n\s*\n/)
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i} className="mt-[1.6em] whitespace-pre-line">
              {p.trim()}
            </p>
          ))}

      <p className="mt-[1.6em]">{PENUTUP_BAST}</p>

      {/* Blok tanda tangan tidak boleh terpotong antarhalaman */}
      <div className="mt-[2.6em] break-inside-avoid">
        <div>
          {data.kota}, {tanggalSingkat(data.tanggal)}
        </div>
        <div className="flex justify-between">
          <KolomTtd label="Submitted by," nama={data.penyerah_nama} url={data.penyerah_ttd_url} />
          <KolomTtd label="Received by," nama={data.penerima_nama} url={data.penerima_ttd_url} className="mr-[1em]" />
        </div>
      </div>
    </div>
  );
}

function KolomTtd({
  label,
  nama,
  url,
  className,
}: {
  label: string;
  nama?: string | null;
  url?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("w-[14em]", className)}>
      <div>{label}</div>
      <div className="flex h-[6.6em] items-center">
        {url && <img src={url} alt={`Tanda tangan ${nama ?? ""}`} className="max-h-full max-w-full object-contain" />}
      </div>
      <div className="border-t border-black pt-[0.1em]">{nama || " "}</div>
    </div>
  );
}

/** Tampilan layar: satu lembar A4 memanjang (isi panjang tetap terbaca utuh). */
export function LembarBast({ data, className }: { data: DataLembarBast; className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto flex min-h-[1123px] w-[794px] flex-col bg-white font-[Arial,Helvetica,sans-serif] text-[14.5px] text-black shadow-sm",
        className,
      )}
    >
      <img src={KOP} alt="Garuda Mart Indonesia" className="mt-[26px] block w-full" />
      <div className="flex-1 px-[100px] pb-10 pt-6">
        <IsiBast data={data} />
      </div>
      <img src={FOOTER} alt="" className="block w-full" />
    </div>
  );
}

// Cetak: kop & footer position:fixed diulang browser di setiap halaman, dan
// thead/tfoot kosong memberi ruang agar isi tidak menimpa keduanya.
const PRINT_CSS = `
#cetak-bast { display: none; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; }
  body > *:not(#cetak-bast) { display: none !important; }
  #cetak-bast { display: block !important; }
  #cetak-bast img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

/** Salinan lembar khusus cetak/PDF, dipasang langsung di <body>. */
export function CetakBast({ data }: { data: DataLembarBast }) {
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);
  if (!siap) return null;
  return createPortal(
    <div id="cetak-bast" className="bg-white font-[Arial,Helvetica,sans-serif] text-[11pt] text-black">
      <style>{PRINT_CSS}</style>
      <img src={KOP} alt="" className="fixed left-0 top-[7mm] w-[210mm]" />
      <img src={FOOTER} alt="" className="fixed bottom-0 left-0 w-[210mm]" />
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td className="h-[40mm] p-0" />
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td className="h-[32mm] p-0" />
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td className="px-[26mm] py-0 align-top">
              <IsiBast data={data} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
