"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, PackageCheck, Plus, RefreshCw, Search, Settings2 } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JenisDialog, type JenisBast } from "@/components/bast/jenis-dialog";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import { BAST_STATUS_META, normalizeBastStatus, tanggalSingkat } from "@/lib/bast";
import { cn } from "@/lib/utils";

interface BastRow {
  id: string;
  no_dokumen: string;
  jenis_nama: string;
  tanggal: string;
  judul_barang: string;
  jumlah_item: number;
  penerima_instansi: string;
  penerima_nama: string | null;
  status: string;
  penyerah_nama: string;
  penyerah_signed_at: string | null;
  permintaan: { id: string; judul: string }[];
  perlu_aksi_saya: boolean;
}

export default function BastPage() {
  const [rows, setRows] = useState<BastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [tab, setTab] = useState("semua");
  const [jenisFilter, setJenisFilter] = useState("SEMUA");
  const [cari, setCari] = useState("");
  const [jenisOpen, setJenisOpen] = useState(false);
  const [jenis, setJenis] = useState<JenisBast[]>([]);

  const muat = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bast");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat BAST");
      setRows(json.data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCurrentProfile().then((p) => p && setRole(p.role));
    void muat();
  }, []);

  const staff = role === "admin" || role === "designer";

  const bukaJenis = async () => {
    setJenisOpen(true);
    const res = await fetch("/api/bast/jenis");
    const json = await res.json();
    if (res.ok) setJenis(json.data);
  };

  const perluAksi = rows.filter((r) => r.perlu_aksi_saya).length;
  const daftarJenis = useMemo(() => Array.from(new Set(rows.map((r) => r.jenis_nama))).sort(), [rows]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return rows.filter((r) => {
      const st = normalizeBastStatus(r.status);
      if (tab === "perlu-aksi" && !r.perlu_aksi_saya) return false;
      if (tab === "menunggu" && st !== "MENUNGGU") return false;
      if (tab === "diterima" && st !== "DITERIMA") return false;
      if (jenisFilter !== "SEMUA" && r.jenis_nama !== jenisFilter) return false;
      if (!q) return true;
      return [r.no_dokumen, r.jenis_nama, r.judul_barang, r.penerima_instansi, r.penerima_nama, r.penyerah_nama, ...r.permintaan.map((p) => p.judul)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, tab, jenisFilter, cari]);

  return (
    <Content
      title="BAST / Serah Terima"
      description="Berita acara serah terima barang hasil desain (ID card, poster, sticker, dll.) ke site atau departemen."
      cardAction={
        <>
          <Button variant="ghost" size="icon" onClick={muat} title="Muat ulang">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          {staff && (
            <>
              <Button variant="outline" onClick={bukaJenis}>
                <Settings2 className="mr-2 h-4 w-4" /> Jenis
              </Button>
              <Button asChild>
                <Link href="/bast/buat">
                  <Plus className="mr-2 h-4 w-4" /> Buat BAST
                </Link>
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="semua">Semua</TabsTrigger>
            <TabsTrigger value="perlu-aksi">
              Perlu Aksi Saya
              {perluAksi > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {perluAksi}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="menunggu">Menunggu</TabsTrigger>
            <TabsTrigger value="diterima">Diterima</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative lg:w-80">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cari nomor, barang, penerima..."
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
        </div>
      </div>

      {daftarJenis.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {["SEMUA", ...daftarJenis].map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => setJenisFilter(j)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                jenisFilter === j ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {j === "SEMUA" ? "Semua jenis" : j}
            </button>
          ))}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tampil.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <PackageCheck className="h-8 w-8" />
          {rows.length === 0 ? "Belum ada BAST." : "Tidak ada BAST yang cocok."}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {tampil.map((r) => {
            const st = normalizeBastStatus(r.status);
            return (
              <li key={r.id}>
                <Link
                  href={`/bast/${r.id}`}
                  className={cn(
                    "grid gap-2 p-4 transition hover:bg-muted/40 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] md:items-center md:gap-4",
                    r.perlu_aksi_saya && "bg-primary/5",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        {r.jenis_nama}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{tanggalSingkat(r.tanggal)}</span>
                    </div>
                    <div className="mt-1 truncate font-semibold">{r.judul_barang.replace(/:$/, "")}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{r.no_dokumen}</div>
                    {r.permintaan.length > 0 && (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        Permintaan: {r.permintaan.map((p) => p.judul).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 text-sm">
                    <div className="truncate">
                      <span className="text-muted-foreground">Ke </span>
                      <b>{r.penerima_instansi}</b>
                      {r.penerima_nama && <span className="text-muted-foreground"> · {r.penerima_nama}</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.jumlah_item} item · oleh {r.penyerah_nama}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                    <Badge variant="outline" className={BAST_STATUS_META[st].badgeClass}>
                      {BAST_STATUS_META[st].label}
                    </Badge>
                    {r.perlu_aksi_saya ? (
                      <span className="text-xs font-medium text-primary">Perlu aksi Anda</span>
                    ) : st === "MENUNGGU" && !r.penyerah_signed_at ? (
                      <span className="text-xs text-muted-foreground">Belum TTD penyerah</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {staff && <JenisDialog open={jenisOpen} onOpenChange={setJenisOpen} jenis={jenis} onChanged={setJenis} />}
    </Content>
  );
}
