import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleCard } from "@/components/article-card";
import { Badge } from "@/components/ui/badge";
import {
  Article,
  articleImageUrl,
  formatDateID,
  readingTime,
} from "@/lib/articles";
import { ArrowLeft, Clock, Eye } from "lucide-react";
import type { Metadata } from "next";

type DetailArticle = Pick<
  Article,
  | "title"
  | "slug"
  | "excerpt"
  | "content"
  | "cover_image"
  | "tags"
  | "published_at"
  | "created_at"
  | "views"
>;

type CardArticle = Pick<
  Article,
  "title" | "slug" | "excerpt" | "cover_image" | "tags" | "published_at" | "created_at"
>;

async function getArticle(slug: string): Promise<DetailArticle | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select(
      "title, slug, excerpt, content, cover_image, tags, published_at, created_at, views"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as DetailArticle) || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Artikel tidak ditemukan — DesignDesk" };
  return {
    title: `${article.title} — DesignDesk`,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      images: article.cover_image
        ? [articleImageUrl(article.cover_image)]
        : undefined,
      type: "article",
    },
  };
}

export default async function ArtikelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const supabase = await createClient();

  // Hitung views (best-effort, abaikan error)
  await supabase.rpc("increment_article_views", { article_slug: slug });

  // Artikel terkait (tag yang sama)
  let related: CardArticle[] = [];
  if (article.tags.length > 0) {
    const { data } = await supabase
      .from("articles")
      .select(
        "title, slug, excerpt, cover_image, tags, published_at, created_at"
      )
      .eq("status", "published")
      .neq("slug", slug)
      .overlaps("tags", article.tags)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3);
    related = (data as CardArticle[]) || [];
  }

  const cover = articleImageUrl(article.cover_image);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1">
        <article>
          {/* Header */}
          <div className="container mx-auto max-w-3xl px-4 pt-10">
            <a
              href="/artikel"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Artikel
            </a>

            <div className="mt-6 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <a key={tag} href={`/artikel?tag=${encodeURIComponent(tag)}`}>
                  <Badge variant="secondary" className="cursor-pointer">
                    {tag}
                  </Badge>
                </a>
              ))}
            </div>

            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="mt-4 text-lg text-muted-foreground">
                {article.excerpt}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>
                {formatDateID(article.published_at || article.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {readingTime(article.content)} menit baca
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {article.views} kali dilihat
              </span>
            </div>
          </div>

          {/* Cover */}
          {cover && (
            <div className="container mx-auto max-w-4xl px-4 pt-8">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border">
                <Image
                  src={cover}
                  alt={article.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 896px"
                  priority
                />
              </div>
            </div>
          )}

          {/* Konten */}
          <div className="container mx-auto max-w-3xl px-4 py-10">
            {article.content ? (
              <div
                className="prose prose-lg dark:prose-invert max-w-none prose-img:rounded-xl prose-a:text-primary"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            ) : (
              <p className="text-muted-foreground">Konten belum tersedia.</p>
            )}
          </div>
        </article>

        {/* Artikel terkait */}
        {related.length > 0 && (
          <section className="border-t border-border bg-muted/30">
            <div className="container mx-auto px-4 py-12">
              <h2 className="mb-6 text-2xl font-bold tracking-tight">
                Artikel Terkait
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <ArticleCard key={item.slug} article={item} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
