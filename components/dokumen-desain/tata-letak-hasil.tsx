"use client";

/* eslint-disable @next/next/no-img-element */
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  kolomEfektif,
  MAKS_KOLOM,
  MAKS_TINGGI,
  normalisasiGambar,
  SKALA_MIN,
  type GambarHasil,
  type RataGambar,
} from "@/lib/dokumen-desain";
import { HasilDesain } from "./lembar-dokumen";

/** Tombol pilihan kecil berjajar (segmented control). */
function Pilihan<T extends string | number>({
  value,
  opsi,
  onChange,
  label,
}: {
  value: T;
  opsi: { v: T; l: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border bg-muted/40 p-0.5">
      {opsi.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          title={o.title}
          onClick={() => onChange(o.v)}
          className={cn(
            "min-w-8 rounded px-2 py-1 text-xs font-medium transition",
            value === o.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

const RATA: { v: RataGambar; l: React.ReactNode; title: string }[] = [
  { v: "kiri", l: <AlignLeft className="h-3.5 w-3.5" />, title: "Rata kiri" },
  { v: "tengah", l: <AlignCenter className="h-3.5 w-3.5" />, title: "Tengah" },
  { v: "kanan", l: <AlignRight className="h-3.5 w-3.5" />, title: "Rata kanan" },
];

/**
 * Pengaturan tata letak gambar hasil: jumlah kolom grid, lalu per gambar
 * urutan, caption, lebar/tinggi (dalam sel grid), posisi, dan skala.
 * Pratinjau mini memakai renderer yang sama dengan lembar cetak.
 */
export function TataLetakHasil({
  files,
  onFiles,
  kolom,
  onKolom,
}: {
  files: GambarHasil[];
  onFiles: (files: GambarHasil[]) => void;
  kolom: number | null;
  onKolom: (kolom: number | null) => void;
}) {
  const list = files.map(normalisasiGambar);
  const jumlahKolom = kolomEfektif(kolom, list);
  const maksLebar = kolom ?? MAKS_KOLOM;

  const ubah = (i: number, patch: Partial<GambarHasil>) =>
    onFiles(list.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const geser = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= list.length) return;
    const baru = [...list];
    [baru[i], baru[j]] = [baru[j], baru[i]];
    onFiles(baru);
  };
  const ubahKolom = (v: number | "auto") => {
    const k = v === "auto" ? null : v;
    onKolom(k);
    // Gambar yang lebih lebar dari jumlah kolom baru dipersempit
    if (k && list.some((f) => f.lebar > k)) onFiles(list.map((f) => ({ ...f, lebar: Math.min(f.lebar, k) })));
  };

  return (
    <div className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Tata Letak Gambar</h3>
            <p className="text-xs text-muted-foreground">Atur ukuran & posisi tiap gambar di lembar cetak.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Kolom</span>
            <Pilihan<number | "auto">
              label="Jumlah kolom"
              value={kolom ?? "auto"}
              onChange={ubahKolom}
              opsi={[
                { v: "auto", l: `Auto (${kolomEfektif(null, list)})` },
                ...Array.from({ length: MAKS_KOLOM }, (_, i) => ({ v: i + 1, l: i + 1 })),
              ]}
            />
          </div>
        </div>

        <ul className="space-y-3">
          {list.map((f, i) => (
            <li key={f.url} className="rounded-md border bg-card p-3">
              <div className="flex items-start gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-muted">
                  <img src={f.url} alt={f.name} className="h-full w-full object-contain" />
                  <span className="absolute left-0 top-0 rounded-br bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="truncate text-xs text-muted-foreground" title={f.name}>
                    {f.name}
                  </div>
                  <Input
                    value={f.caption ?? ""}
                    maxLength={100}
                    placeholder="Caption (opsional), mis. Tampak Depan"
                    className="h-8 text-sm"
                    onChange={(e) => ubah(i, { caption: e.target.value })}
                  />
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => geser(i, -1)} aria-label="Naikkan urutan">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === list.length - 1} onClick={() => geser(i, 1)} aria-label="Turunkan urutan">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  aria-label="Batal pilih gambar"
                  onClick={() => onFiles(list.filter((_, idx) => idx !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-normal text-muted-foreground">Lebar (kolom)</Label>
                  <Pilihan
                    label="Lebar"
                    value={Math.min(f.lebar, maksLebar)}
                    onChange={(v) => ubah(i, { lebar: v })}
                    opsi={Array.from({ length: maksLebar }, (_, k) => ({ v: k + 1, l: k + 1 }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-normal text-muted-foreground">Tinggi (baris)</Label>
                  <Pilihan
                    label="Tinggi"
                    value={f.tinggi}
                    onChange={(v) => ubah(i, { tinggi: v })}
                    opsi={Array.from({ length: MAKS_TINGGI }, (_, k) => ({ v: k + 1, l: k + 1 }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-normal text-muted-foreground">Posisi</Label>
                  <Pilihan label="Posisi" value={f.rata} onChange={(v) => ubah(i, { rata: v })} opsi={RATA} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="shrink-0 text-xs font-normal text-muted-foreground">Skala</Label>
                  <Slider
                    min={SKALA_MIN}
                    max={100}
                    step={5}
                    value={[f.skala]}
                    onValueChange={([v]) => ubah(i, { skala: v })}
                    aria-label="Skala gambar"
                  />
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums">{f.skala}%</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onKolom(null);
            onFiles(list.map((f) => normalisasiGambar({ name: f.name, url: f.url, caption: f.caption })));
          }}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset ukuran & posisi
        </Button>
      </div>

      {/* Pratinjau area gambar (proporsi area di atas title block pada A4 landscape) */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-1.5 text-xs text-muted-foreground">
          Pratinjau area gambar · {jumlahKolom} kolom
        </div>
        <div className="flex aspect-[1.75] flex-col overflow-hidden rounded border-2 border-neutral-800 bg-white text-black [&_figcaption]:text-[9px]">
          <HasilDesain files={list} kolom={kolom} />
        </div>
      </div>
    </div>
  );
}
