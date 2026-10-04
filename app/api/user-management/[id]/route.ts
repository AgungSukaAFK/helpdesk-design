import { NextRequest, NextResponse } from "next/server";
import { getUserManagementAdminClient } from "@/lib/supabase/user-management-admin";

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
    const departemen = user.user_metadata?.departemen || "-";

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        name,
        role,
        departemen,
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
    const { name, role, departemen } = body;

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
      ...(departemen !== undefined && { departemen: departemen.trim() }),
    };

    // 2. Update user_metadata in Auth
    const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: updatedMeta,
    });

    if (updateAuthErr) {
      return NextResponse.json({ error: updateAuthErr.message }, { status: 500 });
    }

    // 3. Upsert user_profiles (name & role)
    const profileUpdates: Record<string, any> = {
      id,
      email: authUser.user.email,
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) profileUpdates.name = name.trim();
    if (role !== undefined) profileUpdates.role = role;

    await supabase.from("user_profiles").upsert(profileUpdates);
    try {
      await supabase.from("users").upsert(profileUpdates);
    } catch (_) {}

    // 4. Update departemen in permintaan table for historical consistency
    if (departemen) {
      await supabase
        .from("permintaan")
        .update({ departemen: departemen })
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
    try {
      await supabase.from("users").delete().eq("id", id);
    } catch (_) {}

    return NextResponse.json({ success: true, message: "User berhasil dihapus" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}