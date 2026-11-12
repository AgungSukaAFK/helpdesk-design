import { NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";

export const dynamic = "force-dynamic";

// Pilihan awal form BAST: jenis dan anggota tim Design (calon penyerah).
// Permintaan & akun penerima dicari bertahap lewat /api/bast/cari.
export async function GET() {
  try {
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    const [staff, jenis] = await Promise.all([
      client.from("user_profiles").select("id, name, email, role, departemen").in("role", ["admin", "designer"]).order("name"),
      client.from("bast_jenis").select("*").order("urutan").order("nama"),
    ]);
    const error = staff.error || jenis.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      staff: staff.data ?? [],
      jenis: jenis.data ?? [],
      me: { id: user.id, role },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
