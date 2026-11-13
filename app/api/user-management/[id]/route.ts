import { NextRequest, NextResponse } from "next/server";
import { getUserManagementAdminClient } from "@/lib/supabase/user-management-admin";
import { profilOrganisasi } from "@/lib/profile-options";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "User ID diperlukan" }, { status: 400 });
    }

    const access = await getUserManagementAdminClient();
    if (!access.client) return access.response;
    const supabase = access.client;

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(id);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const user = authUser.user;
    const name = profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "User";
    const role = profile?.role || user.user_metadata?.role || "user";
    const org = profilOrganisasi(profile, user.user_metadata);

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        name,
        role,
        departemen: org.departemen || "-",
        perusahaan: org.perusahaan,
        lokasi: org.lokasi,
        avatar_url: profile?.avatar_url || null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "User ID diperlukan" }, { status: 400 });
    }

    const body = await request.json();
    const { name, role, departemen, perusahaan, lokasi } = body;
    for (const [field, v] of Object.entries({ name, departemen, perusahaan, lokasi })) {
      if (v !== undefined && v !== null && typeof v !== "string") {
        return NextResponse.json({ error: `Field ${field} tidak valid` }, { status: 400 });
      }
    }
    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Nama pengguna wajib diisi" }, { status: 400 });
    }

    if (role !== undefined && !["admin", "user", "designer"].includes(role)) {
      return NextResponse.json({ error: "Role pengguna tidak valid" }, { status: 400 });
    }

    const access = await getUserManagementAdminClient();
    if (!access.client) return access.response;
    const supabase = access.client;

    // 1. Get existing auth user
    const { data: authUser, error: fetchErr } = await supabase.auth.admin.getUserById(id);
    if (fetchErr || !authUser?.user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const currentMeta = authUser.user.user_metadata || {};
    const updatedMeta = {
      ...currentMeta,
      ...(name !== undefined && { name: name.trim() }),
      ...(role !== undefined && { role: role }),
      ...(departemen !== undefined && { departemen: (departemen ?? "").trim() }),
      ...(perusahaan !== undefined && { perusahaan: (perusahaan ?? "").trim() }),
      ...(lokasi !== undefined && { lokasi: (lokasi ?? "").trim() }),
    };

    // 2. Update user_metadata in Auth
    const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: updatedMeta,
    });

    if (updateAuthErr) {
      return NextResponse.json({ error: updateAuthErr.message }, { status: 500 });
    }

    // 3. Upsert user_profiles (sumber data yang juga dipakai halaman My Profile)
    const profileUpdates: Record<string, any> = {
      id,
      email: authUser.user.email,
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) profileUpdates.name = name.trim();
    if (role !== undefined) profileUpdates.role = role;
    if (departemen !== undefined) profileUpdates.departemen = (departemen ?? "").trim() || null;
    if (perusahaan !== undefined) profileUpdates.perusahaan = (perusahaan ?? "").trim() || null;
    if (lokasi !== undefined) profileUpdates.lokasi = (lokasi ?? "").trim() || null;

    const { error: profileErr } = await supabase.from("user_profiles").upsert(profileUpdates);
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    // 4. Update departemen in permintaan table for historical consistency
    if (typeof departemen === "string" && departemen.trim()) {
      await supabase
        .from("permintaan")
        .update({ departemen: departemen.trim() })
        .eq("requester", id);
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        email: authUser.user.email,
        name: updatedMeta.name,
        role: updatedMeta.role,
        departemen: updatedMeta.departemen,
        perusahaan: updatedMeta.perusahaan,
        lokasi: updatedMeta.lokasi,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "User ID diperlukan" }, { status: 400 });
    }

    const access = await getUserManagementAdminClient();
    if (!access.client) return access.response;
    const supabase = access.client;

    // 1. Delete from auth.users (cascades or cleans up)
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Clean up user_profiles
    await supabase.from("user_profiles").delete().eq("id", id);

    return NextResponse.json({ success: true, message: "User berhasil dihapus" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}