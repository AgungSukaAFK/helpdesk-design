"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eraser, ImageUp, Loader2, PenLine, Signature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CANVAS_W = 600;
const CANVAS_H = 240;
const MAX_UPLOAD_MB = 5;

export type HasilTtd = { pakaiTersimpan: true } | { ttd: string; simpan: boolean };

/** Potong area kosong (transparan) di sekitar coretan, lalu kembalikan PNG data URL. */
export function trimCanvas(src: HTMLCanvasElement): string | null {
  const ctx = src.getContext("2d")!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const pad = 8;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);
  const out = document.createElement("canvas");
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext("2d")!.drawImage(src, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** Pad coretan tanda tangan dengan pointer (mouse, sentuh, stylus). */
export function PadGambar({ onChange }: { onChange: (canvas: HTMLCanvasElement | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [kosong, setKosong] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = CANVAS_W * ratio;
    c.height = CANVAS_H * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f1f5c";
    ctx.lineWidth = 2.6;
  }, []);

  const titik = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CANVAS_W, y: ((e.clientY - r.top) / r.height) * CANVAS_H };
  };

  const mulai = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = titik(e);
    last.current = p;
    const ctx = ref.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0f1f5c";
    ctx.fill();
  };

  const gerak = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = titik(e);
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const selesai = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setKosong(false);
    onChange(ref.current);
  };

  const hapus = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setKosong(true);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-md border-2 border-dashed bg-white">
        <canvas
          ref={ref}
          className="block w-full touch-none cursor-crosshair"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          onPointerDown={mulai}
          onPointerMove={gerak}
          onPointerUp={selesai}
          onPointerCancel={selesai}
          onPointerLeave={selesai}
        />
        {kosong && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Tanda tangan di sini
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-8 bottom-10 border-b border-slate-300" />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={hapus} disabled={kosong}>
        <Eraser className="mr-2 h-4 w-4" /> Bersihkan
      </Button>
    </div>
  );
}

/**
 * Gambar unggahan digambar ulang ke canvas. Latar terang dibuat transparan
 * (foto/scan tanda tangan di kertas putih) agar menyatu dengan lembar dokumen.
 */
