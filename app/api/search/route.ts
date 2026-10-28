import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedContext, type AppRole } from "@/lib/supabase/authorization";
import {
  SEARCH_GROUP_LIMIT,
  SEARCH_MIN_QUERY,
  type PendingResponse,
  type SearchHit,
  type SearchResponse,
} from "@/lib/global-search";

export const dynamic = "force-dynamic";

// Client di sini memakai service role (RLS dilewati), jadi batas akses per role
// ditulis ulang di bawah dan harus sama dengan halaman list masing-masing:
// - permintaan: user hanya miliknya, designer hanya yang belum diambil / miliknya (api/permintaan)
// - artikel: user hanya yang terbit, designer terbit + tulisannya sendiri (artikel-admin)
// - user: hanya admin (user-management)

/** Kata pencarian tanpa karakter yang punya arti di filter PostgREST atau pola ilike. */
function toTokens(q: string) {
  return q
    .replace(/[%_*,()\\"'.:]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
}

function permintaanHit(row: any, q: string): SearchHit {
  const words = String(row.judul || "").toLowerCase().split(/[\s()[\]\-–—|]+/);
  return {
    kind: "permintaan",
    id: row.id,
    title: row.judul,
    subtitle: [row.project, row.departemen].filter(Boolean).join(" · "),
    href: `/permintaan-desain/${row.id}`,
    status: row.status,
    // Kode tiket (mis. IT250101) yang diketik persis.
    exact: /\d/.test(q) && words.includes(q.toLowerCase()),
  };
}

async function searchPermintaan(client: SupabaseClient, role: AppRole, userId: string, tokens: string[], q: string) {
  let query = client.from("permintaan").select("id, judul, project, departemen, status, created_at");
  if (role === "user") query = query.eq("requester", userId);
  if (role === "designer") query = query.or(`admin.is.null,admin.eq.${userId}`);
  for (const t of tokens) {
    query = query.or(`judul.ilike.%${t}%,project.ilike.%${t}%,departemen.ilike.%${t}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(SEARCH_GROUP_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => permintaanHit(row, q));
}

async function searchArtikel(client: SupabaseClient, role: AppRole, userId: string, tokens: string[], q: string) {
  let query = client.from("articles").select("id, title, slug, status, tags, author, created_at");
  if (role === "user") query = query.eq("status", "published");
  if (role === "designer") query = query.or(`status.eq.published,author.eq.${userId}`);
  for (const t of tokens) query = query.ilike("title", `%${t}%`);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(SEARCH_GROUP_LIMIT);
  if (error) throw error;
  return (data ?? []).map(
    (row): SearchHit => ({
      kind: "artikel",
      id: row.id,
      title: row.title,
      subtitle: (row.tags ?? []).slice(0, 3).join(", "),
      // Yang sudah terbit dibuka untuk dibaca; draft/arsip ke halaman edit.
      href: row.status === "published" ? `/artikel/${row.slug}` : `/artikel-admin/${row.id}`,
      status: row.status,
      exact: row.slug === q.toLowerCase() || String(row.title).toLowerCase() === q.toLowerCase(),
    }),
  );
}

async function searchUsers(client: SupabaseClient, tokens: string[], q: string) {
  let query = client.from("user_profiles").select("id, name, email, role, departemen");
  for (const t of tokens) query = query.or(`name.ilike.%${t}%,email.ilike.%${t}%`);
  const { data, error } = await query.order("name", { ascending: true }).limit(SEARCH_GROUP_LIMIT);
  if (error) throw error;
  return (data ?? []).map(
    (row): SearchHit => ({
      kind: "user",
      id: row.id,
      title: row.name || row.email || "-",
      subtitle: [row.email, row.departemen].filter(Boolean).join(" · "),
      href: `/user-management/${row.id}`,
      status: row.role,
      exact: String(row.email || "").toLowerCase() === q.toLowerCase(),
    }),
  );
}

/** Permintaan yang sedang menunggu tindakan user ini (urut tenggat terdekat). */
async function pendingForUser(client: SupabaseClient, role: AppRole, userId: string): Promise<PendingResponse> {
  const conditions = [`and(status.eq.REVIEW,requester.eq.${userId})`];
  if (role !== "user") {
    conditions.push(`and(status.eq."TO DO",admin.is.null)`, `and(status.in.(PROGRESS,REVISION,PENDING),admin.eq.${userId})`);
  }
  const { data, error, count } = await client
    .from("permintaan")
    .select("id, judul, project, departemen, status, due_date", { count: "exact" })
    .or(conditions.join(","))
    .order("due_date", { ascending: true })
    .limit(SEARCH_GROUP_LIMIT);
  if (error) throw error;
  return { items: (data ?? []).map((row) => permintaanHit(row, "")), total: count ?? 0 };
}

export async function GET(request: NextRequest) {
  const access = await getAuthorizedContext(["admin", "user", "designer"]);
  if (access.response) return access.response;
  const { client, user, role } = access;
  const { searchParams } = request.nextUrl;

  try {
    if (searchParams.get("pending") === "1") {
      return NextResponse.json(await pendingForUser(client, role, user.id));
    }

    const q = (searchParams.get("q") || "").trim().slice(0, 100);
    const tokens = toTokens(q);
    if (q.length < SEARCH_MIN_QUERY || tokens.length === 0) {
      return NextResponse.json({ results: [] } satisfies SearchResponse);
    }

    const groups = await Promise.all([
      searchPermintaan(client, role, user.id, tokens, q),
      searchArtikel(client, role, user.id, tokens, q),
      role === "admin" ? searchUsers(client, tokens, q) : Promise.resolve([]),
    ]);
    return NextResponse.json({ results: groups.flat() } satisfies SearchResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Pencarian gagal" }, { status: 500 });
  }
}
