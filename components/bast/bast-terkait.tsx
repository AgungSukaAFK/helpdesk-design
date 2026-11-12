"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BAST_STATUS_META, normalizeBastStatus, tanggalSingkat } from "@/lib/bast";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  no_dokumen: string;
  jenis_nama: string;
  tanggal: string;
  judul_barang: string;
  jumlah_item: number;
  penerima_instansi: string;
  penerima_nama: string | null;
  status: string;
  perlu_aksi_saya: boolean;
}

/** BAST yang dikaitkan ke satu permintaan, untuk halaman detail permintaan. */
export function BastTerkait({ permintaanId, bolehBuat }: { permintaanId: string; bolehBuat: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`/api/bast?permintaan_id=${encodeURIComponent(permintaanId)}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setRows(json.data ?? []))
      .catch(() => setRows([]));
  }, [permintaanId]);

  if (!bolehBuat && (!rows || rows.length === 0)) return null;
  const diterima = rows?.some((r) => normalizeBastStatus(r.status) === "DITERIMA");

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border bg-card p-4 shadow-sm",
        diterima && "border-sky-500/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <PackageCheck className={cn("h-4 w-4", diterima && "text-sky-600 dark:text-sky-400")} /> BAST / Serah Terima
          {diterima && (
            <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 font-normal text-sky-700 dark:text-sky-300">
              Dilengkapi BAST
            </Badge>
          )}
        </h3>
        {bolehBuat && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/bast/buat?permintaan=${permintaanId}`}>
              <Plus className="mr-1 h-3 w-3" /> Buat BAST
            </Link>
          </Button>
        )}
      </div>
      {rows === null ? (
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada BAST. Buat bila hasil desain berupa barang fisik yang diserahkan ke site/departemen.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => {
            const st = normalizeBastStatus(r.status);
            return (
              <li key={r.id}>
                <Link href={`/bast/${r.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {r.jenis_nama} → {r.penerima_instansi}
                      {r.penerima_nama && <span className="font-normal text-muted-foreground"> · {r.penerima_nama}</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {tanggalSingkat(r.tanggal)} · {r.jumlah_item} item · <span className="font-mono">{r.no_dokumen}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className={BAST_STATUS_META[st].badgeClass}>
                      {BAST_STATUS_META[st].label}
                    </Badge>
                    {r.perlu_aksi_saya && <span className="text-xs font-medium text-primary">Perlu aksi Anda</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
