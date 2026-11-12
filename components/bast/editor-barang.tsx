"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, List, Plus, Table2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAKS_BARIS, MAKS_KOLOM_BARANG, parseDaftar, parseTempel, type ModeBarang } from "@/lib/bast";

export interface NilaiBarang {
  mode: ModeBarang;
  kolom: string[];
  items: string[][];
}

/**
 * Editor daftar barang BAST.
 * - Daftar: textarea, satu baris satu item; tempel kolom dari Excel/WA langsung jadi daftar.
 * - Tabel: kolom bebas. Tempel blok sel dari Excel/Sheets ke sel mana pun untuk mengisi
 *   mulai dari sel itu (baris/kolom ditambah otomatis); tempel di judul kolom = baris
 *   pertama jadi judul. Enter pindah ke baris berikutnya.
 */
export function EditorBarang({ value, onChange }: { value: NilaiBarang; onChange: (v: NilaiBarang) => void }) {
  const [teks, setTeks] = useState(() => value.items.map((r) => r[0] ?? "").join("\n"));
  const tabelRef = useRef<HTMLDivElement>(null);
  const fokusBerikut = useRef<{ r: number; c: number } | null>(null);

  // Sinkronkan textarea bila isi diganti dari luar (mis. ganti jenis/mode)
  const terakhirDariSini = useRef<string>("");
  useEffect(() => {
    if (value.mode !== "daftar") return;
    const gabung = value.items.map((r) => r[0] ?? "").join("\n");
    if (gabung !== terakhirDariSini.current) setTeks(gabung);
  }, [value]);

  useEffect(() => {
    const f = fokusBerikut.current;
    if (!f) return;
    fokusBerikut.current = null;
    tabelRef.current?.querySelector<HTMLInputElement>(`[data-sel="${f.r}:${f.c}"]`)?.focus();
  });

  const gantiMode = (mode: ModeBarang) => {
    if (mode === value.mode) return;
    if (mode === "tabel") {
      const kolom = value.kolom.length ? value.kolom : ["Nama Barang"];
      const items = value.items.map((r) => [r[0] ?? "", ...kolom.slice(1).map(() => "")]);
      onChange({ mode, kolom, items: items.length ? items : [kolom.map(() => "")] });
    } else {
      const items = value.items.map((r) => [r.filter(Boolean).join(" - ")]).filter((r) => r[0]);
      terakhirDariSini.current = "";
      onChange({ mode, kolom: value.kolom, items });
    }
  };

  // ===== Mode daftar =====
  const ubahTeks = (t: string) => {
    setTeks(t);
    const items = parseDaftar(t).slice(0, MAKS_BARIS).map((v) => [v]);
    terakhirDariSini.current = items.map((r) => r[0]).join("\n");
    onChange({ ...value, items });
  };

  // ===== Mode tabel =====
  const kolom = value.kolom;
  const baris = value.items;

  const setTabel = (k: string[], b: string[][]) =>
    onChange({ mode: "tabel", kolom: k, items: b.map((r) => k.map((_, i) => r[i] ?? "")) });

  const ubahSel = (r: number, c: number, v: string) =>
    setTabel(kolom, baris.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));

  const ubahKolom = (c: number, v: string) => setTabel(kolom.map((k, j) => (j === c ? v : k)), baris);

  const tambahKolom = () => {
    if (kolom.length >= MAKS_KOLOM_BARANG) return;
    setTabel([...kolom, `Kolom ${kolom.length + 1}`], baris);
    fokusBerikut.current = { r: -1, c: kolom.length };
  };

  const hapusKolom = (c: number) => {
    if (kolom.length <= 1) return;
    setTabel(kolom.filter((_, j) => j !== c), baris.map((r) => r.filter((_, j) => j !== c)));
  };

  const tambahBaris = (fokus = true) => {
    if (baris.length >= MAKS_BARIS) return;
    setTabel(kolom, [...baris, kolom.map(() => "")]);
    if (fokus) fokusBerikut.current = { r: baris.length, c: 0 };
  };

  const hapusBaris = (r: number) => {
    const sisa = baris.filter((_, i) => i !== r);
    setTabel(kolom, sisa.length ? sisa : [kolom.map(() => "")]);
  };

  /** Tempel blok TSV mulai dari sel (r, c); r = -1 berarti dari baris judul kolom. */
  const tempel = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const raw = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(raw.replace(/\n$/, ""))) return; // satu sel biasa: biarkan default
    e.preventDefault();
    let grid = parseTempel(raw);
    if (grid.length === 0) return;

    const lebar = Math.min(MAKS_KOLOM_BARANG, Math.max(kolom.length, c + Math.max(...grid.map((g) => g.length))));
    const k = [...kolom];
    while (k.length < lebar) k.push(`Kolom ${k.length + 1}`);

    let basis = baris;
    if (r === -1) {
      grid[0].forEach((v, j) => {
        if (c + j < lebar && v) k[c + j] = v;
      });
      grid = grid.slice(1);
      r = 0;
      // Isi lama yang masih kosong semua diganti tempelan, bukan ditambah di bawahnya
      if (baris.every((row) => row.every((x) => !x))) basis = [];
    }

    const b = basis.map((row) => k.map((_, j) => row[j] ?? ""));
    grid.forEach((g, i) => {
      const ri = r + i;
      if (ri >= MAKS_BARIS) return;
      while (b.length <= ri) b.push(k.map(() => ""));
      g.forEach((v, j) => {
        if (c + j < lebar) b[ri][c + j] = v;
      });
    });
    setTabel(k, b.length ? b : [k.map(() => "")]);
  };

  const enter = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (r === baris.length - 1) {
      if (baris.length >= MAKS_BARIS) return;
      tambahBaris(false);
      fokusBerikut.current = { r: r + 1, c }; // difokuskan setelah baris baru dirender
    } else {
      tabelRef.current?.querySelector<HTMLInputElement>(`[data-sel="${r + 1}:${c}"]`)?.focus();
    }
  };

  const terisi = value.items.filter((r) => r.some(Boolean)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          {(
            [
              ["daftar", List, "Daftar"],
              ["tabel", Table2, "Tabel"],
            ] as const
          ).map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => gantiMode(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
                value.mode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{terisi} item</span>
      </div>

      {value.mode === "daftar" ? (
        <div className="space-y-1.5">
          <Textarea
            rows={Math.min(16, Math.max(6, teks.split("\n").length + 1))}
            value={teks}
            onChange={(e) => ubahTeks(e.target.value)}
            placeholder={"Muhammad Nur S\nArjuna Yanuar\nAdi Subiantoro\n..."}
            className="font-mono text-sm"
          />
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ClipboardPaste className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Satu baris satu item. Bisa langsung tempel satu kolom dari Excel atau daftar dari WA; nomor di depan
            (&quot;1.&quot;, &quot;2)&quot;) dibuang otomatis karena penomoran dibuat sendiri.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div ref={tabelRef} className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="w-10 px-2 text-center text-xs font-medium text-muted-foreground">No</th>
                  {kolom.map((k, c) => (
                    <th key={c} className="min-w-[140px] border-l p-1">
                      <div className="flex items-center gap-1">
                        <Input
                          data-sel={`-1:${c}`}
                          value={k}
                          onChange={(e) => ubahKolom(c, e.target.value)}
                          onPaste={(e) => tempel(e, -1, c)}
                          className="h-8 font-semibold"
                          aria-label={`Judul kolom ${c + 1}`}
                        />
                        {kolom.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            onClick={() => hapusKolom(c)}
                            title="Hapus kolom"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-10 border-l p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={tambahKolom}
                      disabled={kolom.length >= MAKS_KOLOM_BARANG}
                      title="Tambah kolom"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {baris.map((row, r) => (
                  <tr key={r} className="border-t">
                    <td className="px-2 text-center font-mono text-xs text-muted-foreground">{r + 1}</td>
                    {kolom.map((_, c) => (
                      <td key={c} className="border-l p-1">
                        <Input
                          data-sel={`${r}:${c}`}
                          value={row[c] ?? ""}
                          onChange={(e) => ubahSel(r, c, e.target.value)}
                          onPaste={(e) => tempel(e, r, c)}
                          onKeyDown={(e) => enter(e, r, c)}
                          className="h-8 border-transparent bg-transparent shadow-none focus-visible:border-input"
                        />
                      </td>
                    ))}
                    <td className="border-l p-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => hapusBaris(r)}
                        title="Hapus baris"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="flex max-w-xl items-start gap-1.5 text-xs text-muted-foreground">
              <ClipboardPaste className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Copy blok sel dari Excel/Sheets lalu tempel (Ctrl+V) di sel mana pun; baris &amp; kolom bertambah otomatis.
              Tempel di judul kolom bila baris pertama tempelan adalah judul.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setTabel(kolom, [kolom.map(() => "")])}>
                Kosongkan
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => tambahBaris()}>
                <Plus className="mr-1 h-4 w-4" /> Baris
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
