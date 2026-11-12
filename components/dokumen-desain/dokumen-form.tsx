"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, ImageOff, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { STATUS_META, normalizeStatus } from "@/lib/permintaan-workflow";
import {
  MAKS_HASIL,
  NO_DOKUMEN_CONTOH,
  NO_DOKUMEN_SUB_CONTOH,
  validasiPenandaTangan,
  type InputPenandaTangan,
  type PeranTtd,
} from "@/lib/dokumen-desain";
import { LembarDokumen } from "./lembar-dokumen";

interface OpsiPermintaan {
  id: string;
  judul: string;
  project: string | null;
  departemen: string | null;
  status: string;
  admin: string | null;
  gambar: { name: string; url: string }[];
}

interface OpsiUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  departemen: string | null;
}

export interface NilaiAwalDokumen {
  permintaan_id: string;
  hasil_files: { name: string; url: string }[];
  tanggal_dokumen: string;
  no_dokumen: string;
  no_dokumen_sub: string | null;
  project_design: string;
  tipe_design: string;
  deskripsi: string;
  ttd: { user_id: string; peran: PeranTtd; jabatan: string | null }[];
}

interface Baris {
  key: number;
  user_id: string;
  jabatan: string;
}

let seq = 0;
/** yyyy-mm-dd hari ini menurut waktu lokal. */
const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const barisBaru = (user_id = "", jabatan = ""): Baris => ({ key: ++seq, user_id, jabatan });
const namaUser = (u?: OpsiUser) => u?.name || u?.email || "Tanpa nama";

