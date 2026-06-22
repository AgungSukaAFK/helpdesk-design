import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleCard } from "@/components/article-card";
import { Article, articleImageUrl, formatDateID } from "@/lib/articles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Search, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export const metadata = {
  title: "Artikel — DesignDesk",
  description: "Tips, tutorial, dan kabar terbaru seputar desain dari DesignDesk.",
};

const PAGE_SIZE = 9;

type CardArticle = Pick<
  Article,
  "title" | "slug" | "excerpt" | "cover_image" | "tags" | "published_at" | "created_at"
>;

function buildQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  });
  const str = sp.toString();
  return str ? `/artikel?${str}` : "/artikel";
}

export default async function ArtikelPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const tag = sp.tag?.trim() || "";
  const page = Math.max(1, Number(sp.page || "1"));
  const isDefaultView = !q && !tag && page === 1;

  const supabase = await createClient();

  // Artikel unggulan (hanya pada tampilan default)
  let featured: CardArticle | null = null;
  if (isDefaultView) {
    const { data } = await supabase
      .from("articles")
      .select(
        "title, slug, excerpt, cover_image, tags, published_at, created_at"
      )
      .eq("status", "published")
      .eq("featured", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    featured = (data as CardArticle) || null;
  }

  // Daftar tag untuk filter
  const { data: tagRows } = await supabase
    .from("articles")
    .select("tags")
    .eq("status", "published");
  const allTags = Array.from(
    new Set((tagRows || []).flatMap((r: { tags: string[] }) => r.tags || []))
  ).sort();

  // Grid artikel
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("articles")
    .select(
      "title, slug, excerpt, cover_image, tags, published_at, created_at",
      { count: "exact" }
    )
    .eq("status", "published");

  if (q) query = query.ilike("title", `%${q}%`);
  if (tag) query = query.contains("tags", [tag]);
  if (featured) query = query.neq("slug", featured.slug);

  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  const { data: articles, count } = await query;
  const list = (articles as CardArticle[]) || [];
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero / judul */}
        <section className="border-b border-border bg-muted/30">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Artikel & Wawasan
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
              Tips, tutorial, dan kabar terbaru seputar desain untuk membantu
              alur kerja tim Anda.
            </p>

            {/* Pencarian */}
            <form
              action="/artikel"
              method="GET"
              className="mt-6 flex max-w-md gap-2"
            >
              {tag && <input type="hidden" name="tag" value={tag} />}
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Cari artikel…"
                  className="pl-10"
                />
              </div>
              <Button type="submit">Cari</Button>
            </form>

            {/* Filter tag */}
            {allTags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={buildQuery({ q: q || undefined })}>
                  <Badge
                    variant={tag ? "outline" : "default"}
                    className="cursor-pointer"
                  >
                    Semua
                  </Badge>
                </a>
                {allTags.map((t) => (
                  <a key={t} href={buildQuery({ q: q || undefined, tag: t })}>
                    <Badge
                      variant={tag === t ? "default" : "outline"}
                      className="cursor-pointer"
                    >
                      {t}
                    </Badge>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="container mx-auto px-4 py-12">
          {/* Featured */}
          {featured && (
            <a
              href={`/artikel/${featured.slug}`}
              className="group mb-12 grid gap-6 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-2"
            >
              <div className="relative aspect-video md:aspect-auto md:min-h-[320px]">
                {articleImageUrl(featured.cover_image) ? (
                  <Image
                    src={articleImageUrl(featured.cover_image)}
                    alt={featured.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="h-full w-full bg-muted" />
                )}
              </div>
              <div className="flex flex-col justify-center p-6 md:p-10">
                <Badge className="mb-3 w-fit">Unggulan</Badge>
                <h2 className="text-2xl font-bold leading-tight transition-colors group-hover:text-primary md:text-3xl">
                  {featured.title}
                </h2>
                {featured.excerpt && (
                  <p className="mt-3 text-muted-foreground">
                    {featured.excerpt}
                  </p>
                )}
                <p className="mt-4 text-sm text-muted-foreground">
                  {formatDateID(featured.published_at || featured.created_at)}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 font-medium text-primary">
                  Baca selengkapnya
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </a>
          )}

          {/* Grid */}
          {list.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed py-20 text-center text-muted-foreground">
              {q || tag
                ? "Tidak ada artikel yang cocok dengan filter."
                : "Belum ada artikel yang dipublikasikan."}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                asChild={page > 1}
              >
                {page > 1 ? (
                  <a href={buildQuery({ q: q || undefined, tag: tag || undefined, page: page - 1 })}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Sebelumnya
                  </a>
                ) : (
                  <span>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Sebelumnya
                  </span>
                )}
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                asChild={page < totalPages}
              >
                {page < totalPages ? (
                  <a href={buildQuery({ q: q || undefined, tag: tag || undefined, page: page + 1 })}>
                    Berikutnya
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </a>
                ) : (
                  <span>
                    Berikutnya
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
