import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";

export const dynamic = "force-dynamic";

const BATAS = 20;

/** Karakter yang punya arti khusus di filter PostgREST (or/ilike) dibuang. */
const bersihkan = (q: string) => q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);

// Pencarian untuk combobox form BAST: tanpa kata kunci = 20 data terbaru,
// dengan kata kunci = maks. 20 hasil yang cocok.
//   ?tipe=permintaan&q=  → admin: semua, designer: yang ia PIC-i
//   ?tipe=user&q=        → semua user (untuk akun penerima)
export async function GET(request: NextRequest) {
  try {
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;
    const tipe = request.nextUrl.searchParams.get("tipe");
    const q = bersihkan(request.nextUrl.searchParams.get("q") || "");

    if (tipe === "permintaan") {
      let query = client
        .from("permintaan")
        .select("id, judul, project, departemen, status")
        .order("created_at", { ascending: false })
        .limit(BATAS);
      if (role !== "admin") query = query.eq("admin", user.id);
      if (q) query = query.or(`judul.ilike.%${q}%,project.ilike.%${q}%,departemen.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data ?? [] });
    }

    if (tipe === "user") {
      let query = client
        .from("user_profiles")
        .select("id, name, email, role, departemen")
        .order("created_at", { ascending: false })
        .limit(BATAS);
      if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,departemen.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data ?? [] });
    }

    return NextResponse.json({ error: "tipe tidak dikenal" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
