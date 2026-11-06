"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Download, Loader2, Search } from "lucide-react";
import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { InfoSlide } from "@/lib/qcc/deck";
import type { Fishbone, ItemPareto, LaporanQcc } from "@/lib/qcc/metrics";

type Hasil = LaporanQcc & { slide: InfoSlide[] };
type Rentang = { mulai: string; selesai: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const angka = (v: number | null | undefined, d = 1) => (v == null ? "-" : v.toLocaleString("id-ID", { maximumFractionDigits: d }));

function bulanLalu(mundur = 1): Rentang {
  const now = new Date();
  return { mulai: iso(new Date(now.getFullYear(), now.getMonth() - mundur, 1)), selesai: iso(new Date(now.getFullYear(), now.getMonth() - mundur + 1, 0)) };
}

/** Rentang sepanjang periode utama, tepat sebelum periode itu. */
function rentangSebelumnya({ mulai, selesai }: Rentang): Rentang {
  const a = new Date(`${mulai}T00:00:00`);
  const hari = Math.round((new Date(`${selesai}T00:00:00`).getTime() - a.getTime()) / 86400_000);
  const akhir = new Date(a);
  akhir.setDate(a.getDate() - 1);
  const awal = new Date(akhir);
  awal.setDate(akhir.getDate() - hari);
  return { mulai: iso(awal), selesai: iso(akhir) };
}

function Stat({ label, nilai, keterangan }: { label: string; nilai: string; keterangan?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{nilai}</p>
      {keterangan && <p className="mt-1 text-xs text-muted-foreground">{keterangan}</p>}
    </div>
  );
}

function FishboneView({ data }: { data: Fishbone }) {
  const tulang = (t: Fishbone["tulang"][number]) => (
    <div key={t.faktor} className="rounded-lg border bg-card p-3">
      <p className="text-sm font-semibold">{t.faktor}</p>
      {t.sebab.length ? (
        <ul className="mt-2 space-y-1 text-sm">
          {t.sebab.map((s) => {
            const kuat = data.terkuat?.teks === s.teks;
            return (
              <li key={s.teks} className={kuat ? "font-semibold text-primary" : "text-muted-foreground"}>
                {s.teks}
                {kuat && <Badge variant="outline" className="ml-2 align-middle">Terkuat</Badge>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Belum ada indikasi</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">{data.tulang.slice(0, 3).map(tulang)}</div>
        <div className="hidden h-0.5 bg-primary/60 lg:block" aria-hidden />
        <div className="grid gap-3 sm:grid-cols-2">{data.tulang.slice(3).map(tulang)}</div>
      </div>
      <div className="flex items-center rounded-lg bg-primary p-4 text-primary-foreground lg:w-52">
        <p className="text-sm font-semibold">{data.masalah}</p>
      </div>
    </div>
  );
}

function TooltipPareto({ active, payload }: { active?: boolean; payload?: { payload: ItemPareto }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{p.nama}</p>
      <p className="text-muted-foreground">{angka(p.jam)} jam dari {p.n} tiket</p>
      <p className="text-muted-foreground">Kumulatif {angka(p.kumulatif)}%</p>
    </div>
  );
}

function GrafikPareto({ data }: { data: ItemPareto[] }) {
  return (
    <div style={{ height: Math.max(200, data.length * 44) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid horizontal={false} strokeOpacity={0.2} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} unit=" jam" />
          <YAxis type="category" dataKey="nama" tickLine={false} axisLine={false} fontSize={12} width={130} />
          <Tooltip content={<TooltipPareto />} cursor={{ fillOpacity: 0.08 }} />
          <Bar dataKey="jam" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function QccClient() {
  const [utama, setUtama] = useState<Rentang>(() => bulanLalu());
  const [pakaiBanding, setPakaiBanding] = useState(true);
  const [banding, setBanding] = useState<Rentang>(() => bulanLalu(2));
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [mengunduh, setMengunduh] = useState(false);
  const [dimatikan, setDimatikan] = useState<string[]>([]);

  const queryRentang = useCallback(() => {
    const q = new URLSearchParams(utama);
    if (pakaiBanding) {
      q.set("bandingMulai", banding.mulai);
      q.set("bandingSelesai", banding.selesai);
    }
    return q;
  }, [utama, banding, pakaiBanding]);

  const analisa = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch(`/api/qcc?${queryRentang()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat analisa");
      setHasil(json);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat analisa");
    } finally {
      setMemuat(false);
    }
  }, [queryRentang]);

  // Analisa pertama saat halaman dibuka; berikutnya lewat tombol.
  useEffect(() => { analisa(); }, []);

  async function unduh() {
    setMengunduh(true);
    try {
      const q = queryRentang();
      if (dimatikan.length) q.set("tanpa", dimatikan.join(","));
      const res = await fetch(`/api/qcc/deck?${q}`);
      if (!res.ok) throw new Error((await res.json()).error || "Gagal membuat PPT");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan-QCC-${utama.mulai}_${utama.selesai}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat PPT");
    } finally {
      setMengunduh(false);
    }
  }

  const U = hasil?.utama;
  const slideBisa = hasil?.slide.filter((s) => !s.alasan) ?? [];
  const slideLewat = hasil?.slide.filter((s) => s.alasan) ?? [];

  return (
    <>
      <Content title="QCC" description="Analisa dan laporan QCC tim Creative dari semua data pada rentang tanggal yang dipilih." size="lg">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qcc-mulai">Dari</Label>
              <Input id="qcc-mulai" type="date" value={utama.mulai} onChange={(e) => setUtama({ ...utama, mulai: e.target.value })} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qcc-selesai">Sampai</Label>
              <Input id="qcc-selesai" type="date" value={utama.selesai} onChange={(e) => setUtama({ ...utama, selesai: e.target.value })} className="w-40" />
            </div>
            <div className="flex h-9 items-center gap-2">
              <Switch id="qcc-banding" checked={pakaiBanding} onCheckedChange={setPakaiBanding} />
              <Label htmlFor="qcc-banding">Bandingkan</Label>
            </div>
            {pakaiBanding && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="qcc-b-mulai">Pembanding dari</Label>
                  <Input id="qcc-b-mulai" type="date" value={banding.mulai} onChange={(e) => setBanding({ ...banding, mulai: e.target.value })} className="w-40" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qcc-b-selesai">Sampai</Label>
                  <Input id="qcc-b-selesai" type="date" value={banding.selesai} onChange={(e) => setBanding({ ...banding, selesai: e.target.value })} className="w-40" />
                </div>
                <Button type="button" variant="ghost" onClick={() => setBanding(rentangSebelumnya(utama))}>Periode sebelumnya</Button>
              </>
            )}
            <Button onClick={analisa} disabled={memuat}>
              {memuat ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Analisa
            </Button>
          </div>
        </div>
      </Content>

      {U && (
        <>
          <Content title="Ringkasan" description={U.label} size="lg">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Tiket masuk" nilai={angka(U.tiket.n, 0)} keterangan={`${U.tiket.nWaktu} punya catatan waktu lengkap`} />
              <Stat label="Diproses ≤ 60 menit kerja" nilai={U.tiket.cepatPct == null ? "-" : `${angka(U.tiket.cepatPct)}%`} keterangan={`${U.tiket.cepat} dari ${U.tiket.nWaktu} tiket`} />
              <Stat label="Median waktu tunggu" nilai={`${angka(U.tiket.medianTunggu)} menit`} keterangan={`Median kerja ${angka(U.tiket.medianKerja)} menit`} />
              <Stat label="Tepat tenggat" nilai={U.tiket.tepatPct == null ? "-" : `${angka(U.tiket.tepatPct)}%`} keterangan={`${U.tiket.nDue} tiket punya tenggat asli`} />
            </div>
          </Content>

          <Content title="Fishbone" description="Indikasi penyebab dari data. Konfirmasi akar masalah dengan 5 Why bersama tim." size="lg">
            <FishboneView data={U.fishbone} />
          </Content>

          {U.tiket.pareto.length > 0 && (
            <Content title="Pareto waktu tunggu" description="Total jam kerja menunggu per jenis desain." size="md">
              <GrafikPareto data={U.tiket.pareto} />
            </Content>
          )}

          <Content title="Kandidat tema" description="Disusun otomatis dari data. Tim memilih satu tema." size={U.tiket.pareto.length > 0 ? "md" : "lg"}>
            {U.kandidat.length ? (
              <ul className="space-y-3">
                {U.kandidat.map((k) => (
                  <li key={k.tema} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{k.tema}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{k.bukti} · {k.sumber}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Data pada rentang ini belum memunculkan kandidat tema.</p>
            )}
          </Content>

          <Content
            title="Laporan PPT"
            description={`${slideBisa.length - dimatikan.filter((id) => slideBisa.some((s) => s.id === id)).length} slide akan dibuat.`}
            size="lg"
            cardAction={
              <Button onClick={unduh} disabled={mengunduh}>
                {mengunduh ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Unduh PPT
              </Button>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slideBisa.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox
                    checked={!dimatikan.includes(s.id)}
                    onCheckedChange={(v) => setDimatikan((d) => (v ? d.filter((x) => x !== s.id) : [...d, s.id]))}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.judul}</span>
                  {s.langkah && <Badge variant="secondary">Langkah {s.langkah}</Badge>}
                </label>
              ))}
            </div>
            {slideLewat.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium">Dilewati pada rentang ini</p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  {slideLewat.map((s) => <li key={s.id}>{s.judul}: {s.alasan}</li>)}
                </ul>
              </div>
            )}
          </Content>
        </>
      )}
    </>
  );
}
