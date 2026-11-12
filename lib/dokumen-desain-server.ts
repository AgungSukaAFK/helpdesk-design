import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFiles } from "@/lib/permintaan-files";
import {
  isFileGambar,
  validasiPenandaTangan,
  TTD_MAX_BYTES,
  type InputPenandaTangan,
  type PeranTtd,
  type RoleApp,
} from "@/lib/dokumen-desain";

export const TTD_BUCKET = "dokumen-desain";
const SIGNED_URL_TTL = 60 * 60;

/** Ubah data URL PNG menjadi bytes; null jika bukan PNG atau terlalu besar. */
export function decodeTtdDataUrl(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Uint8Array.from(Buffer.from(m[1], "base64"));
  if (bytes.length < 8 || bytes.length > TTD_MAX_BYTES) return null;
  // Signature file PNG: 89 50 4E 47
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return bytes;
}

/** Signed URL untuk banyak path sekaligus; path tanpa hasil dilewati. */
export async function signedUrls(client: SupabaseClient, paths: (string | null | undefined)[]) {
  const unik = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const map = new Map<string, string>();
  if (unik.length === 0) return map;
  const { data } = await client.storage.from(TTD_BUCKET).createSignedUrls(unik, SIGNED_URL_TTL);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}

export async function namaPengguna(client: SupabaseClient, ids: (string | null | undefined)[]) {
  const unik = Array.from(new Set(ids.filter((i): i is string => !!i)));
  const map = new Map<string, { id: string; name: string | null; email: string | null; departemen: string | null }>();
  if (unik.length === 0) return map;
  const { data } = await client
    .from("user_profiles")
    .select("id, name, email, departemen")
    .in("id", unik);
  for (const u of data ?? []) map.set(u.id, u);
  return map;
}

export const tampilNama = (u?: { name?: string | null; email?: string | null } | null) =>
  u?.name || u?.email || "Pengguna";

/** Boleh melihat dokumen: admin, pembuat, penanda tangan, atau peminta desainnya. */
export function bolehLihat(
  dok: { created_by: string },
  ttd: { user_id: string }[],
  requesterId: string | null | undefined,
  userId: string,
  role: RoleApp,
) {
  return (
    role === "admin" ||
    dok.created_by === userId ||
    ttd.some((t) => t.user_id === userId) ||
    requesterId === userId
  );
}

export async function catatRiwayat(
  client: SupabaseClient,
  dokumenId: string,
  userId: string,
  aksi: string,
  catatan?: string | null,
) {
  await client.from("dokumen_desain_riwayat").insert({
    dokumen_id: dokumenId,
    user_id: userId,
    aksi,
    catatan: catatan || null,
  });
}

export async function hapusFileTtd(client: SupabaseClient, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await client.storage.from(TTD_BUCKET).remove(list);
}

export interface IsiDokumen {
  permintaan_id: string;
  hasil_file: { name: string; url: string };
  no_dokumen: string;
  no_dokumen_sub: string | null;
  project_design: string;
  tipe_design: string;
  deskripsi: string;
  penanda_tangan: InputPenandaTangan[];
}

const teks = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Validasi body buat/revisi dokumen, termasuk memastikan file hasil benar-benar
 * gambar dari lampiran permintaan yang dipilih dan penanda tangan adalah user aktif.
 */
export async function validasiIsiDokumen(
  client: SupabaseClient,
  body: any,
  /** Saat revisi: hasil lama tetap sah walau sudah dihapus dari lampiran permintaan. */
  dokumenLama?: { permintaan_id: string; hasil_file: { name: string; url: string } },
): Promise<{ error: string } | { isi: IsiDokumen; permintaan: { id: string; judul: string; admin: string | null; requester: string } }> {
  const permintaanId = teks(body?.permintaan_id, 64);
  if (!permintaanId) return { error: "Permintaan desain wajib dipilih." };

  const { data: permintaan, error } = await client
    .from("permintaan")
    .select("id, judul, admin, requester, files")
    .eq("id", permintaanId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!permintaan) return { error: "Permintaan desain tidak ditemukan." };

  const hasilUrl = teks(body?.hasil_file?.url, 2000);
  const hasil =
    normalizeFiles(permintaan.files).find((f) => f.url === hasilUrl) ??
    (dokumenLama && dokumenLama.permintaan_id === permintaan.id && dokumenLama.hasil_file?.url === hasilUrl
      ? dokumenLama.hasil_file
      : undefined);
  if (!hasil) return { error: "Hasil desain wajib dipilih dari lampiran permintaan tersebut." };
  if (!isFileGambar(hasil)) return { error: "Hasil desain harus berupa file gambar." };

  const isi: IsiDokumen = {
    permintaan_id: permintaan.id,
    hasil_file: { name: hasil.name, url: hasil.url },
    no_dokumen: teks(body?.no_dokumen, 100),
    no_dokumen_sub: teks(body?.no_dokumen_sub, 100) || null,
    project_design: teks(body?.project_design, 150),
    tipe_design: teks(body?.tipe_design, 150),
    deskripsi: teks(body?.deskripsi, 500),
    penanda_tangan: Array.isArray(body?.penanda_tangan)
      ? body.penanda_tangan.map((p: any) => ({
          user_id: teks(p?.user_id, 64),
          peran: teks(p?.peran, 20) as PeranTtd,
          jabatan: teks(p?.jabatan, 100) || null,
        }))
      : [],
  };

  if (!isi.no_dokumen) return { error: "No. Document wajib diisi." };
  if (!isi.project_design) return { error: "Project Design wajib diisi." };
  if (!isi.tipe_design) return { error: "Tipe Design wajib diisi." };
  if (!isi.deskripsi) return { error: "Description wajib diisi." };

  const errTtd = validasiPenandaTangan(isi.penanda_tangan);
  if (errTtd) return { error: errTtd };

  const ids = Array.from(new Set(isi.penanda_tangan.map((p) => p.user_id)));
  const { data: users, error: usersError } = await client
    .from("user_profiles")
    .select("id")
    .in("id", ids);
  if (usersError) return { error: usersError.message };
  if ((users ?? []).length !== ids.length) return { error: "Ada penanda tangan yang tidak terdaftar." };

  return { isi, permintaan };
}

/** Baris dokumen_desain_ttd dari input, berurutan sesuai form. */
export function barisTtd(dokumenId: string, list: InputPenandaTangan[]) {
  const urutanPeran: Record<PeranTtd, number> = { designer: 0, acknowledge: 1, approval: 2 };
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => urutanPeran[a.p.peran] - urutanPeran[b.p.peran] || a.i - b.i)
    .map(({ p }, urutan) => ({
      dokumen_id: dokumenId,
      user_id: p.user_id,
      peran: p.peran,
      jabatan: p.jabatan || null,
      urutan,
    }));
}
