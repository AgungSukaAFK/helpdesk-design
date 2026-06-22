// Tipe data & helper untuk fitur Artikel

export type ArticleStatus = "draft" | "published" | "archived";

export interface Article {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  tags: string[];
  status: ArticleStatus;
  featured: boolean;
  author: string | null;
  published_at: string | null;
  views: number;
}

export const ARTICLES_BUCKET = "articles";

// Daftar tag terkurasi (admin tetap boleh menambah tag bebas)
export const CURATED_TAGS = [
  "Tutorial",
  "Update",
  "Tips & Trik",
  "Branding",
  "Inspirasi",
  "Studi Kasus",
  "Pengumuman",
  "Event",
];

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

/** Ubah judul menjadi slug URL-friendly. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // hapus diakritik
    .replace(/[^a-z0-9\s-]/g, "") // hapus karakter non-alfanumerik
    .replace(/\s+/g, "-") // spasi -> tanda hubung
    .replace(/-+/g, "-") // gabungkan tanda hubung
    .replace(/^-+|-+$/g, ""); // trim tanda hubung di tepi
}

/** Bangun URL publik dari path objek di storage bucket articles. */
export function articleImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${ARTICLES_BUCKET}/${path}`;
}

/** Estimasi waktu baca (menit) dari konten HTML. */
export function readingTime(html: string | null | undefined): number {
  if (!html) return 1;
  const text = html.replace(/<[^>]*>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDateID(date: string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
