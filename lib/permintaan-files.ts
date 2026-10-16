export interface PermintaanFile {
  name: string;
  url: string;
}

const DEFAULT_BUCKET = "permintaan";

/**
 * Data lama dari halaman "Buat Permintaan" menyimpan path storage
 * (mis. "design-requests/123_file.pdf") di kolom `url`, bukan URL publik.
 * Ubah path tersebut menjadi URL publik Supabase agar bisa dibuka/diunduh.
 */
export function resolveFileUrl(url: string, bucket = DEFAULT_BUCKET): string {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return url;
  const path = url
    .replace(/^\/+/, "")
    .split("/")
    .map((seg) => {
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export function normalizeFiles(files: unknown): PermintaanFile[] {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f): f is PermintaanFile => !!f && typeof f.url === "string")
    .map((f) => ({ ...f, url: resolveFileUrl(f.url) }));
}

/**
 * URL publik Supabase mendukung query `download` untuk memaksa header
 * Content-Disposition: attachment, sehingga browser mengunduh file
 * (atribut `download` pada <a> diabaikan untuk URL lintas origin).
 */
export function downloadFile(file: PermintaanFile) {
  const href = resolveFileUrl(file.url);
  let target = href;
  if (href.includes("/storage/v1/object/public/")) {
    const u = new URL(href);
    u.searchParams.set("download", file.name);
    target = u.toString();
  }
  const a = document.createElement("a");
  a.href = target;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
