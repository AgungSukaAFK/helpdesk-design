// Satu sumber opsi profil, dipakai halaman My Profile & User Management
// supaya pilihan dan nilai yang tersimpan selalu sama.

export const PERUSAHAAN_LOURDES = "Lourdes (Corporate)";

export const PERUSAHAAN_OPTIONS = [
  PERUSAHAAN_LOURDES,
  "PT. Garuda Mart Indonesia",
  "PT. Global Inti Sejati",
] as const;

/** Kode perusahaan anak yang datanya boleh diakses user dari perusahaan tsb. */
export type KodePerusahaan = "GMI" | "GIS";

const AKSES_PERUSAHAAN: Record<string, KodePerusahaan[]> = {
  // Lourdes = induk (corporate): akses data GMI & GIS sekaligus.
  [PERUSAHAAN_LOURDES]: ["GMI", "GIS"],
  "PT. Garuda Mart Indonesia": ["GMI"],
  "PT. Global Inti Sejati": ["GIS"],
};

/** Perusahaan mana saja yang datanya bisa diakses user. Kosong = belum diatur. */
export function aksesPerusahaan(perusahaan?: string | null): KodePerusahaan[] {
  return (perusahaan && AKSES_PERUSAHAAN[perusahaan]) || [];
}

export const LOKASI_OPTIONS = [
  "GIS HO",
  "GIS BPN",
  "GIS J5",
  "GIS KM8",
  "GMI BPN",
  "GMI J4",
  "GMI J5",
  "GMI KM10",
  "GMI KM8",
  "GMI Site",
  "Branch Tanjung Enim",
] as const;

export const DEPARTEMEN_OPTIONS = [
  "General Affair",
  "Marketing",
  "Manufacture",
  "HR",
  "HR/GA",
  "HSE",
  "Legal",
  "IT",
  "Finance",
  "SCM",
  "Warehouse",
  "Purchasing",
  "Service",
  "RND",
  "General Manager",
  "Executive Manager",
  "Boards of Director",
  "Design",
] as const;

/** Nilai select untuk departemen di luar daftar (diisi manual). */
export const DEPARTEMEN_LAINNYA = "Lainnya";

export const ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Designer", value: "designer" },
  { label: "User", value: "user" },
] as const;

export interface ProfilOrganisasi {
  perusahaan: string;
  lokasi: string;
  departemen: string;
}

const bersih = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "-" ? v.trim() : "");

/** Gabungkan data profil (sumber utama) dengan user_metadata lama sebagai cadangan. */
export function profilOrganisasi(
  profile?: Record<string, unknown> | null,
  meta?: Record<string, unknown> | null,
): ProfilOrganisasi {
  return {
    perusahaan: bersih(profile?.perusahaan) || bersih(meta?.perusahaan),
    lokasi: bersih(profile?.lokasi) || bersih(meta?.lokasi),
    departemen: bersih(profile?.departemen) || bersih(meta?.departemen),
  };
}
