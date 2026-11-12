"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  PenLine,
  Printer,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CetakBast, LembarBast } from "@/components/bast/lembar-bast";
import { SkalaLembar } from "@/components/bast/skala-lembar";
import { TerimaDialog } from "@/components/bast/terima-dialog";
import { SignatureDialog, type HasilTtd } from "@/components/dokumen-desain/signature-dialog";
import { STATUS_META, normalizeStatus } from "@/lib/permintaan-workflow";
import {
  BAST_STATUS_META,
  METODE_LABEL,
  normalizeBastStatus,
  tanggalSingkat,
  type MetodeTerima,
  type ModeBarang,
} from "@/lib/bast";
import { cn } from "@/lib/utils";

interface BastDetail {
  id: string;
  created_at: string;
  no_dokumen: string;
  jenis_nama: string;
  tanggal: string;
  kota: string;
  penyerah_id: string;
  penyerah_nama: string;
  penyerah_divisi: string;
  penyerah_signed_at: string | null;
  judul_barang: string;
  mode: ModeBarang;
  kolom: string[];
  items: string[][];
  penerima_instansi: string;
  penerima_user_id: string | null;
  penerima_user_nama: string | null;
  penerima_nama: string | null;
  penerima_dept: string | null;
  penerima_signed_at: string | null;
  klausul: string | null;
  status: string;
  metode_terima: MetodeTerima | null;
  diterima_at: string | null;
  diterima_oleh_nama: string | null;
  created_by_name: string;
  penyerah_ttd_url: string | null;
  penerima_ttd_url: string | null;
  scan_url: string | null;
  scan_nama: string | null;
  scan_pdf: boolean;
  bukti_urls: string[];
  permintaan: { id: string; judul: string; status: string; departemen: string | null }[];
  riwayat: { id: string; created_at: string; aksi: string; catatan: string | null; nama: string }[];
}

const AKSES_KOSONG = {
  edit: false,
  hapus: false,
  ttdPenyerah: false,
  terimaLangsung: false,
  terimaScan: false,
  terimaAkun: false,
  bukaKembali: false,
};

const AKSI_LABEL: Record<string, string> = {
  DIBUAT: "Membuat BAST",
  DIUBAH: "Mengubah BAST",
  TTD_PENYERAH: "Menandatangani sebagai penyerah",
  DITERIMA: "Mencatat serah terima",
  DIBUKA_KEMBALI: "Membuka kembali BAST",
};

const fmtWaktu = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";

