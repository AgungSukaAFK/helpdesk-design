import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { canEditPermintaan } from "@/lib/permintaan-workflow";

export const dynamic = "force-dynamic";

const FAREL_ID = "54e6f310-813b-447b-aac0-9052423440da";
const PAULUS_ID = "bcfdf89c-d1e2-4602-80aa-005a1beb1d3c";

const cleanJudul = (title: string) => {
  if (!title) return title;
  return title
    .replace(/\s*[-–—]\s*IT[0-9]+/gi, "")
    .replace(/\s*\(\s*IT[0-9]+\s*\)/gi, "")
    .replace(/\bIT[0-9]{6,}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanDeskripsi = (desc: string) => {
  if (!desc) return desc;
  return desc
    .replace(/\[\s*Tiket:\s*IT[0-9]+\s*\|\s*Prioritas:/gi, "[Prioritas:")
    .replace(/Referensi Tiket IT Helpdesk:\s*IT[0-9]+/gi, "")
    .replace(/\[\s*Tiket:\s*IT[0-9]+\s*\]/gi, "")
    .replace(/\bIT[0-9]{6,}\b/gi, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID tiket diperlukan" }, { status: 400 });
    }

    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client: supabase, user, role } = access;
    const { data: item, error } = await supabase
      .from("permintaan")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: "Data permintaan tidak ditemukan" }, { status: 404 });
    }
    if (role === "user" && item.requester !== user.id && item.admin !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (role === "designer" && item.admin && item.admin !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let adminInfo: any = null;
    let requesterInfo: any = null;

    if (item.admin) {
      const { data: a } = await supabase
        .from("user_profiles")
        .select("id, name, email, role")
        .eq("id", item.admin)
        .maybeSingle();
      if (a) adminInfo = a;
      else if (item.admin === FAREL_ID) {
        adminInfo = { id: FAREL_ID, name: "Farel Ramadhan", role: "admin" };
      } else if (item.admin === PAULUS_ID) {
        adminInfo = { id: PAULUS_ID, name: "Paulus Sianipar", role: "admin" };
      }
    }

    if (item.requester) {
      const { data: r } = await supabase
        .from("user_profiles")
        .select("id, name, email, role")
        .eq("id", item.requester)
        .maybeSingle();
      if (r) requesterInfo = r;
    }

    const formatted = {
      ...item,
      judul: cleanJudul(item.judul),
      deskripsi: cleanDeskripsi(item.deskripsi),
      admin_data: adminInfo,
      requester_data: requesterInfo,
      admin_name: adminInfo?.name || (item.admin === FAREL_ID ? "Farel Ramadhan" : item.admin === PAULUS_ID ? "Paulus Sianipar" : "-"),
      requester_name: requesterInfo?.name || "Pelapor",
      files: Array.isArray(item.files) ? item.files : [],
    };

    return NextResponse.json({ data: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client: supabase, user, role } = access;
    const body = await request.json();
    const { judul, project, departemen, status, due_date, deskripsi, admin } = body;

    const targetId = id || body.id;
    if (!targetId) {
      return NextResponse.json({ error: "ID tiket diperlukan" }, { status: 400 });
    }

    const { data: currentTicket, error: currentTicketError } = await supabase
      .from("permintaan")
      .select("requester, admin, status")
      .eq("id", targetId)
      .maybeSingle();
    if (currentTicketError) {
      return NextResponse.json({ error: currentTicketError.message }, { status: 500 });
    }
    if (!currentTicket) {
      return NextResponse.json({ error: "Data permintaan tidak ditemukan" }, { status: 404 });
    }
    if (!canEditPermintaan(currentTicket, { id: user.id, role })) {
      return NextResponse.json(
        { error: "Anda hanya dapat mengedit permintaan milik Anda sendiri yang belum selesai" },
        { status: 403 }
      );
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
    if (judul !== undefined) updates.judul = cleanJudul(judul);
    if (project !== undefined) updates.project = project;
    if (departemen !== undefined) updates.departemen = departemen;
    if (due_date !== undefined) updates.due_date = due_date;
    if (deskripsi !== undefined) updates.deskripsi = cleanDeskripsi(deskripsi);
    // Status & PIC: non-admin wajib lewat aksi alur kerja (/api/permintaan/[id]/aksi)
    if (role === "admin") {
      if (status !== undefined) updates.status = status;
      if (admin !== undefined) updates.admin = admin;
    }

    const { data, error } = await supabase
      .from("permintaan")
      .update(updates)
      .eq("id", targetId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