function PadUpload({ onChange }: { onChange: (canvas: HTMLCanvasElement | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [hapusLatar, setHapusLatar] = useState(true);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  const proses = useCallback(
    (image: HTMLImageElement | null, buangLatar: boolean) => {
      if (!image) {
        setPreview(null);
        onChange(null);
        return;
      }
      const skala = Math.min(1, 900 / image.width, 400 / image.height);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(image.width * skala));
      c.height = Math.max(1, Math.round(image.height * skala));
      const ctx = c.getContext("2d")!;
      ctx.drawImage(image, 0, 0, c.width, c.height);
      if (buangLatar) {
        const d = ctx.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) {
          const terang = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
          if (terang > 200) d.data[i + 3] = 0;
          else if (terang > 150) d.data[i + 3] = Math.round(d.data[i + 3] * ((200 - terang) / 50));
        }
        ctx.putImageData(d, 0, 0);
      }
      setPreview(c.toDataURL("image/png"));
      onChange(c);
    },
    [onChange],
  );

  const pilih = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`Ukuran gambar maksimal ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      setImg(image);
      proses(image, hapusLatar);
    };
    image.onerror = () => toast.error("Gambar tidak dapat dibaca.");
    image.src = url;
  };

  return (
    <div className="space-y-3">
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-white p-4 text-sm text-slate-500 hover:bg-slate-50">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Pratinjau tanda tangan" className="max-h-36 object-contain" />
        ) : (
          <>
            <ImageUp className="h-6 w-6" />
            <span>Klik untuk memilih gambar tanda tangan (PNG/JPG)</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            pilih(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <div className="flex items-center gap-2">
        <Checkbox
          id="hapus-latar"
          checked={hapusLatar}
          onCheckedChange={(v) => {
            setHapusLatar(!!v);
            proses(img, !!v);
          }}
        />
        <Label htmlFor="hapus-latar" className="text-sm font-normal">
          Hilangkan latar putih (untuk foto/scan tanda tangan di kertas)
        </Label>
      </div>
    </div>
  );
}

export function SignatureDialog({
  open,
  onOpenChange,
  tersimpanUrl,
  peranLabel,
  onSubmit,
  judul = "Setujui & Tanda Tangan",
  labelTombol = "Setujui & Tanda Tangani",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tersimpanUrl?: string | null;
  peranLabel: string;
  onSubmit: (hasil: HasilTtd) => Promise<boolean>;
  judul?: string;
  labelTombol?: string;
  /** Isian tambahan di bawah pad tanda tangan. */
  children?: React.ReactNode;
}) {
  const [tab, setTab] = useState<string>(tersimpanUrl ? "tersimpan" : "gambar");
  const [canvasGambar, setCanvasGambar] = useState<HTMLCanvasElement | null>(null);
  const [canvasUpload, setCanvasUpload] = useState<HTMLCanvasElement | null>(null);
  const [simpan, setSimpan] = useState(!tersimpanUrl);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(tersimpanUrl ? "tersimpan" : "gambar");
      setCanvasGambar(null);
      setCanvasUpload(null);
      setSimpan(!tersimpanUrl);
    }
  }, [open, tersimpanUrl]);

  const kirim = async () => {
    let hasil: HasilTtd;
    if (tab === "tersimpan") {
      hasil = { pakaiTersimpan: true };
    } else {
      const canvas = tab === "gambar" ? canvasGambar : canvasUpload;
      const dataUrl = canvas ? trimCanvas(canvas) : null;
      if (!dataUrl) {
        toast.error(tab === "gambar" ? "Silakan buat tanda tangan terlebih dahulu." : "Silakan pilih gambar tanda tangan.");
        return;
      }
      hasil = { ttd: dataUrl, simpan };
    }
    setLoading(true);
    const ok = await onSubmit(hasil);
    setLoading(false);
    if (ok) onOpenChange(false);
  };

  const siap = tab === "tersimpan" || (tab === "gambar" ? !!canvasGambar : !!canvasUpload);

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>
            Anda menandatangani dokumen ini sebagai <b>{peranLabel}</b>. Tanda tangan tidak dapat diubah
            setelah dikirim.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            {tersimpanUrl && (
              <TabsTrigger value="tersimpan" className="flex-1">
                <Signature className="mr-1.5 h-4 w-4" /> Tersimpan
              </TabsTrigger>
            )}
            <TabsTrigger value="gambar" className="flex-1">
              <PenLine className="mr-1.5 h-4 w-4" /> Gambar
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">
              <ImageUp className="mr-1.5 h-4 w-4" /> Upload
            </TabsTrigger>
          </TabsList>
          {tersimpanUrl && (
            <TabsContent value="tersimpan">
              <div className="flex min-h-40 items-center justify-center rounded-md border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tersimpanUrl} alt="Tanda tangan tersimpan" className="max-h-36 object-contain" />
              </div>
            </TabsContent>
          )}
          <TabsContent value="gambar" forceMount hidden={tab !== "gambar"}>
            <PadGambar onChange={setCanvasGambar} />
          </TabsContent>
          <TabsContent value="upload" forceMount hidden={tab !== "upload"}>
            <PadUpload onChange={setCanvasUpload} />
          </TabsContent>
        </Tabs>

        {tab !== "tersimpan" && (
          <div className="flex items-center gap-2">
            <Checkbox id="simpan-ttd" checked={simpan} onCheckedChange={(v) => setSimpan(!!v)} />
            <Label htmlFor="simpan-ttd" className="text-sm font-normal">
              {tersimpanUrl ? "Ganti tanda tangan tersimpan saya dengan ini" : "Simpan tanda tangan ini untuk dokumen berikutnya"}
            </Label>
          </div>
        )}

        {children}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button onClick={kirim} disabled={loading || !siap}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {labelTombol}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
