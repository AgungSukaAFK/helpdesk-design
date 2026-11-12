import type { SupabaseClient } from "@supabase/supabase-js";
import { normalisasiBarang, type ModeBarang } from "@/lib/bast";
import { decodeTtdDataUrl, TTD_BUCKET } from "@/lib/dokumen-desain-server";

export const MAKS_PERMINTAAN_TERKAIT = 20;

type Role = "admin" | "designer" | "user";

/** Semua file storage milik satu BAST (TTD, scan, foto bukti). */
export const fileBast = (b: any): string[] =>
  [b?.penyerah_ttd_path, b?.penerima_ttd_path, b?.scan_path, ...(Array.isArray(b?.bukti_paths) ? b.bukti_paths : [])].filter(
    (p): p is string => typeof p === "string" && !!p,
  );

export async function catatRiwayatBast(
  client: SupabaseClient,
  bastId: string,
  userId: string,
  aksi: string,
  catatan?: string | null,
) {
  await client.from("bast_riwayat").insert({ bast_id: bastId, user_id: userId, aksi, catatan: catatan || null });
}

export async function muatBast(client: SupabaseClient, id: string) {
  const { data: bast, error } = await client.from("bast").select("*").eq("id", id).maybeSingle();
  if (error) return { error: error.message, status: 500 } as const;
  if (!bast) return { error: "BAST tidak ditemukan", status: 404 } as const;
  const { data: link } = await client
    .from("bast_permintaan")
    .select("permintaan:permintaan_id ( id, judul, project, departemen, status, requester, admin )")
    .eq("bast_id", id);
  const permintaan = (link ?? []).map((l: any) => l.permintaan).filter(Boolean) as {
    id: string;
    judul: string;
    project: string | null;
    departemen: string | null;
    status: string;
    requester: string;
    admin: string | null;
  }[];
  return { bast, permintaan } as const;
}

/** Staff melihat semua; user hanya bila ia penerima atau peminta permintaan yang dikaitkan. */
export function bolehLihatBast(
  bast: { penerima_user_id?: string | null },
  permintaan: { requester: string }[],
  userId: string,
  role: Role,
) {
  return (
    role === "admin" ||
    role === "designer" ||
    bast.penerima_user_id === userId ||
    permintaan.some((p) => p.requester === userId)
  );
}

export interface IsiBast {
  no_dokumen: string;
  jenis_id: string | null;
  jenis_nama: string;
  tanggal: string;
  kota: string;
  penyerah_id: string;
  penyerah_divisi: string;
  judul_barang: string;
  mode: ModeBarang;
  kolom: string[];
  items: string[][];
  penerima_instansi: string;
  penerima_user_id: string | null;
  penerima_nama: string | null;
  penerima_dept: string | null;
  klausul: string | null;
}

const teks = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Validasi body buat/ubah BAST. Permintaan yang boleh dikaitkan: admin semua,
 * designer hanya yang ia PIC-i (plus yang sudah terkait sebelumnya saat mengubah).
 */
