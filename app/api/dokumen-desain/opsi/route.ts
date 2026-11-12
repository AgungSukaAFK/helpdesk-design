import { NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { normalizeFiles } from "@/lib/permintaan-files";
import { isFileGambar } from "@/lib/dokumen-desain";

export const dynamic = "force-dynamic";

// Pilihan untuk form dokumen: permintaan desain yang boleh dibuatkan dokumen
// (admin: semua, designer: yang ia kerjakan) beserta file gambarnya, dan daftar user.
export async function GET() {
  try {
    const access = await getAuthorizedContext(["admin", "designer"]);
    if (!access.client) return access.response;
    const { client, user, role } = access;

    let query = client
      .from("permintaan")
      .select("id, judul, project, departemen, status, admin, requester, files, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (role !== "admin") query = query.eq("admin", user.id);

    const [{ data: permintaan, error }, { data: users, error: usersError }] = await Promise.all([
      query,
      client.from("user_profiles").select("id, name, email, role, departemen").order("name"),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });

    return NextResponse.json({
      permintaan: (permintaan ?? []).map(({ files, ...p }) => ({
        ...p,
        gambar: normalizeFiles(files).filter(isFileGambar),
      })),
      users: users ?? [],
      me: user.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
