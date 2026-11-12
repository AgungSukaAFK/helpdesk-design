import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications } from "@/lib/notifications/server";
import { bolehBuatDokumen, PERAN_LABEL } from "@/lib/dokumen-desain";
import {
  barisTtd,
  catatRiwayat,
  namaPengguna,
  tampilNama,
  validasiIsiDokumen,
} from "@/lib/dokumen-desain-server";

export const dynamic = "force-dynamic";

// Daftar dokumen yang boleh dilihat user: admin semua; lainnya hanya yang
// dibuatnya, yang harus ditandatanganinya, atau milik permintaan yang dimintanya.
// Opsional ?permintaan_id= untuk daftar dokumen satu permintaan.
export async function GET(request: NextRequest) {
  try {
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;
    const permintaanId = request.nextUrl.searchParams.get("permintaan_id");

    let query = client
      .from("dokumen_desain")
      .select(
        "id, created_at, updated_at, permintaan_id, no_dokumen, no_dokumen_sub, project_design, tipe_design, deskripsi, status, revisi, created_by, disetujui_at, hasil_file, permintaan:permintaan_id ( judul, requester, departemen ), ttd:dokumen_desain_ttd ( user_id, peran, status )",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (permintaanId) query = query.eq("permintaan_id", permintaanId);

    if (role !== "admin") {
      const [{ data: ttdSaya }, { data: permintaanSaya }] = await Promise.all([
        client.from("dokumen_desain_ttd").select("dokumen_id").eq("user_id", user.id),
        client.from("permintaan").select("id").eq("requester", user.id),
      ]);
      const filter = [`created_by.eq.${user.id}`];
      const dokIds = Array.from(new Set((ttdSaya ?? []).map((t) => t.dokumen_id)));
      const reqIds = (permintaanSaya ?? []).map((p) => p.id);
      if (dokIds.length) filter.push(`id.in.(${dokIds.join(",")})`);
      if (reqIds.length) filter.push(`permintaan_id.in.(${reqIds.join(",")})`);
      query = query.or(filter.join(","));
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const users = await namaPengguna(client, (data ?? []).map((d) => d.created_by));
    const rows = (data ?? []).map((d: any) => {
      const ttd: { user_id: string; peran: string; status: string }[] = d.ttd ?? [];
      return {
        ...d,
        permintaan_judul: d.permintaan?.judul ?? "-",
        permintaan_departemen: d.permintaan?.departemen ?? null,
        permintaan: undefined,
        ttd: undefined,
        created_by_name: tampilNama(users.get(d.created_by)),
        ttd_total: ttd.length,
        ttd_selesai: ttd.filter((t) => t.status === "DISETUJUI").length,
        perlu_ttd_saya:
          d.status === "MENUNGGU" && ttd.some((t) => t.user_id === user.id && t.status === "MENUNGGU"),
      };
    });

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

    const body = await request.json().catch(() => ({}));
    const hasil = await validasiIsiDokumen(client, body);
    if ("error" in hasil) return NextResponse.json({ error: hasil.error }, { status: 400 });
    const { isi, permintaan } = hasil;

    if (!bolehBuatDokumen(permintaan, { id: user.id, role })) {
      return NextResponse.json(
        { error: "Hanya admin atau desainer PIC permintaan ini yang dapat membuat dokumen." },
        { status: 403 },
      );
    }

    const { penanda_tangan, ...kolom } = isi;
    const { data: dok, error } = await client
      .from("dokumen_desain")
      .insert({ ...kolom, created_by: user.id })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: ttdError } = await client.from("dokumen_desain_ttd").insert(barisTtd(dok.id, penanda_tangan));
    if (ttdError) {
      await client.from("dokumen_desain").delete().eq("id", dok.id);
      return NextResponse.json({ error: ttdError.message }, { status: 500 });
    }

    await catatRiwayat(client, dok.id, user.id, "DIBUAT");

    const pembuat = await namaPengguna(client, [user.id]);
    await createNotifications(
      client,
      penanda_tangan.map((p) => ({
        user_id: p.user_id,
        title: "Dokumen Perlu Tanda Tangan",
        message: `${tampilNama(pembuat.get(user.id))} meminta tanda tangan Anda (${PERAN_LABEL[p.peran]}) untuk dokumen ${isi.no_dokumen} — ${permintaan.judul}.`,
        link: `/dokumen-desain/${dok.id}`,
      })),
      { actorId: user.id },
    );

    return NextResponse.json({ success: true, data: { id: dok.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
