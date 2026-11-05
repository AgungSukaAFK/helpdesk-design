import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import {
  isAdminIT,
  STATUS_META,
  normalizeStatus,
  susunTimeline,
  validasiTimeline,
  type EntriTimeline,
} from "@/lib/permintaan-workflow";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const samaWaktu = (a?: string | null, b?: string | null) =>
  (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null);

const sidikTimeline = (rows: EntriTimeline[]) =>
  JSON.stringify(
    rows.map((r) => [Date.parse(r.created_at), r.status_to, r.changed_by || null, r.catatan || null]),
  );

// Mengubah data yang biasanya terkunci, termasuk menulis ulang timeline.
// Perubahan status lewat aksi alur kerja tetap di /api/permintaan/[id]/aksi.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin"]);
    if (!access.client) return access.response;
    const { client: supabase, user } = access;

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, departemen, name")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    if (!isAdminIT(profile)) {
      return NextResponse.json(
        { error: "Edit Lanjutan hanya untuk admin departemen IT" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.timeline) || !body.updated_at) {
      return NextResponse.json({ error: "Data timeline tidak valid" }, { status: 400 });
    }

    const timeline: EntriTimeline[] = body.timeline.map((e: any) => ({
      created_at: typeof e?.created_at === "string" ? e.created_at : "",
      status_to: String(e?.status_to ?? "").toUpperCase(),
      changed_by: typeof e?.changed_by === "string" && e.changed_by ? e.changed_by : null,
      catatan: typeof e?.catatan === "string" ? e.catatan.trim() || null : null,
    }));
    const timelineError = validasiTimeline(timeline);
    if (timelineError) {
      return NextResponse.json({ error: timelineError }, { status: 400 });
    }

    const requester = String(body.requester ?? "");
    const dueDate = String(body.due_date ?? "");
    const rating = body.rating === null ? null : Number(body.rating);
    const review = typeof body.review === "string" ? body.review.trim() || null : null;

    if (Number.isNaN(Date.parse(dueDate))) {
      return NextResponse.json({ error: "Deadline tidak valid" }, { status: 400 });
    }
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      return NextResponse.json({ error: "Rating harus 1-5 atau dikosongkan" }, { status: 400 });
    }

    const userIds = [
      ...new Set([requester, ...timeline.map((e) => e.changed_by).filter(Boolean)]),
    ] as string[];
    if (!userIds.every((userId) => UUID_RE.test(userId))) {
      return NextResponse.json({ error: "Pengguna tidak valid" }, { status: 400 });
    }
    const { data: users, error: usersError } = await supabase
      .from("user_profiles")
      .select("id")
      .in("id", userIds);
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }
    if ((users || []).length !== userIds.length) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 400 });
    }

    const [{ data: ticket, error: ticketError }, { data: riwayatLama, error: riwayatError }] =
      await Promise.all([
        supabase
          .from("permintaan")
          .select("created_at, status, requester, due_date, rating, review, updated_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("permintaan_riwayat")
          .select("created_at, status_to, changed_by, catatan")
          .eq("permintaan_id", id)
          .order("created_at", { ascending: true }),
      ]);
    if (ticketError || riwayatError) {
      return NextResponse.json(
        { error: ticketError?.message || riwayatError?.message },
        { status: 500 }
      );
    }
    if (!ticket) {
      return NextResponse.json({ error: "Data permintaan tidak ditemukan" }, { status: 404 });
    }

    const { riwayat, kolom } = susunTimeline(timeline);

    const perubahan: string[] = [];
    if (sidikTimeline(timeline) !== sidikTimeline(riwayatLama || [])) perubahan.push("timeline");
    if (!samaWaktu(kolom.created_at, ticket.created_at)) perubahan.push("tanggal dibuat");
    if (requester !== ticket.requester) perubahan.push("peminta");
    if (!samaWaktu(dueDate, ticket.due_date)) perubahan.push("deadline");
    if (rating !== ticket.rating || review !== (ticket.review || null)) {
      perubahan.push("rating & ulasan");
    }
    if (perubahan.length === 0) {
      return NextResponse.json({ success: true, changed: false });
    }

    const statusBerubah = normalizeStatus(ticket.status) !== kolom.status;
    const log =
      `[SYSTEM] ${profile?.name || "Admin"} (Admin IT) mengubah ${perubahan.join(", ")}` +
      (statusBerubah
        ? `. Status menjadi ${STATUS_META[normalizeStatus(kolom.status)].label}.`
        : ".");

    const { error: rpcError } = await supabase.rpc("admin_edit_permintaan", {
      p_id: id,
      p_actor: user.id,
      p_expected_updated_at: body.updated_at,
      p_fields: { ...kolom, due_date: dueDate, requester, rating, review },
      p_timeline: riwayat,
      p_log: log,
    });

    if (rpcError?.code === "HD409") {
      return NextResponse.json(
        { error: "Permintaan baru saja berubah. Muat ulang data lalu ulangi perubahan Anda." },
        { status: 409 }
      );
    }
    if (rpcError?.code === "PGRST202") {
      return NextResponse.json(
        { error: "Migration 0030_admin_edit_permintaan.sql belum dijalankan" },
        { status: 500 }
      );
    }
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, changed: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
