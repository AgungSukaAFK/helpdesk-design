import type { UserResponse } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Cache user & profil yang sedang login (sisi browser).
 *
 * `auth.getUser()` selalu request ke server Auth Supabase, dan sebelumnya dipanggil
 * berkali-kali tiap halaman dibuka (layout, top bar, notifikasi, halaman). Di sini
 * request-nya dibagi: satu promise dipakai bersama sampai status login berubah.
 */

// Tak bertipe, sama seperti hasil query Supabase lain di project ini.
export type CurrentProfile = any;

let userPromise: Promise<UserResponse> | null = null;
let cachedUserId: string | null = null;
let profilePromise: Promise<CurrentProfile | null> | null = null;
let profileSnapshot: CurrentProfile | null | undefined;
let listening = false;

export function clearCurrentUserCache() {
  userPromise = null;
  cachedUserId = null;
  invalidateCurrentProfile();
}

/** Dipanggil setelah profil sendiri diubah supaya pembacaan berikutnya ambil data baru. */
export function invalidateCurrentProfile() {
  profilePromise = null;
  profileSnapshot = undefined;
}

function listenForChanges() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  createClient().auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      clearCurrentUserCache();
    } else if (event === "SIGNED_IN" && session?.user.id !== cachedUserId) {
      clearCurrentUserCache();
    } else if (event === "USER_UPDATED") {
      userPromise = null;
    }
  });
  // Halaman profil memancarkan event ini saat nama/foto berubah.
  window.addEventListener("profile-updated", invalidateCurrentProfile);
}

/** Pengganti `supabase.auth.getUser()` dengan bentuk hasil yang sama. */
export function getCurrentUser(): Promise<UserResponse> {
  listenForChanges();
  if (!userPromise) {
    const promise: Promise<UserResponse> = createClient()
      .auth.getUser()
      .then(
        (res) => {
          if (res.error || !res.data.user) {
            if (userPromise === promise) userPromise = null;
          } else {
            cachedUserId = res.data.user.id;
          }
          return res;
        },
        (err) => {
          if (userPromise === promise) userPromise = null;
          throw err;
        },
      );
    userPromise = promise;
  }
  return userPromise;
}

/** Baris `user_profiles` milik user yang login (semua kolom), atau null. */
export function getCurrentProfile(): Promise<CurrentProfile | null> {
  if (!profilePromise) {
    const promise = (async () => {
      const {
        data: { user },
      } = await getCurrentUser();
      if (!user) return null;
      const { data } = await createClient()
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      return (data as CurrentProfile | null) ?? null;
    })().catch(() => null);

    promise.then((profile) => {
      if (profilePromise !== promise) return;
      if (profile) profileSnapshot = profile;
      else profilePromise = null;
    });
    profilePromise = promise;
  }
  return profilePromise;
}

/** Profil yang sudah tersimpan di cache (undefined kalau belum pernah diambil). */
export function peekCurrentProfile() {
  return profileSnapshot;
}
