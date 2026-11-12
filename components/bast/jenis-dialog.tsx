"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNomorBast, type ModeBarang } from "@/lib/bast";
import { cn } from "@/lib/utils";

export interface JenisBast {
  id: string;
  nama: string;
  kode: string;
  judul_default: string | null;
  mode_default: ModeBarang;
  kolom_default: string[];
  klausul_default: string | null;
  urutan: number;
}

interface Draf {
  id?: string;
  nama: string;
  kode: string;
  judul_default: string;
  mode_default: ModeBarang;
  kolom: string;
  klausul_default: string;
  urutan: number;
}

const kosong = (urutan: number): Draf => ({
  nama: "",
  kode: "",
  judul_default: "",
  mode_default: "daftar",
  kolom: "Nama Barang, Ukuran, Jumlah",
  klausul_default: "",
  urutan,
});

/** Kelola jenis BAST: nama, kode nomor, dan isian bawaan form. */
export function JenisDialog({
  open,
  onOpenChange,
  jenis,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jenis: JenisBast[];
  onChanged: (list: JenisBast[]) => void;
}) {
  const [draf, setDraf] = useState<Draf | null>(null);
  const [proses, setProses] = useState(false);

  const ubah = (patch: Partial<Draf>) => setDraf((d) => (d ? { ...d, ...patch } : d));

  const simpan = async () => {
    if (!draf) return;
    setProses(true);
    try {
      const res = await fetch("/api/bast/jenis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draf,
          kolom_default: draf.kolom.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan jenis");
      const baru: JenisBast = json.data;
      const list = draf.id ? jenis.map((j) => (j.id === baru.id ? baru : j)) : [...jenis, baru];
      onChanged(list.sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama)));
      toast.success(draf.id ? "Jenis diperbarui." : "Jenis ditambahkan.");
      setDraf(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProses(false);
    }
  };

  const hapus = async (j: JenisBast) => {
    if (!confirm(`Hapus jenis "${j.nama}"? BAST yang sudah dibuat tidak terpengaruh.`)) return;
    const res = await fetch(`/api/bast/jenis?id=${j.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error || "Gagal menghapus jenis");
    onChanged(jenis.filter((x) => x.id !== j.id));
    toast.success("Jenis dihapus.");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (proses) return;
        if (!v) setDraf(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draf ? (draf.id ? "Ubah Jenis BAST" : "Tambah Jenis BAST") : "Jenis BAST"}</DialogTitle>
          <DialogDescription>
            Jenis menentukan kode pada nomor surat serta judul, bentuk daftar barang, dan klausul yang terisi otomatis
            di form.
          </DialogDescription>
        </DialogHeader>

        {draf ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nama jenis *</Label>
                <Input
                  value={draf.nama}
                  placeholder="mis. Banner"
                  onChange={(e) =>
                    ubah({
                      nama: e.target.value,
                      kode: !draf.id && draf.kode === draf.nama.toUpperCase() ? e.target.value.toUpperCase() : draf.kode,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kode di nomor *</Label>
                <Input value={draf.kode} placeholder="BANNER" onChange={(e) => ubah({ kode: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <p className="-mt-2 font-mono text-xs text-muted-foreground">
              {formatNomorBast(draf.kode || "KODE", new Date().getFullYear())}
            </p>
            <div className="space-y-1.5">
              <Label>Judul barang bawaan</Label>
              <Input
                value={draf.judul_default}
                placeholder="mis. Stiker Id Card {tahun} Atas nama Berikut:"
                onChange={(e) => ubah({ judul_default: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Tulis <code>{"{tahun}"}</code> untuk diganti tahun tanggal BAST.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Bentuk daftar barang</Label>
              <div className="inline-flex rounded-lg border p-0.5">
                {(["daftar", "tabel"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => ubah({ mode_default: m })}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm capitalize",
                      draf.mode_default === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {draf.mode_default === "tabel" && (
              <div className="space-y-1.5">
                <Label>Kolom tabel (pisahkan dengan koma)</Label>
                <Input value={draf.kolom} onChange={(e) => ubah({ kolom: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Klausul bawaan</Label>
              <Textarea
                rows={4}
                value={draf.klausul_default}
                placeholder="Ketentuan tanggung jawab setelah barang diterima..."
                onChange={(e) => ubah({ klausul_default: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDraf(null)} disabled={proses}>
                Kembali
              </Button>
              <Button onClick={simpan} disabled={proses || !draf.nama.trim() || !draf.kode.trim()}>
                {proses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="divide-y rounded-lg border">
              {jenis.length === 0 && <li className="p-4 text-sm text-muted-foreground">Belum ada jenis.</li>}
              {jenis.map((j) => (
                <li key={j.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {j.nama}
                      <Badge variant="outline" className="font-normal capitalize">
                        {j.mode_default}
                      </Badge>
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">BAST-{j.kode}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Ubah"
                    onClick={() =>
                      setDraf({
                        id: j.id,
                        nama: j.nama,
                        kode: j.kode,
                        judul_default: j.judul_default ?? "",
                        mode_default: j.mode_default,
                        kolom: (j.kolom_default ?? []).join(", "),
                        klausul_default: j.klausul_default ?? "",
                        urutan: j.urutan,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Hapus" className="text-destructive" onClick={() => hapus(j)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDraf(kosong(Math.max(0, ...jenis.map((j) => j.urutan)) + 1))}
            >
              <Plus className="mr-2 h-4 w-4" /> Tambah Jenis
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
