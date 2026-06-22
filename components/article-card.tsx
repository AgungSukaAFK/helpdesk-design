import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Article, articleImageUrl, formatDateID } from "@/lib/articles";
import { ImageIcon } from "lucide-react";

type CardArticle = Pick<
  Article,
  "title" | "slug" | "excerpt" | "cover_image" | "tags" | "published_at" | "created_at"
>;

export function ArticleCard({ article }: { article: CardArticle }) {
  const cover = articleImageUrl(article.cover_image);
  return (
    <a
      href={`/artikel/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {article.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug transition-colors group-hover:text-primary">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
            {article.excerpt}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          {formatDateID(article.published_at || article.created_at)}
        </p>
      </div>
    </a>
  );
}