/** Pilih satu item dari daftar dengan pencarian. */
function PilihCari<T extends { id: string }>({
  items,
  value,
  onChange,
  placeholder,
  label,
  detail,
  cari,
  disabledItem,
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  label: (item: T) => string;
  detail?: (item: T) => React.ReactNode;
  cari: (item: T) => string;
  disabledItem?: (item: T) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const terpilih = items.find((i) => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn("truncate", !terpilih && "text-muted-foreground")}>
            {terpilih ? label(terpilih) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari..." className="h-9" />
          <CommandList>
            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${cari(item)} ${item.id}`}
                  disabled={disabledItem?.(item)}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{label(item)}</div>
                    {detail && <div className="truncate text-xs text-muted-foreground">{detail(item)}</div>}
                  </div>
                  <Check className={cn("ml-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DaftarPenandaTangan({
  judul,
  keterangan,
  labelJabatan,
  placeholderJabatan,
  baris,
  setBaris,
  users,
  jabatanDefault,
  wajib,
}: {
  judul: string;
  keterangan: string;
  labelJabatan: string;
  placeholderJabatan: string;
  baris: Baris[];
  setBaris: (b: Baris[]) => void;
  users: OpsiUser[];
  jabatanDefault?: (u: OpsiUser) => string;
  wajib?: boolean;
}) {
  const ubah = (key: number, patch: Partial<Baris>) =>
    setBaris(baris.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {judul} {wajib && <span className="text-destructive">*</span>}
          </h3>
          <p className="text-xs text-muted-foreground">{keterangan}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setBaris([...baris, barisBaru()])}>
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      </div>
      {baris.length === 0 && <p className="text-sm italic text-muted-foreground">Belum ada.</p>}
      {baris.map((b, i) => (
        <div key={b.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            {i === 0 && <Label className="text-xs">Nama</Label>}
            <PilihCari
              items={users}
              value={b.user_id}
              placeholder="Pilih user..."
              label={namaUser}
              detail={(u) => [u.email, u.departemen].filter(Boolean).join(" · ")}
              cari={(u) => `${u.name ?? ""} ${u.email ?? ""} ${u.departemen ?? ""}`}
              disabledItem={(u) => baris.some((x) => x.key !== b.key && x.user_id === u.id)}
              onChange={(id) => {
                const u = users.find((x) => x.id === id);
                ubah(b.key, {
                  user_id: id,
                  jabatan: b.jabatan || (u && jabatanDefault ? jabatanDefault(u) : ""),
                });
              }}
            />
          </div>
          <div className="space-y-1">
            {i === 0 && <Label className="text-xs">{labelJabatan}</Label>}
            <Input
              value={b.jabatan}
              placeholder={placeholderJabatan}
              maxLength={100}
              onChange={(e) => ubah(b.key, { jabatan: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Hapus"
            onClick={() => setBaris(baris.filter((x) => x.key !== b.key))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function DokumenForm({
  dokumenId,
  nilaiAwal,
  permintaanAwal,
}: {
  dokumenId?: string;
  nilaiAwal?: NilaiAwalDokumen;
  permintaanAwal?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permintaanList, setPermintaanList] = useState<OpsiPermintaan[]>([]);
  const [users, setUsers] = useState<OpsiUser[]>([]);

  const [permintaanId, setPermintaanId] = useState(nilaiAwal?.permintaan_id ?? "");
  // Urutan pilih = urutan tampil di lembar dokumen
  const [hasilUrls, setHasilUrls] = useState<string[]>(nilaiAwal?.hasil_files.map((f) => f.url) ?? []);
  const [tanggal, setTanggal] = useState(nilaiAwal?.tanggal_dokumen ?? hariIni());
  const [noDokumen, setNoDokumen] = useState(nilaiAwal?.no_dokumen ?? "");
  const [noSub, setNoSub] = useState(nilaiAwal?.no_dokumen_sub ?? "");
  const [project, setProject] = useState(nilaiAwal?.project_design ?? "");
  const [tipe, setTipe] = useState(nilaiAwal?.tipe_design ?? "");
  const [deskripsi, setDeskripsi] = useState(nilaiAwal?.deskripsi ?? "");
  const [designerId, setDesignerId] = useState(
    nilaiAwal?.ttd.find((t) => t.peran === "designer")?.user_id ?? "",
  );
  const [acknowledge, setAcknowledge] = useState<Baris[]>(
    nilaiAwal?.ttd.filter((t) => t.peran === "acknowledge").map((t) => barisBaru(t.user_id, t.jabatan ?? "")) ?? [
      barisBaru(),
    ],
  );
  const [approval, setApproval] = useState<Baris[]>(
    nilaiAwal?.ttd.filter((t) => t.peran === "approval").map((t) => barisBaru(t.user_id, t.jabatan ?? "")) ?? [
      barisBaru(),
    ],
  );
  const [catatanRevisi, setCatatanRevisi] = useState("");

  useEffect(() => {
    let aktif = true;
    fetch("/api/dokumen-desain/opsi")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat data");
        if (!aktif) return;
        setPermintaanList(json.permintaan);
        setUsers(json.users);
        if (!nilaiAwal) {
          setDesignerId(json.me);
          const awal = json.permintaan.find((p: OpsiPermintaan) => p.id === permintaanAwal);
          if (awal) pilihPermintaan(awal, json.me);
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => aktif && setLoading(false));
    return () => {
      aktif = false;
    };
  }, []);

  const permintaan = permintaanList.find((p) => p.id === permintaanId);
  const gambar = useMemo(() => {
    const list = permintaan?.gambar ?? [];
    // File hasil dokumen lama yang sudah dihapus dari lampiran tetap ditampilkan
    if (nilaiAwal && permintaanId === nilaiAwal.permintaan_id) {
      const hilang = nilaiAwal.hasil_files.filter((f) => !list.some((g) => g.url === f.url));
      return [...hilang, ...list];
    }
    return list;
  }, [permintaan, permintaanId, nilaiAwal]);

  const hasilTerpilih = hasilUrls
    .map((url) => gambar.find((g) => g.url === url))
    .filter((g): g is { name: string; url: string } => !!g);

  const toggleHasil = (url: string) => {
    if (hasilUrls.includes(url)) return setHasilUrls(hasilUrls.filter((u) => u !== url));
    if (hasilUrls.length >= MAKS_HASIL) return toast.error(`Maksimal ${MAKS_HASIL} hasil desain per dokumen.`);
    setHasilUrls([...hasilUrls, url]);
  };

  const staf = users.filter((u) => u.role === "admin" || u.role === "designer");

  function pilihPermintaan(p: OpsiPermintaan, me?: string) {
    setPermintaanId(p.id);
    setHasilUrls(p.gambar.length === 1 ? [p.gambar[0].url] : []);
    setProject((v) => v || p.project || "");
    setDeskripsi((v) => v || p.judul || "");
    if (p.admin) setDesignerId(p.admin);
    else if (me) setDesignerId(me);
  }

  const penandaTangan = (): InputPenandaTangan[] => [
    { user_id: designerId, peran: "designer" },
    ...acknowledge
      .filter((b) => b.user_id || b.jabatan)
      .map((b) => ({ user_id: b.user_id, peran: "acknowledge" as const, jabatan: b.jabatan.trim() || null })),
    ...approval
      .filter((b) => b.user_id || b.jabatan)
      .map((b) => ({ user_id: b.user_id, peran: "approval" as const, jabatan: b.jabatan.trim() || null })),
  ];

  const simpan = async () => {
    if (!permintaanId) return toast.error("Pilih permintaan desain.");
    if (hasilTerpilih.length === 0) return toast.error("Pilih minimal satu hasil desain.");
    if (!tanggal) return toast.error("Tanggal dokumen wajib diisi.");
    if (!noDokumen.trim()) return toast.error("No. Document wajib diisi.");
    if (!project.trim() || !tipe.trim() || !deskripsi.trim()) {
      return toast.error("Project Design, Tipe Design, dan Description wajib diisi.");
    }
    const ttd = penandaTangan();
    const err = validasiPenandaTangan(ttd);
    if (err) return toast.error(err);

    setSaving(true);
    try {
      const res = await fetch(dokumenId ? `/api/dokumen-desain/${dokumenId}` : "/api/dokumen-desain", {
        method: dokumenId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permintaan_id: permintaanId,
          hasil_files: hasilTerpilih,
          tanggal_dokumen: tanggal,
          no_dokumen: noDokumen,
          no_dokumen_sub: noSub,
          project_design: project,
          tipe_design: tipe,
          deskripsi,
          penanda_tangan: ttd,
          catatan_revisi: catatanRevisi,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan dokumen");
      toast.success(dokumenId ? "Dokumen diperbarui. Penanda tangan diminta tanda tangan ulang." : "Dokumen dibuat. Penanda tangan sudah diberi notifikasi.");
      router.push(`/dokumen-desain/${json.data.id}`);
    } catch (e: any) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const userMap = new Map(users.map((u) => [u.id, u]));
  const pratinjau = {
    no_dokumen: noDokumen || NO_DOKUMEN_CONTOH,
    no_dokumen_sub: noSub || null,
    project_design: project || "-",
    tipe_design: tipe || "-",
    deskripsi: deskripsi || "-",
    tanggal_dokumen: tanggal,
    hasil_files: hasilTerpilih,
    ttd: penandaTangan().map((p, i) => ({
      id: `${p.peran}-${i}`,
      peran: p.peran,
      nama: p.user_id ? namaUser(userMap.get(p.user_id)) : "-",
      jabatan: p.jabatan,
      status: "MENUNGGU",
    })),
  };

  return (
    <div className="space-y-6">
      {/* 1. Keterkaitan permintaan & hasil */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">1. Permintaan & Hasil Desain</h2>
          <p className="text-sm text-muted-foreground">
            Dokumen wajib terkait ke satu permintaan desain dan minimal satu file hasil (gambar) dari lampirannya.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>
            Permintaan Desain <span className="text-destructive">*</span>
          </Label>
          <PilihCari
            items={permintaanList}
            value={permintaanId}
            placeholder="Pilih permintaan desain..."
            label={(p) => p.judul}
            detail={(p) => (
              <>
                {STATUS_META[normalizeStatus(p.status)].short} · {[p.project, p.departemen].filter(Boolean).join(" · ")} ·{" "}
                {p.gambar.length} gambar
              </>
            )}
            cari={(p) => `${p.judul} ${p.project ?? ""} ${p.departemen ?? ""}`}
            onChange={(id) => {
              const p = permintaanList.find((x) => x.id === id);
              if (p) pilihPermintaan(p);
            }}
          />
          {permintaanList.length === 0 && (
            <p className="text-xs text-muted-foreground">Belum ada permintaan desain yang Anda kerjakan.</p>
          )}
        </div>

        {permintaanId && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <Label>
                Hasil Desain <span className="text-destructive">*</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                Bisa pilih lebih dari satu (maks. {MAKS_HASIL}); nomor = urutan di lembar. {hasilUrls.length} dipilih.
              </span>
            </div>
            {gambar.length === 0 ? (
              <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <ImageOff className="h-5 w-5 shrink-0" />
                Belum ada file gambar di lampiran permintaan ini. Upload hasil desain di halaman permintaan terlebih dahulu.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {gambar.map((g) => {
                  const no = hasilUrls.indexOf(g.url) + 1;
                  return (
                  <button
                    key={g.url}
                    type="button"
                    aria-pressed={no > 0}
                    onClick={() => toggleHasil(g.url)}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border-2 text-left transition",
                      no > 0 ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt={g.name} className="aspect-[4/3] w-full bg-muted object-contain" />
                    <div className="truncate px-2 py-1 text-xs">{g.name}</div>
                    {no > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {no}
                      </span>
                    )}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Isi title block */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">2. Isi Dokumen</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2 sm:max-w-xs">
            <Label htmlFor="tanggal">
              Tanggal Dokumen <span className="text-destructive">*</span>
            </Label>
            <Input id="tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="no-dokumen">
              No. Document <span className="text-destructive">*</span>
            </Label>
            <Input id="no-dokumen" value={noDokumen} maxLength={100} placeholder={NO_DOKUMEN_CONTOH} onChange={(e) => setNoDokumen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="no-sub">Sub Nomor</Label>
            <Input id="no-sub" value={noSub} maxLength={100} placeholder={NO_DOKUMEN_SUB_CONTOH} onChange={(e) => setNoSub(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project">
              Project Design <span className="text-destructive">*</span>
            </Label>
            <Input id="project" value={project} maxLength={150} placeholder="Seragam" onChange={(e) => setProject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipe">
              Tipe Design <span className="text-destructive">*</span>
            </Label>
            <Input id="tipe" value={tipe} maxLength={150} placeholder="Rompi" onChange={(e) => setTipe(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="deskripsi">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea id="deskripsi" value={deskripsi} maxLength={500} rows={2} placeholder="Rompi Garuda Mart Indonesia" onChange={(e) => setDeskripsi(e.target.value)} />
          </div>
        </div>
      </section>

      {/* 3. Penanda tangan */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">3. Penanda Tangan</h2>
          <p className="text-sm text-muted-foreground">
            Setiap orang yang dipilih mendapat notifikasi dan bisa menyetujui (tanda tangan) atau menolak dari halaman
            detail dokumen, tanpa urutan.
          </p>
        </div>
        <div className="space-y-1.5 rounded-lg border p-4">
          <Label>
            Designer <span className="text-destructive">*</span>
          </Label>
          <PilihCari
            items={staf}
            value={designerId}
            placeholder="Pilih designer..."
            label={namaUser}
            detail={(u) => [u.email, u.departemen].filter(Boolean).join(" · ")}
            cari={(u) => `${u.name ?? ""} ${u.email ?? ""}`}
            onChange={setDesignerId}
          />
        </div>
        <DaftarPenandaTangan
          judul="Acknowledge"
          keterangan="Pihak yang mengetahui, mis. Creative Leader dan Creative Head. Boleh dikosongkan."
          labelJabatan="Jabatan"
          placeholderJabatan="Creative Leader"
          baris={acknowledge}
          setBaris={setAcknowledge}
          users={users}
        />
        <DaftarPenandaTangan
          judul="Approval (User)"
          keterangan="Pihak peminta/pemilik yang menyetujui desain. Minimal satu."
          labelJabatan="Department"
          placeholderJabatan="HSE (Health, Safety, and Environment)"
          baris={approval}
          setBaris={setApproval}
          users={users}
          jabatanDefault={(u) => u.departemen || permintaan?.departemen || ""}
          wajib
        />
      </section>

      {dokumenId && (
        <section className="space-y-1.5">
          <Label htmlFor="catatan-revisi">Catatan Revisi</Label>
          <Textarea
            id="catatan-revisi"
            rows={2}
            value={catatanRevisi}
            maxLength={500}
            placeholder="Apa yang diubah? (opsional)"
            onChange={(e) => setCatatanRevisi(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Menyimpan perubahan akan menghapus semua tanda tangan yang sudah ada, dan semua penanda tangan diminta tanda
            tangan ulang.
          </p>
        </section>
      )}

      {/* Pratinjau */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Pratinjau</h2>
          <Badge variant="outline">belum ditandatangani</Badge>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-muted/40 p-3">
          <LembarDokumen data={pratinjau} />
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => router.back()} disabled={saving}>
          Batal
        </Button>
        <Button onClick={simpan} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {dokumenId ? "Simpan & Minta TTD Ulang" : "Buat Dokumen & Minta TTD"}
        </Button>
      </div>
    </div>
  );
}
