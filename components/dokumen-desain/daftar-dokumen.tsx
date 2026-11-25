"use client";

import Link from "next/link";
import { FilePen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DOKUMEN_STATUS_META, normalizeDokumenStatus } from "@/lib/dokumen-desain";
import { cn } from "@/lib/utils";

export type TampilanDokumen = "kartu" | "daftar";

export interface DokumenRow {
  id: string;
  created_at: string;
  no_dokumen: string;
  no_dokumen_sub: string | null;
  project_design: string;
  tipe_design: string;
  deskripsi: string;
  status: string;
  revisi: number;
  created_by: string;
  created_by_name: string;
  permintaan_judul: string;
  hasil_files: { name: string; url: string }[] | null;
  ttd_total: number;
  ttd_selesai: number;
  perlu_ttd_saya: boolean;
}

const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

const judul = (r: DokumenRow) => `${r.project_design} — ${r.tipe_design}`;

const nomor = (r: DokumenRow) =>
  [r.no_dokumen, r.no_dokumen_sub, r.revisi > 0 && `Rev. ${r.revisi}`].filter(Boolean).join(" · ");

/** Gambar absolute supaya rasio gambar tidak pernah mengubah ukuran wadahnya. */
function Thumbnail({ r, className }: { r: DokumenRow; className?: string }) {
  const gambar = r.hasil_files?.[0];
  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-muted", className)}>
      {gambar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gambar.url}
          alt={gambar.name}
          className="absolute inset-0 h-full w-full object-contain"
          loading="lazy"
        />
      ) : (
        <FilePen className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground/50" />
      )}
    </div>
  );
}

function StatusBadge({ r }: { r: DokumenRow }) {
  const meta = DOKUMEN_STATUS_META[normalizeDokumenStatus(r.status)];
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", meta.badgeClass)}>
      {meta.label}
    </Badge>
  );
}

function ProgresTtd({ r }: { r: DokumenRow }) {
  const ditolak = normalizeDokumenStatus(r.status) === "DITOLAK";
  const persen = r.ttd_total ? Math.round((r.ttd_selesai / r.ttd_total) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", ditolak ? "bg-rose-500" : "bg-emerald-500")}
        style={{ width: `${ditolak ? 100 : persen}%` }}
      />
    </div>
  );
}

function KartuDokumen({ r }: { r: DokumenRow }) {
  const jumlahLain = (r.hasil_files?.length ?? 0) - 1;
  return (
    <Link
      href={`/dokumen-desain/${r.id}`}
      className={cn(
        "group flex h-72 min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition hover:border-primary/40 hover:shadow-md",
        r.perlu_ttd_saya && "border-primary/50 ring-1 ring-primary/20",
      )}
    >
      <div className="relative shrink-0">
        <Thumbnail r={r} className="h-36 w-full" />
        {/* Alas solid: warna status transparan sulit dibaca di atas gambar */}
        <span className="absolute left-2 top-2 inline-flex rounded-md bg-background">
          <StatusBadge r={r} />
        </span>
        {r.perlu_ttd_saya && <Badge className="absolute bottom-2 left-2">Perlu TTD Anda</Badge>}
        {jumlahLain > 0 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
            +{jumlahLain}
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 border-t p-3">
        <div className="truncate font-mono text-xs text-muted-foreground" title={nomor(r)}>
          {nomor(r)}
        </div>
        <div className="truncate text-sm font-semibold group-hover:text-primary" title={judul(r)}>
          {judul(r)}
        </div>
        <div className="truncate text-xs text-muted-foreground" title={r.permintaan_judul}>
          {r.permintaan_judul}
        </div>
        <div className="mt-auto space-y-1">
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">
              TTD {r.ttd_selesai}/{r.ttd_total}
            </span>
            <span className="truncate" title={r.created_by_name}>
              {r.created_by_name}
            </span>
            <span className="shrink-0">{fmtTanggal(r.created_at)}</span>
          </div>
          <ProgresTtd r={r} />
        </div>
      </div>
    </Link>
  );
}

function BarisDokumen({ r }: { r: DokumenRow }) {
  return (
    <li>
      <Link
        href={`/dokumen-desain/${r.id}`}
        className={cn(
          "group flex h-20 items-center gap-3 px-3 transition-colors hover:bg-muted/50",
          r.perlu_ttd_saya && "bg-primary/5",
        )}
      >
        <Thumbnail r={r} className="h-12 w-16 rounded border" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold group-hover:text-primary" title={judul(r)}>
            {judul(r)}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{nomor(r)}</span> · {r.permintaan_judul}
          </div>
          <div className="truncate text-xs text-muted-foreground lg:hidden">
            TTD {r.ttd_selesai}/{r.ttd_total} · {r.created_by_name} · {fmtTanggal(r.created_at)}
          </div>
        </div>
        <div className="hidden w-40 shrink-0 text-xs text-muted-foreground lg:block">
          <div className="truncate" title={r.created_by_name}>
            {r.created_by_name}
          </div>
          <div>{fmtTanggal(r.created_at)}</div>
        </div>
        <div className="hidden w-24 shrink-0 space-y-1 lg:block">
          <div className="text-xs text-muted-foreground">
            TTD {r.ttd_selesai}/{r.ttd_total}
          </div>
          <ProgresTtd r={r} />
        </div>
        <div className="flex w-32 shrink-0 flex-col items-end gap-1">
          <StatusBadge r={r} />
          {r.perlu_ttd_saya && <span className="text-xs font-medium text-primary">Perlu TTD Anda</span>}
        </div>
      </Link>
    </li>
  );
}

/** Daftar Dokumen Form Desain sebagai kartu berukuran tetap atau baris ringkas. */
export function DaftarDokumen({ rows, tampilan }: { rows: DokumenRow[]; tampilan: TampilanDokumen }) {
  if (tampilan === "daftar") {
    return (
      <ul className="divide-y overflow-hidden rounded-lg border">
        {rows.map((r) => (
          <BarisDokumen key={r.id} r={r} />
        ))}
      </ul>
    );
  }
  // auto-fill (bukan auto-fit): kartu tidak melebar saat dokumennya sedikit
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-4">
      {rows.map((r) => (
        <KartuDokumen key={r.id} r={r} />
      ))}
    </div>
  );
}
