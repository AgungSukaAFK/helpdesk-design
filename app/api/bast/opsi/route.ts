import { NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";

export const dynamic = "force-dynamic";

// Pilihan untuk form BAST: jenis, permintaan yang boleh dikaitkan
// (admin: semua, designer: yang ia PIC-i), dan daftar user.
export async function GET() {
  try {
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    let qPermintaan = client
      .from("permintaan")
      .select("id, judul, project, departemen, status, admin, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (role !== "admin") qPermintaan = qPermintaan.eq("admin", user.id);

    const [permintaan, users, jenis] = await Promise.all([
      qPermintaan,
      client.from("user_profiles").select("id, name, email, role, departemen").order("name"),
      client.from("bast_jenis").select("*").order("urutan").order("nama"),
    ]);
    const error = permintaan.error || users.error || jenis.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      permintaan: permintaan.data ?? [],
      users: users.data ?? [],
      jenis: jenis.data ?? [],
      me: { id: user.id, role },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
