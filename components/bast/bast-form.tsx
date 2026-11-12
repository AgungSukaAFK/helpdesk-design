"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronsUpDown, Link2, Loader2, Lock, LockOpen, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PilihCari } from "@/components/dokumen-desain/dokumen-form";
import { CariAsync } from "./cari-async";
import { STATUS_META, normalizeStatus } from "@/lib/permintaan-workflow";
import {
  DIVISI_DEFAULT,
  KOTA_DEFAULT,
  formatNomorBast,
  isiTemplate,
  normalisasiBarang,
  tahunDari,
} from "@/lib/bast";
import { cn } from "@/lib/utils";
import { EditorBarang, type NilaiBarang } from "./editor-barang";
import { JenisDialog, type JenisBast } from "./jenis-dialog";
import { LembarBast } from "./lembar-bast";
import { SkalaLembar } from "./skala-lembar";

interface OpsiPermintaan {
  id: string;
  judul: string;
  project: string | null;
  departemen: string | null;
  status: string;
}

interface OpsiUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  departemen: string | null;
}

export interface NilaiAwalBast {
  no_dokumen: string;
  jenis_id: string | null;
  jenis_nama: string;
  tanggal: string;
  kota: string;
  penyerah_id: string;
  penyerah_divisi: string;
  judul_barang: string;
  mode: NilaiBarang["mode"];
  kolom: string[];
  items: string[][];
  penerima_instansi: string;
  penerima_user_id: string | null;
  penerima_nama: string | null;
  penerima_dept: string | null;
  klausul: string | null;
  permintaan: { id: string; judul: string }[];
  penerima_user_nama?: string | null;
  penyerah_signed_at?: string | null;
}

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const namaUser = (u?: OpsiUser) => u?.name || u?.email || "Tanpa nama";

function Bagian({ judul, keterangan, children, aksi }: { judul: string; keterangan?: string; children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{judul}</h3>
          {keterangan && <p className="text-xs text-muted-foreground">{keterangan}</p>}
        </div>
        {aksi}
      </div>
      {children}
    </section>
  );
}

