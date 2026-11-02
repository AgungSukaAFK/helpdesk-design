import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "user" | "designer";

/** Cukup id & email: data lain dari token tidak dipakai route API. */
export type AuthorizedUser = Pick<User, "id" | "email">;

type AuthorizationResult =
  | { client: SupabaseClient; user: AuthorizedUser; role: AppRole; response: null }
  | { client: null; user: null; role: null; response: NextResponse };

export async function getAuthorizedContext(
  allowedRoles: AppRole[]
): Promise<AuthorizationResult> {
  const sessionClient = await createSessionClient();
  // getClaims() memverifikasi JWT secara lokal (signing key asimetris), tanpa
  // request ke server Auth seperti getUser() di setiap panggilan API.
  const { data: claimsData, error: authError } = await sessionClient.auth.getClaims();
  const claims = claimsData?.claims;
  const user: AuthorizedUser | null = claims?.sub
    ? { id: claims.sub, email: claims.email }
    : null;

  if (authError || !user) {
    return {
      client: null,
      user: null,
      role: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      client: null,
      user: null,
      role: null,
      response: NextResponse.json(
        { error: "Konfigurasi service role Supabase belum tersedia" },
        { status: 500 }
      ),
    };
  }

  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      client: null,
      user: null,
      role: null,
      response: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  const role: AppRole = profile?.role === "admin" || profile?.role === "designer"
    ? profile.role
    : "user";

  if (!allowedRoles.includes(role)) {
    return {
      client: null,
      user: null,
      role: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { client, user, role, response: null };
}