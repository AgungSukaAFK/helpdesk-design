import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { MAKS_KOLOM_BARANG } from "@/lib/bast";

export const dynamic = "force-dynamic";

// Jenis BAST (ID Card, Poster, Sticker, ...) dikelola tim Design sendiri.

export async function GET() {
  const access = await getAuthorizedContext(["admin", "designer"]);
  if (!access.client) return access.response;
  const { data, error } = await access.client.from("bast_jenis").select("*").order("urutan").order("nama");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

const teks = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Tambah (tanpa id) atau ubah (dengan id) satu jenis. */
export async function POST(request: NextRequest) {
  try {
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user } = access;

    const body = await request.json().catch(() => ({}));
    const id = teks(body?.id, 64);
    const kolom = (Array.isArray(body?.kolom_default) ? body.kolom_default : [])
      .map((k: unknown) => teks(k, 60))
      .filter(Boolean)
      .slice(0, MAKS_KOLOM_BARANG);
    const isi = {
      nama: teks(body?.nama, 80),
      kode: teks(body?.kode, 40).toUpperCase(),
      judul_default: teks(body?.judul_default, 200) || null,
      mode_default: body?.mode_default === "tabel" ? "tabel" : "daftar",
      kolom_default: kolom,
      klausul_default: teks(body?.klausul_default, 3000) || null,
      urutan: Number.isFinite(Number(body?.urutan)) ? Math.round(Number(body.urutan)) : 0,
    };
    if (!isi.nama) return NextResponse.json({ error: "Nama jenis wajib diisi." }, { status: 400 });
    if (!isi.kode) return NextResponse.json({ error: "Kode untuk nomor wajib diisi." }, { status: 400 });
    if (isi.mode_default === "tabel" && kolom.length === 0) {
      return NextResponse.json({ error: "Isi minimal satu kolom tabel." }, { status: 400 });
    }

    const { data, error } = id
      ? await client.from("bast_jenis").update(isi).eq("id", id).select("*").single()
      : await client.from("bast_jenis").insert({ ...isi, created_by: user.id }).select("*").single();
    if (error) {
      const pesan = error.code === "23505" ? `Jenis "${isi.nama}" sudah ada.` : error.message;
      return NextResponse.json({ error: pesan }, { status: error.code === "23505" ? 409 : 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

/** BAST lama tetap aman: nama jenis tersalin di setiap BAST. */
export async function DELETE(request: NextRequest) {
  const access = await getAuthorizedContext(["admin", "designer"]);
  if (!access.client) return access.response;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const { error } = await access.client.from("bast_jenis").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
