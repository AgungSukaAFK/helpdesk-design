import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications } from "@/lib/notifications/server";
import { bolehTtdPenyerah } from "@/lib/bast";
import { catatRiwayatBast, simpanTtdUser } from "@/lib/bast-server";
import { hapusFileTtd, namaPengguna, tampilNama } from "@/lib/dokumen-desain-server";

export const dynamic = "force-dynamic";

// Penyerah menandatangani BAST.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    const { data: bast, error } = await client
      .from("bast")
      .select("id, status, created_by, penyerah_id, penerima_user_id, penyerah_signed_at, jenis_nama, penerima_instansi")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!bast) return NextResponse.json({ error: "BAST tidak ditemukan" }, { status: 404 });
    if (!bolehTtdPenyerah(bast, { id: user.id, role })) {
      return NextResponse.json({ error: "BAST ini tidak menunggu tanda tangan Anda." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const simpan = await simpanTtdUser(client, user.id, `bast/${id}/penyerah-${Date.now()}.png`, body);
    if ("error" in simpan) return NextResponse.json({ error: simpan.error }, { status: simpan.status });

    const { data: diubah, error: updError } = await client
      .from("bast")
      .update({ penyerah_ttd_path: simpan.path, penyerah_signed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "MENUNGGU")
      .is("penyerah_signed_at", null)
      .select("id");
    if (updError || !diubah?.length) {
      await hapusFileTtd(client, [simpan.path]);
      return NextResponse.json(
        { error: updError?.message || "Tanda tangan sudah diproses sebelumnya." },
        { status: updError ? 500 : 409 },
      );
    }

    await catatRiwayatBast(client, id, user.id, "TTD_PENYERAH");

    const nama = tampilNama((await namaPengguna(client, [user.id])).get(user.id));
    const notif = [bast.created_by, bast.penerima_user_id]
      .filter((uid): uid is string => !!uid && uid !== user.id)
      .map((uid) => ({
        user_id: uid,
        title: "BAST Siap Diserahterimakan",
        message: `${nama} sudah menandatangani BAST ${bast.jenis_nama} untuk ${bast.penerima_instansi}.`,
        link: `/bast/${id}`,
      }));
    if (notif.length) await createNotifications(client, notif, { actorId: user.id });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