export function BastForm({
  bastId,
  nilaiAwal,
  permintaanAwal,
}: {
  bastId?: string;
  nilaiAwal?: NilaiAwalBast;
  permintaanAwal?: string | null;
}) {
  const router = useRouter();
  const [opsi, setOpsi] = useState<{
    staff: OpsiUser[];
    jenis: JenisBast[];
    me: { id: string; role: string };
  } | null>(null);
  const [jenisOpen, setJenisOpen] = useState(false);
  const [simpan, setSimpan] = useState(false);

  const [jenisId, setJenisId] = useState<string | null>(nilaiAwal?.jenis_id ?? null);
  const [jenisNama, setJenisNama] = useState(nilaiAwal?.jenis_nama ?? "");
  const [jenisKode, setJenisKode] = useState("");
  const [tanggal, setTanggal] = useState(nilaiAwal?.tanggal ?? hariIni());
  const [kota, setKota] = useState(nilaiAwal?.kota ?? KOTA_DEFAULT);
  const [noDokumen, setNoDokumen] = useState(nilaiAwal?.no_dokumen ?? "");
  const [noManual, setNoManual] = useState(!!nilaiAwal);
  // Disimpan beserta judulnya karena pilihan permintaan dimuat bertahap dari server
  const [permintaanTerkait, setPermintaanTerkait] = useState<{ id: string; judul: string }[]>(
    nilaiAwal?.permintaan.map((p) => ({ id: p.id, judul: p.judul })) ?? [],
  );
  const permintaanIds = permintaanTerkait.map((p) => p.id);
  const [penyerahId, setPenyerahId] = useState(nilaiAwal?.penyerah_id ?? "");
  const [divisi, setDivisi] = useState(nilaiAwal?.penyerah_divisi ?? DIVISI_DEFAULT);
  const [judulBarang, setJudulBarang] = useState(nilaiAwal?.judul_barang ?? "");
  const [barang, setBarang] = useState<NilaiBarang>({
    mode: nilaiAwal?.mode ?? "daftar",
    kolom: nilaiAwal?.kolom ?? [],
    items: nilaiAwal?.items ?? [],
  });
  const [instansi, setInstansi] = useState(nilaiAwal?.penerima_instansi ?? "");
  const [penerimaUserId, setPenerimaUserId] = useState(nilaiAwal?.penerima_user_id ?? "");
  const [penerimaUserNama, setPenerimaUserNama] = useState(nilaiAwal?.penerima_user_nama ?? "");
  const [penerimaNama, setPenerimaNama] = useState(nilaiAwal?.penerima_nama ?? "");
  const [penerimaDept, setPenerimaDept] = useState(nilaiAwal?.penerima_dept ?? "");
  const [klausul, setKlausul] = useState(nilaiAwal?.klausul ?? "");

  useEffect(() => {
    fetch("/api/bast/opsi")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat pilihan");
        setOpsi(json);
        if (!nilaiAwal) {
          setPenyerahId((v) => v || json.me.id);
          if (json.jenis[0]) terapkanJenis(json.jenis[0], true);
          // Dibuka dari detail permintaan: permintaan itu langsung dikaitkan
          if (permintaanAwal) {
            fetch(`/api/permintaan?id=${encodeURIComponent(permintaanAwal)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((json2) => {
                const item = json2?.data ?? json2;
                if (!item?.id) return;
                setPermintaanTerkait((list) => (list.length ? list : [{ id: item.id, judul: item.judul }]));
                if (item.departemen) setInstansi((v) => v || item.departemen);
              })
              .catch(() => {});
          }
        } else if (nilaiAwal.jenis_id) {
          const j = json.jenis.find((x: JenisBast) => x.id === nilaiAwal.jenis_id);
          if (j) setJenisKode(j.kode);
        }
      })
      .catch((e) => toast.error(e.message));
  }, []);

  // Nomor otomatis mengikuti jenis & tahun sampai diubah manual
  useEffect(() => {
    if (!noManual && jenisKode) setNoDokumen(formatNomorBast(jenisKode, tahunDari(tanggal)));
  }, [jenisKode, tanggal, noManual]);

  /** Isi form dari bawaan jenis. Daftar barang yang sudah diisi tidak ditimpa. */
  function terapkanJenis(j: JenisBast, awal = false) {
    setJenisId(j.id);
    setJenisNama(j.nama);
    setJenisKode(j.kode);
    setJudulBarang(isiTemplate(j.judul_default, tahunDari(tanggal)));
    if (j.klausul_default || !awal) setKlausul(j.klausul_default ?? "");
    setBarang((b) =>
      b.items.some((r) => r.some(Boolean))
        ? b
        : {
            mode: j.mode_default,
            kolom: j.mode_default === "tabel" ? j.kolom_default : [],
            items: j.mode_default === "tabel" ? [j.kolom_default.map(() => "")] : [],
          },
    );
  }

  const staff = opsi?.staff ?? [];
  const isAdmin = opsi?.me.role === "admin";
  const penyerah = staff.find((u) => u.id === penyerahId);

  const togglePermintaan = (p: OpsiPermintaan) => {
    if (permintaanIds.includes(p.id)) {
      setPermintaanTerkait((list) => list.filter((x) => x.id !== p.id));
      return;
    }
    setPermintaanTerkait((list) => [...list, { id: p.id, judul: p.judul }]);
    if (p.departemen) setInstansi((v) => v || p.departemen!);
  };

  const kirim = async () => {
    const cek = normalisasiBarang(barang.mode, barang.kolom, barang.items);
    if ("error" in cek) return toast.error(cek.error);
    if (!jenisNama) return toast.error("Pilih jenis BAST.");
    if (!instansi.trim()) return toast.error("Isi site/departemen penerima.");
    setSimpan(true);
    try {
      const res = await fetch(bastId ? `/api/bast/${bastId}` : "/api/bast", {
        method: bastId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          no_dokumen: noDokumen,
          jenis_id: jenisId,
          jenis_nama: jenisNama,
          tanggal,
          kota,
          penyerah_id: penyerahId,
          penyerah_divisi: divisi,
          judul_barang: judulBarang,
          ...cek,
          penerima_instansi: instansi,
          penerima_user_id: penerimaUserId || null,
          penerima_nama: penerimaNama,
          penerima_dept: penerimaDept,
          klausul,
          permintaan_ids: permintaanIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan BAST");
      toast.success(bastId ? "BAST diperbarui." : "BAST dibuat. Tanda tangani sebagai penyerah sebelum serah terima.");
      router.push(`/bast/${json.data.id}`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
      setSimpan(false);
    }
  };

  if (!opsi) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pratinjau = {
    no_dokumen: noDokumen || "-",
    tanggal,
    kota,
    penyerah_nama: namaUser(penyerah),
    penyerah_divisi: divisi,
    judul_barang: judulBarang,
    mode: barang.mode,
    kolom: barang.kolom,
    items: barang.items.filter((r) => r.some(Boolean)),
    penerima_instansi: instansi || "…",
    penerima_nama: penerimaNama,
    penerima_dept: penerimaDept,
    klausul,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-5">
        {nilaiAwal?.penyerah_signed_at && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            Penyerah sudah menandatangani BAST ini. Menyimpan perubahan akan <b>mereset tanda tangan penyerah</b>.
          </div>
        )}

        <Bagian
          judul="Jenis & Nomor"
          aksi={
            <Button type="button" variant="ghost" size="sm" onClick={() => setJenisOpen(true)}>
              <Settings2 className="mr-1.5 h-4 w-4" /> Kelola jenis
            </Button>
          }
        >
          <div className="flex flex-wrap gap-2">
            {opsi.jenis.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => terapkanJenis(j)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition",
                  jenisId === j.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:border-primary/50 hover:bg-muted",
                )}
              >
                {j.nama}
              </button>
            ))}
            {jenisNama && !opsi.jenis.some((j) => j.id === jenisId) && (
              <span className="rounded-full border border-dashed px-3.5 py-1.5 text-sm text-muted-foreground">
                {jenisNama} (jenis lama)
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="tanggal">Tanggal</Label>
              <Input id="tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nomor">Nomor</Label>
              <div className="flex gap-2">
                <Input
                  id="nomor"
                  value={noDokumen}
                  readOnly={!noManual}
                  onChange={(e) => setNoDokumen(e.target.value)}
                  className={cn("font-mono text-sm", !noManual && "bg-muted/50")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={noManual ? "Kembali ke nomor otomatis" : "Ubah nomor manual"}
                  onClick={() => setNoManual((v) => !v)}
                >
                  {noManual ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </Bagian>

        <Bagian
          judul="Permintaan desain terkait"
          keterangan="Opsional. BAST jadi lampiran bukti di permintaan tersebut; status permintaan tidak berubah."
        >
          <CariAsync<OpsiPermintaan>
            tipe="permintaan"
            placeholder="Cari judul, project, departemen..."
            terpilih={permintaanIds}
            onPilih={togglePermintaan}
            tetapBuka
            label={(p) => p.judul}
            detail={(p) =>
              [STATUS_META[normalizeStatus(p.status)].short, p.departemen, p.project].filter(Boolean).join(" · ")
            }
            trigger={
              <Button variant="outline" className="w-full justify-start font-normal text-muted-foreground">
                <Link2 className="mr-2 h-4 w-4 shrink-0" /> Cari & kaitkan permintaan...
              </Button>
            }
          />
          {permintaanIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {permintaanTerkait.map((p) => (
                <Badge key={p.id} variant="secondary" className="max-w-full gap-1 py-1 pl-2.5 pr-1 font-normal">
                  <span className="min-w-0 truncate" title={p.judul}>
                    {p.judul}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-0.5 hover:bg-background"
                    onClick={() => setPermintaanTerkait((list) => list.filter((x) => x.id !== p.id))}
                    aria-label="Lepas"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">Tidak dikaitkan ke permintaan.</p>
          )}
        </Bagian>

        <Bagian judul="Yang menyerahkan">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nama</Label>
              {isAdmin ? (
                <PilihCari
                  items={staff}
                  value={penyerahId}
                  onChange={setPenyerahId}
                  placeholder="Pilih penyerah..."
                  label={namaUser}
                  detail={(u) => u.email}
                  cari={(u) => `${u.name ?? ""} ${u.email ?? ""}`}
                />
              ) : (
                <Input value={namaUser(penyerah)} readOnly className="bg-muted/50" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="divisi">Divisi</Label>
              <Input id="divisi" value={divisi} onChange={(e) => setDivisi(e.target.value)} />
            </div>
          </div>
        </Bagian>

        <Bagian judul="Barang yang diserahkan">
          <div className="space-y-1.5">
            <Label htmlFor="judul-barang">Judul</Label>
            <Input
              id="judul-barang"
              value={judulBarang}
              placeholder="Stiker Id Card 2026 Atas nama Berikut:"
              onChange={(e) => setJudulBarang(e.target.value)}
            />
          </div>
          <EditorBarang value={barang} onChange={setBarang} />
        </Bagian>

        <Bagian
          judul="Penerima"
          keterangan="Satu BAST untuk satu penerima. Nama & departemen perwakilan boleh dikosongkan dulu dan diisi saat serah terima."
        >
          <div className="space-y-1.5">
            <Label htmlFor="instansi">Diserahkan kepada (site / departemen) *</Label>
            <Input id="instansi" value={instansi} placeholder="mis. Site BA" onChange={(e) => setInstansi(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="penerima-nama">Nama perwakilan</Label>
              <Input id="penerima-nama" value={penerimaNama} onChange={(e) => setPenerimaNama(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="penerima-dept">Dept</Label>
              <Input id="penerima-dept" value={penerimaDept} onChange={(e) => setPenerimaDept(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Penerima punya akun di aplikasi? (opsional)</Label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <CariAsync<OpsiUser>
                  tipe="user"
                  placeholder="Cari nama, email, departemen..."
                  terpilih={penerimaUserId ? [penerimaUserId] : []}
                  onPilih={(u) => {
                    setPenerimaUserId(u.id);
                    setPenerimaUserNama(namaUser(u));
                    setPenerimaNama(namaUser(u));
                    if (u.departemen) setPenerimaDept(u.departemen);
                  }}
                  label={namaUser}
                  detail={(u) => [u.email, u.departemen].filter(Boolean).join(" · ")}
                  trigger={
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className={cn("truncate", !penerimaUserId && "text-muted-foreground")}>
                        {penerimaUserId
                          ? penerimaUserNama || "Akun terpilih"
                          : "Tidak — TTD langsung di perangkat penyerah / scan"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  }
                />
              </div>
              {penerimaUserId && (
                <Button type="button" variant="ghost" size="icon" title="Hapus" onClick={() => {
                    setPenerimaUserId("");
                    setPenerimaUserNama("");
                  }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Bila dipilih, penerima mendapat notifikasi dan bisa menandatangani sendiri dari akunnya.
            </p>
          </div>
        </Bagian>

        <Bagian judul="Klausul" keterangan="Ketentuan tanggung jawab setelah barang diterima. Pisahkan paragraf dengan baris kosong.">
          <Textarea rows={5} value={klausul} onChange={(e) => setKlausul(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-[200px]">
            <div className="space-y-1.5">
              <Label htmlFor="kota">Kota (di atas tanda tangan)</Label>
              <Input id="kota" value={kota} onChange={(e) => setKota(e.target.value)} />
            </div>
          </div>
        </Bagian>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.back()} disabled={simpan}>
            Batal
          </Button>
          <Button onClick={kirim} disabled={simpan}>
            {simpan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {bastId ? "Simpan Perubahan" : "Buat BAST"}
          </Button>
        </div>
      </div>

      <div className="min-w-0">
        <div className="space-y-2 xl:sticky xl:top-20">
          <div className="text-sm font-semibold">Pratinjau</div>
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border bg-muted/40 p-2">
            <SkalaLembar>
              <LembarBast data={pratinjau} />
            </SkalaLembar>
          </div>
        </div>
      </div>

      <JenisDialog
        open={jenisOpen}
        onOpenChange={setJenisOpen}
        jenis={opsi.jenis}
        onChanged={(list) => setOpsi((o) => (o ? { ...o, jenis: list } : o))}
      />
    </div>
  );
}
