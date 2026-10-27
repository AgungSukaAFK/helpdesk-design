import { flushSync } from "react-dom";

type Origin = { x: number; y: number };

type ViewTransitionOptions = {
  /** "reveal" = tampilan baru menyebar melingkar dari `origin`; "fade" = cross-fade singkat. */
  mode?: "reveal" | "fade";
  origin?: Origin;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

/** Titik tengah elemen yang diklik, untuk asal animasi "reveal". */
export function originFromEvent(e: { currentTarget: EventTarget | null; clientX?: number; clientY?: number }): Origin | undefined {
  const el = e.currentTarget as HTMLElement | null;
  if (el?.getBoundingClientRect) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (typeof e.clientX === "number" && typeof e.clientY === "number") return { x: e.clientX, y: e.clientY };
  return undefined;
}

/**
 * Jalankan perubahan tampilan (tema, aksen, font) dengan View Transitions API.
 * Browser tanpa dukungan atau user dengan prefers-reduced-motion → langsung berubah.
 */
export function runViewTransition(update: () => void, { mode = "fade", origin }: ViewTransitionOptions = {}) {
  if (typeof document === "undefined") return update();
  const doc = document as DocumentWithViewTransition;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduceMotion) return update();

  const root = document.documentElement;
  root.dataset.vt = mode;
  // flushSync supaya DOM sudah berubah saat browser mengambil snapshot tampilan baru.
  const transition = doc.startViewTransition(() => flushSync(update));

  if (mode === "reveal") {
    const { x, y } = origin ?? { x: window.innerWidth / 2, y: 0 };
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 450, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
  }

  transition.finished
    .catch(() => {})
    .finally(() => {
      delete root.dataset.vt;
    });
}
