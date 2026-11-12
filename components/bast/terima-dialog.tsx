"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PadGambar, trimCanvas } from "@/components/dokumen-desain/signature-dialog";
import { MAKS_BUKTI, MAKS_SCAN_BYTES } from "@/lib/bast";

/** Perkecil foto (sisi terpanjang 1600px, JPEG) supaya unggahan ringan. */
export async function kompresFoto(file: File, maks = 1600, kualitas = 0.82): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, gagal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => gagal(new Error(`"${file.name}" tidak dapat dibaca.`));
      i.src = url;
    });
    const s = Math.min(1, maks / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", kualitas));
    if (!blob) throw new Error("Gagal memproses foto.");
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PilihBukti({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const [preview, setPreview] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreview(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const tambah = async (list: FileList | null) => {
    const pilih = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length + pilih.length > MAKS_BUKTI) toast.warning(`Maksimal ${MAKS_BUKTI} foto.`);
    try {
      const hasil = await Promise.all(pilih.slice(0, MAKS_BUKTI - files.length).map((f) => kompresFoto(f)));
      setFiles([...files, ...hasil]);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Foto bukti serah terima (opsional)</Label>
      <div className="flex flex-wrap gap-2">
        {preview.map((u, i) => (
          <div key={u} className="relative h-20 w-20 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Bukti ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
              onClick={() => setFiles(files.filter((_, j) => j !== i))}
              aria-label="Hapus foto"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {files.length < MAKS_BUKTI && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted-foreground hover:bg-muted/50">
            <Camera className="h-5 w-5" />
            Foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              onChange={(e) => {
                void tambah(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * Catat penerimaan barang.
 * - langsung: penerima mengisi nama/dept dan tanda tangan di perangkat ini
 * - scan: unggah scan/foto surat yang sudah ditandatangani basah
 */
export function TerimaDialog({
  open,
  onOpenChange,
  metode,
  bastId,
  instansi,
  namaAwal,
  deptAwal,
  onSelesai,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metode: "langsung" | "scan";
  bastId: string;
  instansi: string;
  namaAwal?: string | null;
  deptAwal?: string | null;
  onSelesai: () => void;
}) {
  const [nama, setNama] = useState("");
  const [dept, setDept] = useState("");
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [scan, setScan] = useState<File | null>(null);
  const [bukti, setBukti] = useState<File[]>([]);
  const [proses, setProses] = useState(false);
  const [padKey, setPadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setNama(namaAwal ?? "");
    setDept(deptAwal ?? "");
    setCanvas(null);
    setScan(null);
    setBukti([]);
    setPadKey((k) => k + 1);
  }, [open, namaAwal, deptAwal]);

  const pilihScan = async (f?: File) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.type.startsWith("image/")) return toast.error("Scan harus PDF atau gambar.");
    try {
      // Foto/scan gambar dikompres ringan; PDF dikirim apa adanya
      const hasil = f.type.startsWith("image/") ? await kompresFoto(f, 2400, 0.88) : f;
      if (hasil.size > MAKS_SCAN_BYTES) return toast.error(`Ukuran scan maksimal ${MAKS_SCAN_BYTES / 1024 / 1024} MB.`);
      setScan(hasil);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const kirim = async () => {
    if (!nama.trim() || !dept.trim()) return toast.error("Nama dan departemen penerima wajib diisi.");
    const form = new FormData();
    form.set("metode", metode);
    form.set("nama", nama);
    form.set("dept", dept);
    if (metode === "langsung") {
      const ttd = canvas ? trimCanvas(canvas) : null;
      if (!ttd) return toast.error("Penerima belum tanda tangan.");
      form.set("ttd", ttd);
    } else {
      if (!scan) return toast.error("Pilih file scan surat.");
      form.set("scan", scan);
    }
    bukti.forEach((f) => form.append("bukti", f));

    setProses(true);
    try {
      const res = await fetch(`/api/bast/${bastId}/terima`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal mencatat penerimaan");
      toast.success("Serah terima tercatat. BAST kini berstatus Diterima.");
      onOpenChange(false);
      onSelesai();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProses(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !proses && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{metode === "langsung" ? "Serah Terima Sekarang" : "Unggah Scan BAST Bertanda Tangan"}</DialogTitle>
          <DialogDescription>
            {metode === "langsung" ? (
              <>
                Serahkan perangkat ini ke perwakilan <b>{instansi}</b> untuk mengisi nama dan tanda tangan sebagai penerima.
              </>
            ) : (
              <>Untuk surat yang dicetak lalu ditandatangani basah oleh kedua pihak. Unggah scan atau fotonya (PDF/JPG/PNG).</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="terima-nama">Nama penerima *</Label>
            <Input id="terima-nama" value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="terima-dept">Dept *</Label>
            <Input id="terima-dept" value={dept} onChange={(e) => setDept(e.target.value)} />
          </div>
        </div>

        {metode === "langsung" ? (
          <div className="space-y-1.5">
            <Label>Tanda tangan penerima *</Label>
            <PadGambar key={padKey} onChange={setCanvas} />
          </div>
        ) : (
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center text-sm text-muted-foreground hover:bg-muted/50">
            <FileUp className="h-6 w-6" />
            {scan ? (
              <span className="break-all font-medium text-foreground">
                {scan.name} · {(scan.size / 1024 / 1024).toFixed(1)} MB
              </span>
            ) : (
              <span>Klik untuk memilih scan/foto surat (PDF atau gambar, maks. {MAKS_SCAN_BYTES / 1024 / 1024} MB)</span>
            )}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              onChange={(e) => {
                void pilihScan(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}

        <PilihBukti files={bukti} setFiles={setBukti} />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={proses}>
            Batal
          </Button>
          <Button onClick={kirim} disabled={proses}>
            {proses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Serah Terima
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
