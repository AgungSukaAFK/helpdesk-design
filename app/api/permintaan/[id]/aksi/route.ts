import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications } from "@/lib/notifications/server";
import {
  allowedActions,
  normalizeStatus,
  STATUS_LIST,
  STATUS_META,
  type PermintaanStatus,
  type WorkflowAction,
} from "@/lib/permintaan-workflow";

export const dynamic = "force-dynamic";

// Satu pintu untuk semua perubahan status permintaan desain.
// Validasi peran & status dilakukan di server agar alur tidak bisa dilompati.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client: supabase, user, role } = access;

    const body = await request.json().catch(() => ({}));
    const action = body.action as WorkflowAction;
    const note = typeof body.note === "string" ? body.note.trim() : "";

    const { data: ticket, error: ticketError } = await supabase
      .from("permintaan")
      .select("id, judul, status, requester, admin")
      .eq("id", id)
      .maybeSingle();
    if (ticketError) {
      return NextResponse.json({ error: ticketError.message }, { status: 500 });
    }
    if (!ticket) {
      return NextResponse.json({ error: "Data permintaan tidak ditemukan" }, { status: 404 });
    }

    const actor = { id: user.id, role };
    if (!allowedActions(ticket, actor).includes(action)) {
      return NextResponse.json(
        {
          error: `Aksi tidak tersedia saat status "${STATUS_META[normalizeStatus(ticket.status)].label}" untuk peran Anda.`,
        },
        { status: 403 }
      );
    }

    const { data: actorProfile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    const actorName = actorProfile?.name || "Pengguna";

    const updates: Record<string, any> = { updated_by: user.id, last_status_note: note || null };
    let notifyTarget: string | null = null;
    let notifyTitle = "";
    let notifyMessage = "";
    let systemChat: string | null = null;

    switch (action) {
      case "ambil":
        updates.admin = user.id;
        updates.status = "PROGRESS";
        notifyTarget = ticket.requester;
        notifyTitle = "Desainer Ditugaskan";
        notifyMessage = `Permintaan "${ticket.judul}" mulai dikerjakan oleh ${actorName}.`;
        systemChat = `[SYSTEM] ${actorName} mengambil permintaan dan mulai mengerjakan.`;
        break;

      case "kirim_review":
        updates.status = "REVIEW";
        notifyTarget = ticket.requester;
        notifyTitle = "Hasil Desain Siap Direview";
        notifyMessage = `Hasil untuk "${ticket.judul}" sudah dikirim. Silakan cek lalu terima atau ajukan revisi.`;
        systemChat = `[SYSTEM] Hasil dikirim untuk direview${note ? `: "${note}"` : "."}`;
        break;

      case "revisi":
        if (!note) {
          return NextResponse.json({ error: "Catatan revisi wajib diisi" }, { status: 400 });
        }
        updates.status = "REVISION";
        // Dibuka ulang dari DONE: penilaian lama tidak berlaku
        updates.rating = null;
        updates.review = null;
        notifyTarget = ticket.admin;
        notifyTitle = "Permintaan Revisi";
        notifyMessage = `${actorName} meminta revisi untuk "${ticket.judul}": ${note}`;
        systemChat = `[SYSTEM] Mengirim permintaan REVISI: "${note}"`;
        break;

      case "selesai": {
        const rating = Number(body.rating);
        const isOwner = ticket.requester === user.id;
        if (isOwner && !(rating >= 1 && rating <= 5)) {
          return NextResponse.json({ error: "Rating 1-5 wajib diisi" }, { status: 400 });
        }
        updates.status = "DONE";
        if (rating >= 1 && rating <= 5) updates.rating = rating;
        if (typeof body.review === "string") updates.review = body.review.trim() || null;
        notifyTarget = isOwner ? ticket.admin : ticket.requester;
        notifyTitle = "Permintaan Selesai";
        notifyMessage = isOwner
          ? `Permintaan "${ticket.judul}" diterima oleh ${actorName}${rating ? ` dengan rating ${rating}/5` : ""}.`
          : `Permintaan "${ticket.judul}" ditandai selesai oleh ${actorName}.`;
        systemChat = `[SYSTEM] Permintaan diterima & ditandai SELESAI oleh ${actorName}.`;
        break;
      }

      case "ubah_status": {
        const target = String(body.status || "").toUpperCase();
        if (!(STATUS_LIST as string[]).includes(target)) {
          return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
        }
        if (target === normalizeStatus(ticket.status)) {
          return NextResponse.json({ success: true });
        }
        updates.status = target as PermintaanStatus;
        notifyTarget = ticket.requester;
        notifyTitle = "Status Permintaan Diperbarui";
        notifyMessage = `Status "${ticket.judul}" diubah admin menjadi ${STATUS_META[target as PermintaanStatus].label}.`;
        systemChat = `[SYSTEM] Admin mengubah status menjadi ${STATUS_META[target as PermintaanStatus].label}${note ? `: "${note}"` : "."}`;
        break;
      }

      default:
        return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("permintaan")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (systemChat) {
      await supabase
        .from("komentar")
        .insert({ permintaan_id: id, user_id: user.id, message: systemChat });
    }
    if (notifyTarget && notifyTarget !== user.id) {
      await createNotifications(supabase, [{
        user_id: notifyTarget,
        title: notifyTitle,
        message: notifyMessage,
        link: `/permintaan-desain/${id}`,
      }], { actorId: user.id });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
