import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications, type NotificationRow } from "@/lib/notifications/server";
import { bolehTandaTangan, hitungStatusDokumen } from "@/lib/dokumen-desain";
import {
  catatRiwayat,
  decodeTtdDataUrl,
  hapusFileTtd,
  namaPengguna,
  tampilNama,
  TTD_BUCKET,
} from "@/lib/dokumen-desain-server";

export const dynamic = "force-dynamic";

// Penanda tangan menyetujui (dengan gambar tanda tangan) atau menolak (dengan catatan).
// Jika satu orang punya beberapa peran di dokumen yang sama, semuanya ditandatangani sekaligus.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client, user } = access;

    const body = await request.json().catch(() => ({}));
    const aksi = body.aksi === "tolak" ? "tolak" : body.aksi === "setujui" ? "setujui" : null;
    if (!aksi) return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
    const catatan = typeof body.catatan === "string" ? body.catatan.trim().slice(0, 1000) : "";

    const { data: dok, error: dokError } = await client
      .from("dokumen_desain")
      .select("id, status, created_by, no_dokumen, permintaan:permintaan_id ( judul )")
      .eq("id", id)
      .maybeSingle();
    if (dokError) return NextResponse.json({ error: dokError.message }, { status: 500 });
    if (!dok) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

    const { data: ttdAwal } = await client
      .from("dokumen_desain_ttd")
      .select("id, user_id, status")
      .eq("dokumen_id", id);
    if (!bolehTandaTangan(dok, ttdAwal ?? [], user.id)) {
      return NextResponse.json(
        { error: "Dokumen ini tidak menunggu tanda tangan Anda." },
        { status: 403 },
      );
    }
    const barisSaya = (ttdAwal ?? []).filter((t) => t.user_id === user.id && t.status === "MENUNGGU");

    let ttdPath: string | null = null;
    if (aksi === "tolak") {
      if (!catatan) return NextResponse.json({ error: "Alasan penolakan wajib diisi" }, { status: 400 });
    } else {
      ttdPath = `ttd/${id}/${user.id}-${Date.now()}.png`;
      const storage = client.storage.from(TTD_BUCKET);

      if (body.pakaiTersimpan) {
        const { data: profil } = await client
          .from("user_profiles")
          .select("ttd_path")
          .eq("id", user.id)
          .maybeSingle();
        if (!profil?.ttd_path) {
          return NextResponse.json({ error: "Anda belum punya tanda tangan tersimpan" }, { status: 400 });
        }
        // Disalin agar dokumen tidak ikut berubah saat tanda tangan tersimpan diganti
        const { error } = await storage.copy(profil.ttd_path, ttdPath);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const bytes = decodeTtdDataUrl(body.ttd);
        if (!bytes) {
          return NextResponse.json(
            { error: "Gambar tanda tangan tidak valid (PNG, maks. 1 MB)." },
            { status: 400 },
          );
        }
        const { error } = await storage.upload(ttdPath, bytes, { contentType: "image/png" });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        if (body.simpan) {
          const profilPath = `profil/${user.id}.png`;
          const { error: simpanError } = await storage.upload(profilPath, bytes, {
            contentType: "image/png",
            upsert: true,
          });
          if (!simpanError) {
            await client.from("user_profiles").update({ ttd_path: profilPath }).eq("id", user.id);
          }
        }
      }
    }

    const { data: diubah, error: updError } = await client
      .from("dokumen_desain_ttd")
      .update({
        status: aksi === "setujui" ? "DISETUJUI" : "DITOLAK",
        ttd_path: ttdPath,
        signed_at: new Date().toISOString(),
        catatan: catatan || null,
      })
      .in("id", barisSaya.map((b) => b.id))
      .eq("status", "MENUNGGU")
      .select("id");
    if (updError || !diubah?.length) {
      await hapusFileTtd(client, [ttdPath]);
      return NextResponse.json(
        { error: updError?.message || "Tanda tangan sudah diproses sebelumnya." },
        { status: updError ? 500 : 409 },
      );
    }

    const { data: ttdAkhir } = await client
      .from("dokumen_desain_ttd")
      .select("user_id, status")
      .eq("dokumen_id", id);
    const statusBaru = hitungStatusDokumen(ttdAkhir ?? []);
    await client
      .from("dokumen_desain")
      .update({
        status: statusBaru,
        disetujui_at: statusBaru === "DISETUJUI" ? new Date().toISOString() : null,
      })
      .eq("id", id);

    await catatRiwayat(client, id, user.id, aksi === "setujui" ? "DITANDATANGANI" : "DITOLAK", catatan);
    if (statusBaru === "DISETUJUI") await catatRiwayat(client, id, user.id, "DISETUJUI");

    const nama = tampilNama((await namaPengguna(client, [user.id])).get(user.id));
    const judul = `${dok.no_dokumen} — ${(dok as any).permintaan?.judul ?? ""}`;
    const link = `/dokumen-desain/${id}`;
    const notif: NotificationRow[] = [];
    if (statusBaru === "DISETUJUI") {
      for (const uid of new Set([dok.created_by, ...(ttdAkhir ?? []).map((t) => t.user_id)])) {
        notif.push({ user_id: uid, title: "Dokumen Disetujui", message: `Semua pihak sudah menandatangani dokumen ${judul}.`, link });
      }
    } else if (aksi === "tolak") {
      notif.push({ user_id: dok.created_by, title: "Dokumen Ditolak", message: `${nama} menolak dokumen ${judul}: ${catatan}`, link });
    } else {
      notif.push({ user_id: dok.created_by, title: "Dokumen Ditandatangani", message: `${nama} menandatangani dokumen ${judul}.`, link });
    }
    await createNotifications(client, notif, { actorId: user.id });

    return NextResponse.json({ success: true, status: statusBaru });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
