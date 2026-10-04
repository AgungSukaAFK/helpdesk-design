import { NextRequest, NextResponse } from "next/server";
import { getUserManagementAdminClient } from "@/lib/supabase/user-management-admin";
import { getSiteRedirectUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await getUserManagementAdminClient();
    if (!access.client) return access.response;
    const supabase = access.client;
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.max(1, Number(searchParams.get("limit") || "10"));
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const role = searchParams.get("role") || "";
    const departemen = searchParams.get("departemen") || "";

    // 1. Fetch all users from Auth & Profiles
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const { data: profiles } = await supabase.from("user_profiles").select("*");
    const profileMap = new Map<string, any>();
    profiles?.forEach((p) => {
      profileMap.set(p.id, p);
    });

    // 2. Map & Normalize user list
    let allUsers = authData.users.map((u) => {
      const prof = profileMap.get(u.id);
      const name = prof?.name || u.user_metadata?.name || u.email?.split("@")[0] || "User";
      const userRole = prof?.role || u.user_metadata?.role || "user";
      const dept = u.user_metadata?.departemen || "-";

      return {
        id: u.id,
        email: u.email || "",
        name,
        role: userRole,
        departemen: dept,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    // Extract all unique departemens for filter dropdown
    const departemenSet = new Set<string>();
    allUsers.forEach((u) => {
      if (u.departemen && u.departemen !== "-") {
        departemenSet.add(u.departemen);
      }
    });
    const departemens = Array.from(departemenSet).sort();

    // 3. Apply Filters
    if (search) {
      allUsers = allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          u.departemen.toLowerCase().includes(search)
      );
    }

    if (role && role !== "all") {
      allUsers = allUsers.filter((u) => u.role === role);
    }

    if (departemen && departemen !== "all") {
      allUsers = allUsers.filter((u) => u.departemen === departemen);
    }

    // Sort: Admins first, then by name
    allUsers.sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (a.role !== "admin" && b.role === "admin") return 1;
      return a.name.localeCompare(b.name);
    });

    const total = allUsers.length;
    const from = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(from, from + limit);

    return NextResponse.json({
      data: paginatedUsers,
      total,
      page,
      limit,
      departemens,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getUserManagementAdminClient();
    if (!access.client) return access.response;

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = ["admin", "user", "designer"].includes(body.role) ? body.role : "";
    const departemen = typeof body.departemen === "string" ? body.departemen.trim() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Alamat email tidak valid" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Nama pengguna wajib diisi" }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json({ error: "Role pengguna tidak valid" }, { status: 400 });
    }
    if (!departemen) {
      return NextResponse.json({ error: "Departemen wajib diisi" }, { status: 400 });
    }

    const supabase = access.client;
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name, role, departemen },
      redirectTo: getSiteRedirectUrl("/protected"),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data.user) {
      return NextResponse.json({ error: "Undangan pengguna gagal dibuat" }, { status: 500 });
    }

    const profile = {
      id: data.user.id,
      email,
      name,
      role,
      updated_at: new Date().toISOString(),
    };
    const { error: profileError } = await supabase.from("user_profiles").upsert(profile);
    if (profileError) {
      await supabase.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    await supabase.from("users").upsert(profile);

    return NextResponse.json({ success: true, data: { ...profile, departemen } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
