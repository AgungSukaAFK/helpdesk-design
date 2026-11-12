import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications } from "@/lib/notifications/server";
import { bolehBuatBast, bolehTerimaAkun, bolehTtdPenyerah } from "@/lib/bast";
import { catatRiwayatBast, validasiIsiBast } from "@/lib/bast-server";
import { namaPengguna, tampilNama } from "@/lib/dokumen-desain-server";

export const dynamic = "force-dynamic";

// Daftar BAST. Admin & designer melihat semua; user hanya BAST yang ia terima
// (akun penerima) atau yang terkait ke permintaan miliknya.
// Opsional ?permintaan_id= untuk daftar BAST satu permintaan.
export async function GET(request: NextRequest) {
  try {
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;
    const permintaanId = request.nextUrl.searchParams.get("permintaan_id");

    let query = client
      .from("bast")
      .select(
        "id, created_at, no_dokumen, jenis_nama, tanggal, judul_barang, mode, items, penerima_instansi, penerima_user_id, penerima_nama, penerima_dept, status, metode_terima, diterima_at, penyerah_id, penyerah_signed_at, created_by, link:bast_permintaan ( permintaan:permintaan_id ( id, judul ) )",
      )
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (permintaanId) {
      const { data: link } = await client.from("bast_permintaan").select("bast_id").eq("permintaan_id", permintaanId);
      const ids = (link ?? []).map((l) => l.bast_id);
      if (ids.length === 0) return NextResponse.json({ data: [] });
      query = query.in("id", ids);
    }

    if (role === "user") {
      const { data: milikSaya } = await client.from("permintaan").select("id").eq("requester", user.id);
      const reqIds = (milikSaya ?? []).map((p) => p.id);
      const filter = [`penerima_user_id.eq.${user.id}`];
      if (reqIds.length) {
        const { data: link } = await client.from("bast_permintaan").select("bast_id").in("permintaan_id", reqIds);
        const ids = Array.from(new Set((link ?? []).map((l) => l.bast_id)));
        if (ids.length) filter.push(`id.in.(${ids.join(",")})`);
      }
      query = query.or(filter.join(","));
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const users = await namaPengguna(client, (data ?? []).map((d) => d.penyerah_id));
    const aktor = { id: user.id, role };
    const rows = (data ?? []).map(({ items, link, ...d }: any) => ({
      ...d,
      jumlah_item: Array.isArray(items) ? items.length : 0,
      penyerah_nama: tampilNama(users.get(d.penyerah_id)),
      permintaan: (link ?? []).map((l: any) => l.permintaan).filter(Boolean),
      perlu_aksi_saya: bolehTtdPenyerah(d, aktor) || bolehTerimaAkun(d, aktor),
    }));

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;
    const aktor = { id: user.id, role };
    if (!bolehBuatBast(aktor)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const hasil = await validasiIsiBast(client, body, aktor);
    if ("error" in hasil) return NextResponse.json({ error: hasil.error }, { status: 400 });
    const { isi, permintaanIds } = hasil;

    const { data: bast, error } = await client
      .from("bast")
      .insert({ ...isi, created_by: user.id })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (permintaanIds.length) {
      const { error: linkError } = await client
        .from("bast_permintaan")
        .insert(permintaanIds.map((pid) => ({ bast_id: bast.id, permintaan_id: pid })));
      if (linkError) {
        await client.from("bast").delete().eq("id", bast.id);
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }

    await catatRiwayatBast(client, bast.id, user.id, "DIBUAT");

    const pembuat = tampilNama((await namaPengguna(client, [user.id])).get(user.id));
    const link = `/bast/${bast.id}`;
    const notif = [];
    if (isi.penyerah_id !== user.id) {
      notif.push({
        user_id: isi.penyerah_id,
        title: "BAST Perlu Tanda Tangan",
        message: `${pembuat} membuat BAST ${isi.jenis_nama} untuk ${isi.penerima_instansi} atas nama Anda. Mohon tanda tangan sebagai penyerah.`,
        link,
      });
    }
    if (isi.penerima_user_id && isi.penerima_user_id !== user.id) {
      notif.push({
        user_id: isi.penerima_user_id,
        title: "Ada Serah Terima untuk Anda",
        message: `${pembuat} akan menyerahkan ${isi.judul_barang.replace(/:$/, "")} kepada Anda (${isi.penerima_instansi}).`,
        link,
      });
    }
    if (notif.length) await createNotifications(client, notif, { actorId: user.id });

    return NextResponse.json({ success: true, data: { id: bast.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
