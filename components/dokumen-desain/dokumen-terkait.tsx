"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DOKUMEN_STATUS_META, normalizeDokumenStatus } from "@/lib/dokumen-desain";

interface Row {
  id: string;
  no_dokumen: string;
  project_design: string;
  tipe_design: string;
  status: string;
  ttd_total: number;
  ttd_selesai: number;
  perlu_ttd_saya: boolean;
}

/** Daftar Dokumen Form Desain milik satu permintaan, untuk halaman detail permintaan. */
export function DokumenTerkait({ permintaanId, bolehBuat }: { permintaanId: string; bolehBuat: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`/api/dokumen-desain?permintaan_id=${encodeURIComponent(permintaanId)}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setRows(json.data ?? []))
      .catch(() => setRows([]));
  }, [permintaanId]);

  if (!bolehBuat && (!rows || rows.length === 0)) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <FilePen className="h-4 w-4" /> Dokumen Form Desain
        </h3>
        {bolehBuat && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dokumen-desain/buat?permintaan=${permintaanId}`}>
              <Plus className="mr-1 h-3 w-3" /> Buat Dokumen
            </Link>
          </Button>
        )}
      </div>
      {rows === null ? (
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada dokumen. Buat dokumen untuk meminta tanda tangan pengesahan hasil desain.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => {
            const st = normalizeDokumenStatus(r.status);
            return (
              <li key={r.id}>
                <Link
                  href={`/dokumen-desain/${r.id}`}
                  className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {r.project_design} — {r.tipe_design}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {r.no_dokumen} · TTD {r.ttd_selesai}/{r.ttd_total}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className={DOKUMEN_STATUS_META[st].badgeClass}>
                      {DOKUMEN_STATUS_META[st].label}
                    </Badge>
                    {r.perlu_ttd_saya && <span className="text-xs font-medium text-primary">Perlu TTD Anda</span>}
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
