import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications } from "@/lib/notifications/server";
import {
  bolehBukaKembali,
  bolehEditBast,
  bolehHapusBast,
  bolehTerimaAkun,
  bolehTerimaLangsung,
  bolehTerimaScan,
  bolehTtdPenyerah,
} from "@/lib/bast";
import { bolehLihatBast, catatRiwayatBast, fileBast, muatBast, validasiIsiBast } from "@/lib/bast-server";
import { hapusFileTtd, namaPengguna, signedUrls, tampilNama } from "@/lib/dokumen-desain-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    const muat = await muatBast(client, id);
    if ("error" in muat) return NextResponse.json({ error: muat.error }, { status: muat.status });
    const { bast, permintaan } = muat;
    if (!bolehLihatBast(bast, permintaan, user.id, role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [{ data: riwayat }, { data: profilSaya }] = await Promise.all([
      client.from("bast_riwayat").select("id, created_at, user_id, aksi, catatan").eq("bast_id", id).order("created_at"),
      client.from("user_profiles").select("ttd_path, departemen").eq("id", user.id).maybeSingle(),
    ]);

    const users = await namaPengguna(client, [
      bast.created_by,
      bast.penyerah_id,
      bast.penerima_user_id,
      bast.diterima_oleh,
      ...(riwayat ?? []).map((r) => r.user_id),
    ]);
    const bukti: string[] = Array.isArray(bast.bukti_paths) ? bast.bukti_paths : [];
    const urls = await signedUrls(client, [...fileBast(bast), profilSaya?.ttd_path]);
    const url = (p?: string | null) => (p ? urls.get(p) ?? null : null);

    const aktor = { id: user.id, role };
    const {
      penyerah_ttd_path,
      penerima_ttd_path,
      scan_path,
      bukti_paths: _bukti,
      ...rest
    } = bast;

    return NextResponse.json({
      data: {
        ...rest,
        penyerah_nama: tampilNama(users.get(bast.penyerah_id)),
        penerima_user_nama: bast.penerima_user_id ? tampilNama(users.get(bast.penerima_user_id)) : null,
        created_by_name: tampilNama(users.get(bast.created_by)),
        diterima_oleh_nama: bast.diterima_oleh ? tampilNama(users.get(bast.diterima_oleh)) : null,
        penyerah_ttd_url: url(penyerah_ttd_path),
        penerima_ttd_url: url(penerima_ttd_path),
        scan_url: url(scan_path),
        scan_pdf: typeof scan_path === "string" && scan_path.toLowerCase().endsWith(".pdf"),
        bukti_urls: bukti.map((p) => url(p)).filter(Boolean),
        permintaan: permintaan.map(({ requester: _r, admin: _a, ...p }) => p),
        riwayat: (riwayat ?? []).map((r) => ({
          ...r,
          nama: r.user_id ? tampilNama(users.get(r.user_id)) : "Sistem",
        })),
      },
      akses: {
        edit: bolehEditBast(bast, aktor),
        hapus: bolehHapusBast(bast, aktor),
        ttdPenyerah: bolehTtdPenyerah(bast, aktor),
        terimaLangsung: bolehTerimaLangsung(bast, aktor),
        terimaScan: bolehTerimaScan(bast, aktor),
        terimaAkun: bolehTerimaAkun(bast, aktor),
        bukaKembali: bolehBukaKembali(bast, aktor),
      },
      ttdTersimpanUrl: url(profilSaya?.ttd_path),
      departemenSaya: profilSaya?.departemen ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// Ubah isi BAST selama belum diterima. TTD penyerah direset karena isi surat berubah.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;
    const aktor = { id: user.id, role };

    const muat = await muatBast(client, id);
    if ("error" in muat) return NextResponse.json({ error: muat.error }, { status: muat.status });
    const { bast, permintaan: lama } = muat;
    if (!bolehEditBast(bast, aktor)) {
      return NextResponse.json(
        { error: "BAST tidak dapat diubah (sudah diterima atau Anda bukan pengelolanya)." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const hasil = await validasiIsiBast(client, body, aktor, {
      permintaanIds: lama.map((p) => p.id),
      penyerah_id: bast.penyerah_id,
    });
    if ("error" in hasil) return NextResponse.json({ error: hasil.error }, { status: 400 });
    const { isi, permintaanIds } = hasil;

    const resetTtd = !!bast.penyerah_signed_at;
    const { data: diubah, error } = await client
      .from("bast")
      .update({ ...isi, penyerah_ttd_path: null, penyerah_signed_at: null })
      .eq("id", id)
      .eq("status", "MENUNGGU")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!diubah?.length) return NextResponse.json({ error: "BAST sudah diterima, tidak dapat diubah." }, { status: 409 });

    const lamaIds = lama.map((p) => p.id);
    const hapus = lamaIds.filter((pid) => !permintaanIds.includes(pid));
    const tambah = permintaanIds.filter((pid) => !lamaIds.includes(pid));
    if (hapus.length) await client.from("bast_permintaan").delete().eq("bast_id", id).in("permintaan_id", hapus);
    if (tambah.length) {
      await client.from("bast_permintaan").insert(tambah.map((pid) => ({ bast_id: id, permintaan_id: pid })));
    }

    if (resetTtd) await hapusFileTtd(client, [bast.penyerah_ttd_path]);
    await catatRiwayatBast(client, id, user.id, "DIUBAH", resetTtd ? "Tanda tangan penyerah direset" : null);

    if (resetTtd && isi.penyerah_id !== user.id) {
      const nama = tampilNama((await namaPengguna(client, [user.id])).get(user.id));
      await createNotifications(
        client,
        [
          {
            user_id: isi.penyerah_id,
            title: "BAST Diubah, Perlu TTD Ulang",
            message: `${nama} mengubah BAST ${isi.jenis_nama} untuk ${isi.penerima_instansi}. Mohon tanda tangan ulang sebagai penyerah.`,
            link: `/bast/${id}`,
          },
        ],
        { actorId: user.id },
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    const muat = await muatBast(client, id);
    if ("error" in muat) return NextResponse.json({ error: muat.error }, { status: muat.status });
    if (!bolehHapusBast(muat.bast, { id: user.id, role })) {
      return NextResponse.json({ error: "Anda tidak dapat menghapus BAST ini." }, { status: 403 });
    }

    const { error } = await client.from("bast").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await hapusFileTtd(client, fileBast(muat.bast));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
