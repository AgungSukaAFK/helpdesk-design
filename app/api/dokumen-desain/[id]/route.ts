import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications } from "@/lib/notifications/server";
import {
  bolehBuatDokumen,
  bolehEditDokumen,
  bolehHapusDokumen,
  bolehTandaTangan,
  PERAN_LABEL,
} from "@/lib/dokumen-desain";
import {
  barisTtd,
  bolehLihat,
  catatRiwayat,
  hapusFileTtd,
  namaPengguna,
  signedUrls,
  tampilNama,
  validasiIsiDokumen,
} from "@/lib/dokumen-desain-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function muatDokumen(client: any, id: string) {
  const { data: dok, error } = await client
    .from("dokumen_desain")
    .select("*, permintaan:permintaan_id ( id, judul, project, departemen, status, requester, admin )")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 } as const;
  if (!dok) return { error: "Dokumen tidak ditemukan", status: 404 } as const;
  const { data: ttd, error: ttdError } = await client
    .from("dokumen_desain_ttd")
    .select("*")
    .eq("dokumen_id", id)
    .order("urutan");
  if (ttdError) return { error: ttdError.message, status: 500 } as const;
  return { dok, ttd: (ttd ?? []) as any[] } as const;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    const muat = await muatDokumen(client, id);
    if ("error" in muat) return NextResponse.json({ error: muat.error }, { status: muat.status });
    const { dok, ttd } = muat;

    if (!bolehLihat(dok, ttd, dok.permintaan?.requester, user.id, role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: riwayat } = await client
      .from("dokumen_desain_riwayat")
      .select("id, created_at, user_id, aksi, catatan")
      .eq("dokumen_id", id)
      .order("created_at");

    const { data: profilSaya } = await client
      .from("user_profiles")
      .select("ttd_path")
      .eq("id", user.id)
      .maybeSingle();

    const users = await namaPengguna(client, [
      dok.created_by,
      dok.permintaan?.requester,
      ...ttd.map((t) => t.user_id),
      ...(riwayat ?? []).map((r) => r.user_id),
    ]);
    const urls = await signedUrls(client, [...ttd.map((t) => t.ttd_path), profilSaya?.ttd_path]);

    const aktor = { id: user.id, role };
    return NextResponse.json({
      data: {
        ...dok,
        permintaan: dok.permintaan
          ? { ...dok.permintaan, requester_name: tampilNama(users.get(dok.permintaan.requester)) }
          : null,
        created_by_name: tampilNama(users.get(dok.created_by)),
        ttd: ttd.map(({ ttd_path, ...t }) => ({
          ...t,
          nama: tampilNama(users.get(t.user_id)),
          departemen_user: users.get(t.user_id)?.departemen ?? null,
          ttd_url: ttd_path ? urls.get(ttd_path) ?? null : null,
        })),
        riwayat: (riwayat ?? []).map((r) => ({
          ...r,
          nama: r.user_id ? tampilNama(users.get(r.user_id)) : "Sistem",
        })),
      },
      akses: {
        edit: bolehEditDokumen(dok, aktor),
        hapus: bolehHapusDokumen(dok, aktor),
        tandaTangan: bolehTandaTangan(dok, ttd, user.id),
      },
      ttdTersimpanUrl: profilSaya?.ttd_path ? urls.get(profilSaya.ttd_path) ?? null : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// Revisi isi dokumen. Semua tanda tangan direset dan penanda tangan diminta ulang.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;
    const aktor = { id: user.id, role };

    const muat = await muatDokumen(client, id);
    if ("error" in muat) return NextResponse.json({ error: muat.error }, { status: muat.status });
    const { dok, ttd: ttdLama } = muat;

    if (!bolehEditDokumen(dok, aktor)) {
      return NextResponse.json(
        { error: "Dokumen tidak dapat diubah (sudah disetujui atau Anda bukan pembuatnya)." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const hasil = await validasiIsiDokumen(client, body, dok);
    if ("error" in hasil) return NextResponse.json({ error: hasil.error }, { status: 400 });
    const { isi, permintaan } = hasil;

    if (isi.permintaan_id !== dok.permintaan_id && !bolehBuatDokumen(permintaan, aktor)) {
      return NextResponse.json(
        { error: "Anda tidak dapat mengaitkan dokumen ke permintaan tersebut." },
        { status: 403 },
      );
    }

    const adaProses = ttdLama.some((t) => t.status !== "MENUNGGU");
    const { penanda_tangan, ...kolom } = isi;

    const { error: delError } = await client.from("dokumen_desain_ttd").delete().eq("dokumen_id", id);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    const { error: ttdError } = await client.from("dokumen_desain_ttd").insert(barisTtd(id, penanda_tangan));
    if (ttdError) return NextResponse.json({ error: ttdError.message }, { status: 500 });

    const { error } = await client
      .from("dokumen_desain")
      .update({
        ...kolom,
        status: "MENUNGGU",
        disetujui_at: null,
        revisi: adaProses ? (dok.revisi ?? 0) + 1 : dok.revisi ?? 0,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await hapusFileTtd(client, ttdLama.map((t) => t.ttd_path));
    const catatan = typeof body.catatan_revisi === "string" ? body.catatan_revisi.trim() : "";
    await catatRiwayat(client, id, user.id, adaProses ? "DIREVISI" : "DIUBAH", catatan);

    const pembuat = await namaPengguna(client, [user.id]);
    await createNotifications(
      client,
      penanda_tangan.map((p) => ({
        user_id: p.user_id,
        title: adaProses ? "Dokumen Direvisi, Perlu TTD Ulang" : "Dokumen Perlu Tanda Tangan",
        message: `${tampilNama(pembuat.get(user.id))} ${adaProses ? "merevisi" : "memperbarui"} dokumen ${isi.no_dokumen} — ${permintaan.judul}. Mohon tanda tangan sebagai ${PERAN_LABEL[p.peran]}.`,
        link: `/dokumen-desain/${id}`,
      })),
      { actorId: user.id },
    );

    return NextResponse.json({ success: true, data: { id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "designer", "user"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    const muat = await muatDokumen(client, id);
    if ("error" in muat) return NextResponse.json({ error: muat.error }, { status: muat.status });
    const { dok, ttd } = muat;

    if (!bolehHapusDokumen(dok, { id: user.id, role })) {
      return NextResponse.json({ error: "Anda tidak dapat menghapus dokumen ini." }, { status: 403 });
    }

    const { error } = await client.from("dokumen_desain").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await hapusFileTtd(client, ttd.map((t) => t.ttd_path));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
