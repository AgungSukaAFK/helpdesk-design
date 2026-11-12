"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Pencil,
  PenLine,
  Printer,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LembarDokumen, type TtdLembar } from "@/components/dokumen-desain/lembar-dokumen";
import { SignatureDialog, type HasilTtd } from "@/components/dokumen-desain/signature-dialog";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { STATUS_META, normalizeStatus } from "@/lib/permintaan-workflow";
import {
  DOKUMEN_STATUS_META,
  PERAN_LABEL,
  normalizeDokumenStatus,
  type PeranTtd,
} from "@/lib/dokumen-desain";
import { cn } from "@/lib/utils";

interface TtdDetail extends TtdLembar {
  user_id: string;
  peran: PeranTtd;
  catatan: string | null;
}

interface DokumenDetail {
  id: string;
  created_at: string;
  updated_at: string;
  permintaan_id: string;
  hasil_file: { name: string; url: string };
  no_dokumen: string;
  no_dokumen_sub: string | null;
  project_design: string;
  tipe_design: string;
  deskripsi: string;
  status: string;
  revisi: number;
  created_by: string;
  created_by_name: string;
  disetujui_at: string | null;
  permintaan: {
    id: string;
    judul: string;
    project: string | null;
    departemen: string | null;
    status: string;
    requester_name: string;
  } | null;
  ttd: TtdDetail[];
  riwayat: { id: string; created_at: string; aksi: string; catatan: string | null; nama: string }[];
}

const fmtWaktu = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const AKSI_LABEL: Record<string, string> = {
  DIBUAT: "Membuat dokumen",
  DIUBAH: "Mengubah dokumen",
  DIREVISI: "Merevisi dokumen (TTD direset)",
  DITANDATANGANI: "Menandatangani",
  DITOLAK: "Menolak dokumen",
  DISETUJUI: "Dokumen disetujui lengkap",
};

