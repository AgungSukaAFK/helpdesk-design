import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedContext } from "@/lib/supabase/authorization";
import { createNotifications } from "@/lib/notifications/server";

// GET: Get notifications for current user
export async function GET(request: NextRequest) {
  try {
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client: supabase, user } = access;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client: supabase, user } = access;
    const body = await request.json();
    const { id, read_all } = body;

    if (read_all) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create notification (server-side helper)
export async function POST(request: NextRequest) {
  try {
    const access = await getAuthorizedContext(["admin", "user", "designer"]);
    if (!access.client) return access.response;
    const { client: adminClient, user } = access;

    const body = await request.json();
    const { type, title, message, link, target_user_id } = body;

    if (type === "notify_admins") {
      // Find all admins and designers
      const { data: admins } = await adminClient
        .from("user_profiles")
        .select("id")
        .in("role", ["admin", "designer"]);

      if (admins && admins.length > 0) {
        await createNotifications(
          adminClient,
          admins.map((a) => ({ user_id: a.id, title, message, link })),
          { actorId: user.id },
        );
      }
    } else if (target_user_id) {
      await createNotifications(
        adminClient,
        [{ user_id: target_user_id, title, message, link }],
        { actorId: user.id },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
