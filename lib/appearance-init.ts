import {
  ACCENT_STORAGE_KEY,
  BASE_ACCENT,
  DEFAULT_ACCENT,
  LEGACY_ACCENT_MAP,
  LEGACY_ACCENT_STORAGE_KEY,
  RADIUS_STORAGE_KEY,
  accentThemes,
  radiusOptions,
} from "@/lib/accent-options";
import {
  FONT_FAMILY_STORAGE_KEY,
  FONT_SIZE_STORAGE_KEY,
  fontFamilies,
  fontSizes,
} from "@/lib/font-options";

const j = JSON.stringify;

// Dijalankan inline di <head> sebelum hydrate, supaya tidak ada kedipan
// aksen/font/ukuran/radius default saat halaman pertama dimuat.
export const appearanceInitScript = `(function(){try{var d=document.documentElement,ls=localStorage;var a=ls.getItem(${j(
  ACCENT_STORAGE_KEY,
)});if(!a){var o=ls.getItem(${j(LEGACY_ACCENT_STORAGE_KEY)});a=(o&&${j(LEGACY_ACCENT_MAP)}[o])||${j(
  DEFAULT_ACCENT,
)};}if(${j(accentThemes.map((t) => t.name))}.indexOf(a)<0)a=${j(DEFAULT_ACCENT)};if(a!==${j(
  BASE_ACCENT,
)})d.classList.add("theme-"+a);var f=ls.getItem(${j(FONT_FAMILY_STORAGE_KEY)});if(f&&${j(
  fontFamilies.map((f) => f.name),
)}.indexOf(f)>-1)d.dataset.font=f;var s=ls.getItem(${j(FONT_SIZE_STORAGE_KEY)});if(s&&${j(
  fontSizes.map((s) => s.name),
)}.indexOf(s)>-1)d.dataset.fontSize=s;var r=ls.getItem(${j(RADIUS_STORAGE_KEY)});if(r&&r!=="default"&&${j(
  radiusOptions.map((r) => r.name),
)}.indexOf(r)>-1)d.dataset.radius=r;}catch(e){}})();`;
