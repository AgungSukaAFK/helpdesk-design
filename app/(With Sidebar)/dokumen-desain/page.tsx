"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FilePen, LayoutGrid, List, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DaftarDokumen,
  type DokumenRow,
  type TampilanDokumen,
} from "@/components/dokumen-desain/daftar-dokumen";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import {
  DOKUMEN_STATUS_META,
  normalizeDokumenStatus,
  type DokumenStatus,
} from "@/lib/dokumen-desain";
import { cn } from "@/lib/utils";

const KUNCI_TAMPILAN = "dokumen-desain:tampilan";

export default function DokumenDesainPage() {
  const [rows, setRows] = useState<DokumenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [tab, setTab] = useState("semua");
  const [status, setStatus] = useState<"SEMUA" | DokumenStatus>("SEMUA");
  const [cari, setCari] = useState("");
  const [tampilan, setTampilan] = useState<TampilanDokumen>("kartu");

  // localStorage bisa diblokir browser; pilihan tampilan tetap jalan tanpa disimpan
  useEffect(() => {
    try {
      if (localStorage.getItem(KUNCI_TAMPILAN) === "daftar") setTampilan("daftar");
    } catch {}
  }, []);

  const gantiTampilan = (t: TampilanDokumen) => {
    setTampilan(t);
    try {
      localStorage.setItem(KUNCI_TAMPILAN, t);
    } catch {}
  };

  const muat = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dokumen-desain");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat dokumen");
      setRows(json.data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCurrentProfile().then((p) => p && setMe({ id: p.id, role: p.role }));
    void muat();
  }, []);

  // Buka tab "Perlu TTD Saya" bila ada yang menunggu
  const perluTtd = rows.filter((r) => r.perlu_ttd_saya).length;
  useEffect(() => {
    if (!loading && perluTtd > 0) setTab((t) => (t === "semua" ? "perlu-ttd" : t));
    // hanya saat data pertama kali dimuat
  }, [loading]);

  const bolehBuat = me?.role === "admin" || me?.role === "designer";

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "perlu-ttd" && !r.perlu_ttd_saya) return false;
      if (tab === "saya" && r.created_by !== me?.id) return false;
      if (status !== "SEMUA" && normalizeDokumenStatus(r.status) !== status) return false;
      if (!q) return true;
      return [r.no_dokumen, r.no_dokumen_sub, r.project_design, r.tipe_design, r.deskripsi, r.permintaan_judul, r.created_by_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, tab, status, cari, me]);

  return (
    <Content
      title="Dokumen Form Desain"
      description="Lembar pengesahan hasil desain yang ditandatangani secara digital oleh designer, acknowledge, dan user."
      cardAction={
        <>
          <Button variant="ghost" size="icon" onClick={muat} title="Muat ulang">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          {bolehBuat && (
            <Button asChild>
              <Link href="/dokumen-desain/buat">
                <Plus className="mr-2 h-4 w-4" /> Buat Dokumen
              </Link>
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="perlu-ttd">
              Perlu TTD Saya
              {perluTtd > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {perluTtd}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="semua">Semua</TabsTrigger>
            {bolehBuat && <TabsTrigger value="saya">Dibuat Saya</TabsTrigger>}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Cari no. dokumen, project, permintaan..."
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEMUA">Semua status</SelectItem>
              {(Object.keys(DOKUMEN_STATUS_META) as DokumenStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {DOKUMEN_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex shrink-0 items-center gap-1 self-start rounded-md border p-0.5" role="group" aria-label="Jenis tampilan">
            {(
              [
                ["kartu", "Tampilan kartu", LayoutGrid],
                ["daftar", "Tampilan daftar", List],
              ] as const
            ).map(([nilai, label, Ikon]) => (
              <Button
                key={nilai}
                type="button"
                variant={tampilan === nilai ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-8"
                title={label}
                aria-label={label}
                aria-pressed={tampilan === nilai}
                onClick={() => gantiTampilan(nilai)}
              >
                <Ikon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tampil.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <FilePen className="h-8 w-8" />
          {tab === "perlu-ttd" ? "Tidak ada dokumen yang menunggu tanda tangan Anda." : "Belum ada dokumen."}
        </div>
      ) : (
        <DaftarDokumen rows={tampil} tampilan={tampilan} />
      )}
    </Content>
  );
}