// Saat dicetak hanya lembar dokumen yang tampil, ukuran A4 landscape.
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 6mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #lembar-dokumen-desain, #lembar-dokumen-desain * { visibility: visible !important; }
  #lembar-dokumen-desain {
    position: fixed !important; left: 0; top: 0;
    width: 100% !important; min-width: 0 !important; height: 100% !important;
    aspect-ratio: auto !important; box-shadow: none !important; padding: 0 !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}`;

export default function DetailDokumenDesainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DokumenDetail | null>(null);
  const [akses, setAkses] = useState({ edit: false, hapus: false, tandaTangan: false });
  const [ttdTersimpan, setTtdTersimpan] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ttdOpen, setTtdOpen] = useState(false);
  const [tolakOpen, setTolakOpen] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [hapusOpen, setHapusOpen] = useState(false);
  const [proses, setProses] = useState(false);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dokumen-desain/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat dokumen");
      setData(json.data);
      setAkses(json.akses);
      setTtdTersimpan(json.ttdTersimpanUrl);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    getCurrentUser().then(({ data: { user } }) => setUserId(user?.id ?? ""));
    void muat();
  }, [muat]);

  const kirimTtd = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/dokumen-desain/${id}/ttd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal memproses tanda tangan");
      return false;
    }
    await muat();
    return json;
  };

  const setujui = async (hasil: HasilTtd) => {
    const json = await kirimTtd({ aksi: "setujui", ...hasil });
    if (json) {
      toast.success(json.status === "DISETUJUI" ? "Tanda tangan tersimpan. Dokumen kini disetujui lengkap." : "Tanda tangan tersimpan.");
    }
    return !!json;
  };

  const tolak = async () => {
    if (!alasan.trim()) return toast.error("Alasan penolakan wajib diisi.");
    setProses(true);
    const json = await kirimTtd({ aksi: "tolak", catatan: alasan });
    setProses(false);
    if (json) {
      toast.success("Dokumen ditolak. Pembuat dokumen sudah diberi notifikasi.");
      setTolakOpen(false);
      setAlasan("");
    }
  };

  const hapus = async () => {
    setProses(true);
    const res = await fetch(`/api/dokumen-desain/${id}`, { method: "DELETE" });
    const json = await res.json();
    setProses(false);
    if (!res.ok) return toast.error(json.error || "Gagal menghapus dokumen");
    toast.success("Dokumen dihapus.");
    router.push("/dokumen-desain");
  };

  if (loading && !data) {
    return (
      <Content title="Dokumen Form Desain">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  if (!data) {
    return (
      <Content
        title="Dokumen Form Desain"
        cardAction={
          <Button variant="outline" asChild>
            <Link href="/dokumen-desain">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Link>
          </Button>
        }
      >
        <p className="py-10 text-center text-sm text-muted-foreground">{error || "Dokumen tidak ditemukan."}</p>
      </Content>
    );
  }

  const status = normalizeDokumenStatus(data.status);
  const peranSaya = data.ttd
    .filter((t) => t.user_id === userId && t.status === "MENUNGGU")
    .map((t) => (t.jabatan ? `${PERAN_LABEL[t.peran]} (${t.jabatan})` : PERAN_LABEL[t.peran]));
  const ditolak = data.ttd.filter((t) => t.status === "DITOLAK");
  const selesai = data.ttd.filter((t) => t.status === "DISETUJUI").length;

  return (
    <>
      <style>{PRINT_CSS}</style>

      <Content
        title={`${data.project_design} — ${data.tipe_design}`}
        description={`${data.no_dokumen}${data.no_dokumen_sub ? ` · ${data.no_dokumen_sub}` : ""}${data.revisi ? ` · Revisi ${data.revisi}` : ""}`}
        cardAction={
          <>
            <Button variant="ghost" size="icon" onClick={muat} title="Muat ulang">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Cetak / PDF
            </Button>
            {akses.edit && (
              <Button variant="outline" asChild>
                <Link href={`/dokumen-desain/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" /> {status === "DITOLAK" ? "Revisi" : "Edit"}
                </Link>
              </Button>
            )}
            {akses.hapus && (
              <Button variant="outline" className="text-destructive" onClick={() => setHapusOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Hapus
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/dokumen-desain">
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
              </Link>
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Banner status / aksi */}
          {akses.tandaTangan ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">Dokumen ini menunggu tanda tangan Anda</div>
                <div className="text-sm text-muted-foreground">
                  Sebagai {peranSaya.join(", ")}. Periksa lembar di bawah, lalu setujui atau tolak.
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="text-destructive" onClick={() => setTolakOpen(true)}>
                  <XCircle className="mr-2 h-4 w-4" /> Tolak
                </Button>
                <Button onClick={() => setTtdOpen(true)}>
                  <PenLine className="mr-2 h-4 w-4" /> Setujui & Tanda Tangan
                </Button>
              </div>
            </div>
          ) : status === "DITOLAK" ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-4">
              <div className="font-semibold text-rose-700 dark:text-rose-400">Dokumen ditolak</div>
              {ditolak.map((t) => (
                <div key={t.id} className="mt-1 text-sm">
                  <b>{t.nama}</b> ({PERAN_LABEL[t.peran]}): {t.catatan || "-"}
                </div>
              ))}
              {akses.edit && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Klik <b>Revisi</b> untuk memperbaiki dokumen; semua penanda tangan akan diminta tanda tangan ulang.
                </div>
              )}
            </div>
          ) : status === "DISETUJUI" ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Disetujui lengkap</span> pada{" "}
              {fmtWaktu(data.disetujui_at)}. Dokumen terkunci dan siap dicetak.
            </div>
          ) : null}

          {/* Lembar dokumen */}
          <div className="overflow-x-auto rounded-lg border bg-muted/40 p-3">
            <LembarDokumen data={data} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Info */}
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <h3 className="font-semibold">Informasi</h3>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={DOKUMEN_STATUS_META[status].badgeClass}>
                  {DOKUMEN_STATUS_META[status].label}
                </Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Permintaan desain</div>
                {data.permintaan ? (
                  <Link href={`/permintaan-desain/${data.permintaan.id}`} className="inline-flex items-center gap-1 font-medium hover:underline">
                    {data.permintaan.judul} <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  "-"
                )}
                {data.permintaan && (
                  <div className="text-xs text-muted-foreground">
                    {STATUS_META[normalizeStatus(data.permintaan.status)].short} · Peminta: {data.permintaan.requester_name}
                    {data.permintaan.departemen && ` · ${data.permintaan.departemen}`}
                  </div>
                )}
              </div>
              <div>
                <div className="text-muted-foreground">Hasil desain</div>
                <a href={data.hasil_file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-medium hover:underline">
                  {data.hasil_file.name} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <div>
                <div className="text-muted-foreground">Dibuat</div>
                <div>
                  {data.created_by_name} · {fmtWaktu(data.created_at)}
                </div>
              </div>
            </div>

            {/* Progres tanda tangan */}
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <h3 className="font-semibold">
                Tanda Tangan ({selesai}/{data.ttd.length})
              </h3>
              <ul className="space-y-2.5">
                {data.ttd.map((t) => (
                  <li key={t.id} className="flex gap-2">
                    {t.status === "DISETUJUI" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : t.status === "DITOLAK" ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium">
                        {t.nama}
                        {t.user_id === userId && <span className="text-muted-foreground"> (Anda)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {PERAN_LABEL[t.peran]}
                        {t.jabatan && ` · ${t.jabatan}`}
                        {t.signed_at && ` · ${fmtWaktu(t.signed_at)}`}
                      </div>
                      {t.catatan && <div className="mt-0.5 text-xs italic">“{t.catatan}”</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Riwayat */}
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <h3 className="font-semibold">Riwayat</h3>
              <ol className="relative space-y-3 border-l pl-4">
                {data.riwayat.map((r) => (
                  <li key={r.id}>
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border bg-background" />
                    <div>
                      <b>{r.nama}</b> — {AKSI_LABEL[r.aksi] ?? r.aksi}
                    </div>
                    {r.catatan && <div className="text-xs italic">“{r.catatan}”</div>}
                    <div className="text-xs text-muted-foreground">{fmtWaktu(r.created_at)}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </Content>

      <SignatureDialog
        open={ttdOpen}
        onOpenChange={setTtdOpen}
        tersimpanUrl={ttdTersimpan}
        peranLabel={peranSaya.join(", ")}
        onSubmit={setujui}
      />

      <Dialog open={tolakOpen} onOpenChange={(v) => !proses && setTolakOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Dokumen</DialogTitle>
            <DialogDescription>
              Pembuat dokumen akan diberi notifikasi. Dokumen perlu direvisi dan semua pihak menandatangani ulang.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="alasan">Alasan penolakan</Label>
          <Textarea
            id="alasan"
            rows={4}
            value={alasan}
            maxLength={1000}
            placeholder="Contoh: Warna logo belum sesuai brand guideline..."
            onChange={(e) => setAlasan(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTolakOpen(false)} disabled={proses}>
              Batal
            </Button>
            <Button variant="destructive" onClick={tolak} disabled={proses || !alasan.trim()}>
              {proses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tolak Dokumen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={hapusOpen} onOpenChange={setHapusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen {data.no_dokumen} beserta semua tanda tangannya akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={proses}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={hapus} disabled={proses}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
