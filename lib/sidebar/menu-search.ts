// Skor kecocokan menu & aksi untuk global search. Cocok ke judul, singkatan
// otomatis ("pd" → Permintaan Desain), kata kunci per URL/grup, dan tahan
// salah ketik 1 huruf.

/** Kata kunci tambahan per URL menu (istilah lain yang biasa dipakai user). */
export const MENU_KEYWORDS: Record<string, string[]> = {
  "/dashboard": ["beranda", "home", "ringkasan", "statistik"],
  "/notifikasi": ["notif", "pemberitahuan", "inbox", "pesan"],
  "/permintaan-desain": ["tiket", "ticket", "request", "pengajuan", "order desain", "helpdesk"],
  "/riwayat-pengerjaan": ["history", "selesai", "arsip", "hasil kerja"],
  "/riwayat": ["history", "tiket saya", "arsip", "selesai"],
  "/feedback": ["rating", "ulasan", "penilaian", "kepuasan", "review"],
  "/attendance": ["absensi", "absen", "kehadiran", "presensi"],
  "/daily-activity": ["aktivitas harian", "laporan harian", "kegiatan", "jobdesk", "log"],
  "/safety-toolbox-meeting-hse": ["stm", "k3", "hse", "safety", "toolbox", "jadwal"],
  "/program-kerja": ["proker", "rencana kerja", "roadmap"],
  "/kpi": ["kinerja", "performa", "target", "penilaian"],
  "/rekap-bulanan": ["laporan bulanan", "report", "rekap", "excel"],
  "/artikel-admin": ["blog", "berita", "tulisan", "knowledge base", "panduan"],
  "/user-management": ["pengguna", "akun", "role", "hak akses"],
  "/dokumentasi": ["docs", "bantuan", "help", "cara pakai", "tutorial"],
  "/tentang-app": ["about", "versi", "informasi aplikasi"],
};

/** Kata kunci per label grup sidebar. */
export const GROUP_KEYWORDS: Record<string, string[]> = {
  Utama: ["home"],
  "Permintaan Desain": ["tiket", "desain"],
  "Aktivitas Tim": ["tim", "team", "sdm"],
  "Laporan & Kinerja": ["laporan", "report"],
  Konten: ["content"],
  Administrasi: ["admin", "pengaturan", "setting"],
  Bantuan: ["help"],
};

/** Skor minimal agar menu/aksi tampil; cocok sebagai subsequence saja tidak cukup. */
export const MIN_LOCAL_SCORE = 20;

export type Scorable = {
  title: string;
  keywords?: string[];
  group?: string;
  groupKeywords?: string[];
};

export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/\s-]/g, " ")
    .replace(/[\s-]+/g, " ")
    .trim();
}

function acronym(text: string) {
  return text
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
}

function isSubsequence(needle: string, haystack: string) {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i++;
  return i === needle.length;
}

/** Jarak edit ≤ 1 (substitusi, sisip, hapus, atau tukar dua huruf bersebelahan). */
function withinOneEdit(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else {
      if (skipped) return false;
      skipped = true;
      j++;
    }
  }
  return true;
}

function scoreTerm(term: string, item: Scorable): number {
  const title = normalizeText(item.title);
  const words = title.split(" ");
  const keywords = (item.keywords ?? []).map(normalizeText);
  const groupWords = [item.group ?? "", ...(item.groupKeywords ?? [])].map(normalizeText).filter(Boolean);

  if (title === term) return 100;
  if (title.startsWith(term)) return 85;
  if (words.some((w) => w.startsWith(term))) return 70;
  if (term.length >= 2 && acronym(title).startsWith(term)) return 65;
  if (keywords.includes(term)) return 60;
  if (title.includes(term)) return 50;
  if (keywords.some((k) => k.startsWith(term) || k.split(" ").some((w) => w.startsWith(term)))) return 42;
  if (keywords.some((k) => k.includes(term))) return 30;
  if (groupWords.some((g) => g.split(" ").some((w) => w.startsWith(term)))) return 25;

  if (term.length >= 4) {
    const candidates = words.concat(keywords.flatMap((k) => k.split(" ")));
    // Bandingkan juga dengan awalan kata, supaya "permintan" tetap cocok ke "permintaan".
    if (candidates.some((w) => withinOneEdit(term, w) || withinOneEdit(term, w.slice(0, term.length)))) return 22;
  }

  if (isSubsequence(term, title.replace(/ /g, ""))) return 10;
  return 0;
}

/** 0–100. Query multi-kata: tiap kata harus cocok (urutan bebas). */
export function scoreMenuItem(query: string, item: Scorable) {
  const q = normalizeText(query);
  if (!q) return 0;
  const whole = scoreTerm(q, item);
  const terms = q.split(" ");
  if (terms.length === 1) return whole;

  const perTerm = terms.map((t) => scoreTerm(t, item));
  if (perTerm.some((s) => s < MIN_LOCAL_SCORE)) return whole;
  const avg = perTerm.reduce((a, b) => a + b, 0) / perTerm.length;
  return Math.max(whole, Math.round(avg * 0.95));
}

/** Pecah teks jadi bagian biasa & bagian yang cocok dengan kata di query, untuk <mark>. */
export function splitHighlight(text: string, query: string) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) return [{ text, match: false }];
  const re = new RegExp(`(${terms.join("|")})`, "gi");
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, match: terms.some((t) => new RegExp(`^${t}$`, "i").test(part)) }));
}