export async function validasiIsiBast(
  client: SupabaseClient,
  body: any,
  aktor: { id: string; role: Role },
  /** Saat mengubah: permintaan & penyerah yang sudah ada tetap sah. */
  lama?: { permintaanIds: string[]; penyerah_id: string },
): Promise<{ error: string } | { isi: IsiBast; permintaanIds: string[]; judulPermintaan: string[] }> {
  const tanggal = teks(body?.tanggal, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || Number.isNaN(Date.parse(tanggal))) {
    return { error: "Tanggal tidak valid." };
  }

  const barang = normalisasiBarang(body?.mode, body?.kolom, body?.items);
  if ("error" in barang) return { error: barang.error };

  const isi: IsiBast = {
    no_dokumen: teks(body?.no_dokumen, 150),
    jenis_id: teks(body?.jenis_id, 64) || null,
    jenis_nama: teks(body?.jenis_nama, 80),
    tanggal,
    kota: teks(body?.kota, 60) || "Bekasi",
    penyerah_id: teks(body?.penyerah_id, 64),
    penyerah_divisi: teks(body?.penyerah_divisi, 100),
    judul_barang: teks(body?.judul_barang, 200),
    ...barang,
    penerima_instansi: teks(body?.penerima_instansi, 120),
    penerima_user_id: teks(body?.penerima_user_id, 64) || null,
    penerima_nama: teks(body?.penerima_nama, 120) || null,
    penerima_dept: teks(body?.penerima_dept, 120) || null,
    klausul: teks(body?.klausul, 3000) || null,
  };

  if (!isi.no_dokumen) return { error: "Nomor BAST wajib diisi." };
  if (!isi.jenis_nama) return { error: "Jenis BAST wajib dipilih." };
  if (!isi.penyerah_id) return { error: "Penyerah wajib dipilih." };
  if (!isi.penyerah_divisi) return { error: "Divisi penyerah wajib diisi." };
  if (!isi.judul_barang) return { error: "Judul barang yang diserahkan wajib diisi." };
  if (!isi.penerima_instansi) return { error: "Site/departemen penerima wajib diisi." };

  if (isi.jenis_id) {
    const { data: jenis } = await client.from("bast_jenis").select("id").eq("id", isi.jenis_id).maybeSingle();
    if (!jenis) isi.jenis_id = null;
  }

  const userIds = Array.from(new Set([isi.penyerah_id, isi.penerima_user_id].filter((v): v is string => !!v)));
  const { data: users, error: usersError } = await client.from("user_profiles").select("id, role").in("id", userIds);
  if (usersError) return { error: usersError.message };
  const penyerah = (users ?? []).find((u) => u.id === isi.penyerah_id);
  if (!penyerah) return { error: "Penyerah tidak terdaftar." };
  if (penyerah.role !== "admin" && penyerah.role !== "designer") return { error: "Penyerah harus anggota tim Design." };
  // Designer hanya membuat BAST atas namanya sendiri (admin bebas memilih)
  if (aktor.role !== "admin" && isi.penyerah_id !== aktor.id && isi.penyerah_id !== lama?.penyerah_id) {
    return { error: "Designer hanya dapat membuat BAST atas nama sendiri." };
  }
  if (isi.penerima_user_id && !(users ?? []).some((u) => u.id === isi.penerima_user_id)) {
    return { error: "Akun penerima tidak terdaftar." };
  }

  const permintaanIds: string[] = Array.from(
    new Set<string>(
      (Array.isArray(body?.permintaan_ids) ? body.permintaan_ids : [])
        .map((v: unknown) => teks(v, 64))
        .filter(Boolean),
    ),
  );
  if (permintaanIds.length > MAKS_PERMINTAAN_TERKAIT) {
    return { error: `Maksimal ${MAKS_PERMINTAAN_TERKAIT} permintaan terkait.` };
  }
  const permintaanLama = lama?.permintaanIds ?? [];
  let judulPermintaan: string[] = [];
  if (permintaanIds.length) {
    const { data: rows, error } = await client.from("permintaan").select("id, judul, admin").in("id", permintaanIds);
    if (error) return { error: error.message };
    if ((rows ?? []).length !== permintaanIds.length) return { error: "Ada permintaan terkait yang tidak ditemukan." };
    if (aktor.role !== "admin") {
      const terlarang = (rows ?? []).find((p) => p.admin !== aktor.id && !permintaanLama.includes(p.id));
      if (terlarang) return { error: `Anda bukan PIC permintaan "${terlarang.judul}".` };
    }
    judulPermintaan = (rows ?? []).map((p) => p.judul);
  }

  return { isi, permintaanIds, judulPermintaan };
}

/**
 * Simpan gambar TTD user ke storage: pakai TTD tersimpan di profil (disalin),
 * atau PNG baru (opsional sekaligus disimpan ke profil). Mengembalikan path.
 */
export async function simpanTtdUser(
  client: SupabaseClient,
  userId: string,
  tujuan: string,
  body: { pakaiTersimpan?: unknown; ttd?: unknown; simpan?: unknown },
): Promise<{ path: string } | { error: string; status: number }> {
  const storage = client.storage.from(TTD_BUCKET);
  if (body.pakaiTersimpan) {
    const { data: profil } = await client.from("user_profiles").select("ttd_path").eq("id", userId).maybeSingle();
    if (!profil?.ttd_path) return { error: "Anda belum punya tanda tangan tersimpan", status: 400 };
    const { error } = await storage.copy(profil.ttd_path, tujuan);
    return error ? { error: error.message, status: 500 } : { path: tujuan };
  }
  const bytes = decodeTtdDataUrl(body.ttd);
  if (!bytes) return { error: "Gambar tanda tangan tidak valid (PNG, maks. 1 MB).", status: 400 };
  const { error } = await storage.upload(tujuan, bytes, { contentType: "image/png" });
  if (error) return { error: error.message, status: 500 };
  if (body.simpan) {
    const profilPath = `profil/${userId}.png`;
    const { error: simpanError } = await storage.upload(profilPath, bytes, { contentType: "image/png", upsert: true });
    if (!simpanError) await client.from("user_profiles").update({ ttd_path: profilPath }).eq("id", userId);
  }
  return { path: tujuan };
}