export default function DetailBastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<BastDetail | null>(null);
  const [akses, setAkses] = useState(AKSES_KOSONG);
  const [ttdTersimpan, setTtdTersimpan] = useState<string | null>(null);
  const [departemenSaya, setDepartemenSaya] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ttdOpen, setTtdOpen] = useState(false);
  const [terimaAkunOpen, setTerimaAkunOpen] = useState(false);
  const [deptAkun, setDeptAkun] = useState("");
  const [terima, setTerima] = useState<"langsung" | "scan" | null>(null);
  const [hapusOpen, setHapusOpen] = useState(false);
  const [bukaOpen, setBukaOpen] = useState(false);
  const [alasanBuka, setAlasanBuka] = useState("");
  const [proses, setProses] = useState(false);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bast/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat BAST");
      setData(json.data);
      setAkses(json.akses);
      setTtdTersimpan(json.ttdTersimpanUrl);
      setDepartemenSaya(json.departemenSaya);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const ttdPenyerah = async (hasil: HasilTtd) => {
    const res = await fetch(`/api/bast/${id}/ttd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hasil),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal menyimpan tanda tangan");
      return false;
    }
    toast.success("Tanda tangan penyerah tersimpan. BAST siap diserahterimakan.");
    await muat();
    return true;
  };

  const terimaAkun = async (hasil: HasilTtd) => {
    const form = new FormData();
    form.set("metode", "akun");
    form.set("dept", deptAkun);
    if ("pakaiTersimpan" in hasil) form.set("pakaiTersimpan", "1");
    else {
      form.set("ttd", hasil.ttd);
      if (hasil.simpan) form.set("simpan", "1");
    }
    const res = await fetch(`/api/bast/${id}/terima`, { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal mencatat penerimaan");
      return false;
    }
    toast.success("Barang diterima. Terima kasih!");
    await muat();
    return true;
  };

  const hapus = async () => {
    setProses(true);
    const res = await fetch(`/api/bast/${id}`, { method: "DELETE" });
    const json = await res.json();
    setProses(false);
    if (!res.ok) return toast.error(json.error || "Gagal menghapus BAST");
    toast.success("BAST dihapus.");
    router.push("/bast");
  };

  const bukaKembali = async () => {
    setProses(true);
    const res = await fetch(`/api/bast/${id}/terima?alasan=${encodeURIComponent(alasanBuka)}`, { method: "DELETE" });
    const json = await res.json();
    setProses(false);
    if (!res.ok) return toast.error(json.error || "Gagal membuka kembali");
    toast.success("BAST dibuka kembali. Penerimaan perlu dicatat ulang.");
    setBukaOpen(false);
    setAlasanBuka("");
    await muat();
  };

  const kembali = (
    <Button variant="outline" asChild>
      <Link href="/bast">
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Link>
    </Button>
  );

  if (!data) {
    return (
      <Content title="BAST" cardAction={kembali}>
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{error || "BAST tidak ditemukan."}</p>
        )}
      </Content>
    );
  }

  const status = normalizeBastStatus(data.status);
  const lembar = data;

  return (
    <>
      <CetakBast data={lembar} />

      <Content
        title={`BAST ${data.jenis_nama} — ${data.penerima_instansi}`}
        description={data.no_dokumen}
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
                <Link href={`/bast/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" /> Ubah
                </Link>
              </Button>
            )}
            {akses.hapus && (
              <Button variant="outline" className="text-destructive" onClick={() => setHapusOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Hapus
              </Button>
            )}
            {kembali}
          </>
        }
      >
        <div className="space-y-5">
          {/* Langkah berikutnya */}
          {status === "MENUNGGU" ? (
            <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
              {akses.ttdPenyerah ? (
                <Langkah
                  judul="Langkah 1 — Tanda tangan sebagai penyerah"
                  teks="Periksa isi surat di bawah, lalu tanda tangani. Setelah itu barang bisa diserahterimakan."
                >
                  <Button onClick={() => setTtdOpen(true)}>
                    <PenLine className="mr-2 h-4 w-4" /> Tanda Tangan Penyerah
                  </Button>
                </Langkah>
              ) : !data.penyerah_signed_at ? (
                <Langkah
                  judul="Menunggu tanda tangan penyerah"
                  teks={`${data.penyerah_nama} perlu menandatangani BAST ini sebelum serah terima digital.`}
                />
              ) : akses.terimaAkun ? (
                <Langkah
                  judul="Barang ini diserahkan kepada Anda"
                  teks="Periksa daftar barang, lalu terima dan tanda tangani sebagai penerima."
                >
                  <Button
                    onClick={() => {
                      setDeptAkun(data.penerima_dept || departemenSaya || "");
                      setTerimaAkunOpen(true);
                    }}
                  >
                    <PenLine className="mr-2 h-4 w-4" /> Terima & Tanda Tangan
                  </Button>
                </Langkah>
              ) : (
                <Langkah
                  judul={akses.terimaLangsung ? "Langkah 2 — Serah terima" : "Menunggu serah terima"}
                  teks={
                    akses.terimaLangsung
                      ? `Saat bertemu perwakilan ${data.penerima_instansi}, minta mereka tanda tangan langsung di perangkat ini.${
                          data.penerima_user_id ? ` ${data.penerima_user_nama} juga bisa menandatangani sendiri dari akunnya.` : ""
                        }`
                      : `Penerimaan akan dicatat oleh ${data.penyerah_nama}.`
                  }
                >
                  {akses.terimaLangsung && (
                    <Button onClick={() => setTerima("langsung")}>
                      <Smartphone className="mr-2 h-4 w-4" /> Serah Terima Sekarang
                    </Button>
                  )}
                </Langkah>
              )}
              {akses.terimaScan && (
                <div className="flex flex-col gap-2 border-t border-primary/20 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">
                    Pakai kertas? <b>Cetak</b>, tanda tangani basah oleh kedua pihak, lalu unggah scan/fotonya.
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setTerima("scan")}>
                    <Upload className="mr-2 h-4 w-4" /> Unggah Scan
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Diterima</span> oleh{" "}
                <b>{data.penerima_nama}</b> ({data.penerima_dept}) pada {fmtWaktu(data.diterima_at)}.
                <div className="text-muted-foreground">
                  {data.metode_terima && METODE_LABEL[data.metode_terima]}
                  {data.metode_terima !== "akun" && data.diterima_oleh_nama && ` · dicatat oleh ${data.diterima_oleh_nama}`}
                </div>
              </div>
              {akses.bukaKembali && (
                <Button variant="outline" size="sm" onClick={() => setBukaOpen(true)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Buka Kembali
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 rounded-lg border bg-muted/40 p-2 sm:p-3">
              <SkalaLembar>
                <LembarBast data={lembar} />
              </SkalaLembar>
            </div>

            <div className="space-y-5">
              <div className="space-y-3 rounded-lg border p-4 text-sm">
                <h3 className="font-semibold">Informasi</h3>
                <Baris label="Status">
                  <Badge variant="outline" className={BAST_STATUS_META[status].badgeClass}>
                    {BAST_STATUS_META[status].label}
                  </Badge>
                </Baris>
                <Baris label="Jenis">{data.jenis_nama}</Baris>
                <Baris label="Tanggal">{tanggalSingkat(data.tanggal)}</Baris>
                <Baris label="Jumlah item">{data.items.length}</Baris>
                <div>
                  <div className="text-muted-foreground">Penyerah</div>
                  <div>
                    {data.penyerah_nama} · {data.penyerah_divisi}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.penyerah_signed_at ? `TTD ${fmtWaktu(data.penyerah_signed_at)}` : "Belum tanda tangan"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Penerima</div>
                  <div>
                    {data.penerima_instansi}
                    {data.penerima_nama && ` · ${data.penerima_nama}`}
                  </div>
                  {data.penerima_user_nama && (
                    <div className="text-xs text-muted-foreground">Akun: {data.penerima_user_nama}</div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Permintaan terkait</div>
                  {data.permintaan.length === 0 ? (
                    <div className="text-muted-foreground">-</div>
                  ) : (
                    <ul className="space-y-1">
                      {data.permintaan.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/permintaan-desain/${p.id}`}
                            className="inline-flex items-center gap-1 font-medium hover:underline"
                          >
                            {p.judul} <ExternalLink className="h-3 w-3 shrink-0" />
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {STATUS_META[normalizeStatus(p.status)].short}
                            {p.departemen && ` · ${p.departemen}`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Dibuat {data.created_by_name} · {fmtWaktu(data.created_at)}
                </div>
              </div>

              {(data.scan_url || data.bukti_urls.length > 0) && (
                <div className="space-y-3 rounded-lg border p-4 text-sm">
                  <h3 className="font-semibold">Bukti Serah Terima</h3>
                  {data.scan_url && (
                    <a
                      href={data.scan_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50"
                    >
                      {data.scan_pdf ? (
                        <FileText className="h-8 w-8 shrink-0 text-rose-500" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.scan_url} alt="Scan BAST" className="h-12 w-12 shrink-0 rounded object-cover" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">{data.scan_nama || "Scan BAST"}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  )}
                  {data.bukti_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {data.bukti_urls.map((u, i) => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="aspect-square overflow-hidden rounded-md border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Foto bukti ${i + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
        </div>
      </Content>

      <SignatureDialog
        open={ttdOpen}
        onOpenChange={setTtdOpen}
        tersimpanUrl={ttdTersimpan}
        peranLabel="Penyerah"
        judul="Tanda Tangan Penyerah"
        labelTombol="Tanda Tangani"
        onSubmit={ttdPenyerah}
      />

      <SignatureDialog
        open={terimaAkunOpen}
        onOpenChange={setTerimaAkunOpen}
        tersimpanUrl={ttdTersimpan}
        peranLabel={`Penerima (${data.penerima_instansi})`}
        judul="Terima Barang & Tanda Tangan"
        labelTombol="Terima & Tanda Tangani"
        onSubmit={terimaAkun}
      >
        <div className="space-y-1.5">
          <Label htmlFor="dept-akun">Dept</Label>
          <Input id="dept-akun" value={deptAkun} onChange={(e) => setDeptAkun(e.target.value)} />
        </div>
      </SignatureDialog>

      {terima && (
        <TerimaDialog
          open={!!terima}
          onOpenChange={(v) => !v && setTerima(null)}
          metode={terima}
          bastId={id}
          instansi={data.penerima_instansi}
          namaAwal={data.penerima_nama}
          deptAwal={data.penerima_dept}
          onSelesai={muat}
        />
      )}

      <AlertDialog open={hapusOpen} onOpenChange={setHapusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus BAST ini?</AlertDialogTitle>
            <AlertDialogDescription>
              BAST {data.no_dokumen} beserta tanda tangan dan bukti serah terimanya akan dihapus permanen.
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

      <AlertDialog open={bukaOpen} onOpenChange={(v) => !proses && setBukaOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buka kembali BAST?</AlertDialogTitle>
            <AlertDialogDescription>
              Status kembali ke Menunggu. Tanda tangan penerima, scan, dan foto bukti dihapus sehingga penerimaan perlu
              dicatat ulang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="alasan-buka">Alasan</Label>
            <Input id="alasan-buka" value={alasanBuka} onChange={(e) => setAlasanBuka(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={proses}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={bukaKembali} disabled={proses || !alasanBuka.trim()}>
              Buka Kembali
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Langkah({ judul, teks, children }: { judul: string; teks: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-semibold">{judul}</div>
        <div className="text-sm text-muted-foreground">{teks}</div>
      </div>
      {children && <div className="flex shrink-0 gap-2">{children}</div>}
    </div>
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
