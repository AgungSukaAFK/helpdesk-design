// Tipe & batas yang dipakai bersama oleh /api/search dan global search di top bar.

export type SearchHitKind = "permintaan" | "artikel" | "user";

export type SearchHit = {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Status permintaan (TO DO, …) / artikel (draft, …) / role user. */
  status?: string;
  /** Cocok persis dengan query → masuk grup "Paling cocok". */
  exact?: boolean;
};

export type SearchResponse = { results: SearchHit[] };

export type PendingResponse = { items: SearchHit[]; total: number };

/** Maksimal baris per grup data. Grup yang penuh mendapat item "Lihat semua hasil". */
export const SEARCH_GROUP_LIMIT = 5;

/** Data baru dicari ke server mulai panjang query ini. */
export const SEARCH_MIN_QUERY = 3;
