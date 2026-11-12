"use client";

import { useEffect, useRef, useState } from "react";

const LEBAR_A4 = 794;

/** Perkecil lembar A4 (794px) agar pas dengan lebar wadah, tanpa scroll horizontal. */
export function SkalaLembar({ children }: { children: React.ReactNode }) {
  const wadah = useRef<HTMLDivElement>(null);
  const isi = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(1);
  const [tinggi, setTinggi] = useState<number | null>(null);

  useEffect(() => {
    const w = wadah.current;
    const el = isi.current;
    if (!w || !el) return;
    const ukur = () => {
      const s = Math.min(1, w.clientWidth / LEBAR_A4);
      setSkala(s);
      setTinggi(el.offsetHeight * s);
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(w);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wadah} className="w-full overflow-hidden" style={{ height: tinggi ?? undefined }}>
      <div
        ref={isi}
        style={{ width: LEBAR_A4, transform: `scale(${skala})`, transformOrigin: "top left" }}
        className={skala >= 1 ? "mx-auto" : undefined}
      >
        {children}
      </div>
    </div>
  );
}
