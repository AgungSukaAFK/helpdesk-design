"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FilePen, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import {
  DOKUMEN_STATUS_META,
  normalizeDokumenStatus,
  type DokumenStatus,
} from "@/lib/dokumen-desain";
import { cn } from "@/lib/utils";

interface DokumenRow {
  id: string;
  created_at: string;
  no_dokumen: string;
  no_dokumen_sub: string | null;
  project_design: string;
  tipe_design: string;
  deskripsi: string;
  status: string;
  revisi: number;
  created_by: string;
  created_by_name: string;
  permintaan_judul: string;
  hasil_files: { name: string; url: string }[] | null;
  ttd_total: number;
  ttd_selesai: number;
  perlu_ttd_saya: boolean;
}

const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function DokumenDesainPage() {
  const [rows, setRows] = useState<DokumenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [tab, setTab] = useState("semua");
  const [status, setStatus] = useState<"SEMUA" | DokumenStatus>("SEMUA");
  const [cari, setCari] = useState("");

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tampil.map((r) => {
            const st = normalizeDokumenStatus(r.status);
            const persen = r.ttd_total ? Math.round((r.ttd_selesai / r.ttd_total) * 100) : 0;
            return (
              <Link
                key={r.id}
                href={`/dokumen-desain/${r.id}`}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:border-primary/40 hover:shadow-md",
                  r.perlu_ttd_saya && "border-primary/50 ring-1 ring-primary/20",
                )}
              >
                <div className="relative aspect-[16/9] bg-muted">
                  {r.hasil_files?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.hasil_files[0].url} alt={r.hasil_files[0].name} className="h-full w-full object-contain" loading="lazy" />
                  )}
                  {(r.hasil_files?.length ?? 0) > 1 && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
                      +{r.hasil_files!.length - 1} gambar
                    </span>
                  )}
                  <Badge variant="outline" className={cn("absolute left-2 top-2 bg-background/90", DOKUMEN_STATUS_META[st].badgeClass)}>
                    {DOKUMEN_STATUS_META[st].label}
                  </Badge>
                  {r.perlu_ttd_saya && (
                    <Badge className="absolute right-2 top-2">Perlu TTD Anda</Badge>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.no_dokumen}
                    {r.no_dokumen_sub && ` · ${r.no_dokumen_sub}`}
                    {r.revisi > 0 && ` · Rev. ${r.revisi}`}
                  </div>
                  <div className="font-semibold leading-snug group-hover:text-primary">
                    {r.project_design} — {r.tipe_design}
                  </div>
                  <div className="line-clamp-1 text-sm text-muted-foreground">{r.permintaan_judul}</div>
                  <div className="mt-auto pt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>
                        TTD {r.ttd_selesai}/{r.ttd_total}
                      </span>
                      <span>
                        {r.created_by_name} · {fmtTanggal(r.created_at)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", st === "DITOLAK" ? "bg-rose-500" : "bg-emerald-500")}
                        style={{ width: `${st === "DITOLAK" ? 100 : persen}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Content>
  );
}
