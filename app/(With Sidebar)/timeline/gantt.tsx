"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { AlertTriangle, CalendarX2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPROVAL_BADGE, BULAN, STATUS_OPTIONS, fmtTgl, hariIni, parseTgl, rentangBar, selisihHari, statusStyle, terlambat, tglPendek,
  type TimelineDesain, type TimelinePostTopic,
} from "@/lib/timeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type GanttHandle = { scrollKeHariIni: () => void };

const ROW_H = 52;

interface Props {
  tahun: number;
  rows: TimelineDesain[];
  postById: Map<string, TimelinePostTopic>;
  /** lebar satu hari (px) */
  dayW: number;
  onEdit: (r: TimelineDesain) => void;
  onStatus: (r: TimelineDesain, status: string) => void;
}

/**
 * Gantt satu tahun: kolom data di kiri (sticky), deretan hari di kanan.
 * Bar dihitung dari Date → Due Date, jadi otomatis ikut berubah saat data kiri diubah.
 */
export const Gantt = forwardRef<GanttHandle, Props>(function Gantt({ tahun, rows, postById, dayW, onEdit, onStatus }, ref) {
  const scroller = useRef<HTMLDivElement>(null);
  const awal = `${tahun}-01-01`;
  const akhir = `${tahun}-12-31`;
  const totalHari = selisihHari(awal, akhir) + 1;
  const lebar = totalHari * dayW;
  const today = hariIni();
  const todayIdx = today >= awal && today <= akhir ? selisihHari(awal, today) : -1;

  const bulan = useMemo(
    () =>
      BULAN.map((nama, m) => {
        const n = new Date(tahun, m + 1, 0).getDate();
        return { nama, n, mulai: selisihHari(awal, fmtTgl(new Date(tahun, m, 1))) };
      }),
    [tahun, awal],
  );

  const hari = useMemo(
    () =>
      Array.from({ length: totalHari }, (_, i) => {
        const d = parseTgl(awal)!;
        d.setDate(d.getDate() + i);
        return { tgl: d.getDate(), dow: d.getDay() };
      }),
    [awal, totalHari],
  );

  // Latar akhir pekan & garis hari murni CSS (tanpa ribuan elemen per baris)
  const sabtuPertama = (6 - parseTgl(awal)!.getDay() + 7) % 7;
  // Tile 7 hari: Sabtu+Minggu di awal tile, lalu tile digeser ke Sabtu pertama tahun ini.
  const latar: React.CSSProperties = {
    width: lebar,
    backgroundImage: [
      `linear-gradient(90deg, var(--gantt-weekend) 0 ${2 * dayW}px, transparent ${2 * dayW}px)`,
      dayW >= 12 ? `linear-gradient(90deg, transparent 0 ${dayW - 1}px, var(--gantt-line) ${dayW - 1}px)` : "linear-gradient(transparent, transparent)",
    ].join(","),
    backgroundSize: `${7 * dayW}px 100%, ${dayW}px 100%`,
    backgroundPosition: `${sabtuPertama * dayW}px 0, 0 0`,
    backgroundRepeat: "repeat-x",
  };

  useImperativeHandle(ref, () => ({
    scrollKeHariIni() {
      const el = scroller.current;
      if (!el || todayIdx < 0) return;
      el.scrollTo({ left: Math.max(0, todayIdx * dayW - el.clientWidth / 3), behavior: "smooth" });
    },
  }));

  const tampilAngka = dayW >= 18;

  return (
    <div
      ref={scroller}
      className={cn(
        "relative overflow-auto max-h-[70vh] rounded-b-2xl",
        "[--left-w:200px] md:[--left-w:420px]",
        "[--gantt-weekend:color-mix(in_oklab,var(--color-rose-500)_7%,transparent)] [--gantt-line:color-mix(in_oklab,var(--border)_70%,transparent)]",
      )}
    >
      <div className="relative min-w-max" style={{ width: `calc(var(--left-w) + ${lebar}px)` }}>
        {/* ------------------------------------------------ header (sticky) */}
        <div className="sticky top-0 z-30 flex bg-muted/95 backdrop-blur border-b">
          <div className="sticky left-0 z-40 w-[var(--left-w)] shrink-0 border-r bg-muted flex items-end">
            <div className="grid w-full grid-cols-[36px_1fr] md:grid-cols-[36px_1fr_118px_92px] items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>No</span>
              <span>Design / Project</span>
              <span className="hidden md:block">Status</span>
              <span className="hidden md:block">Due Date</span>
            </div>
          </div>
          <div style={{ width: lebar }} className="shrink-0">
            <div className="flex h-7 border-b">
              {bulan.map((b) => (
                <div
                  key={b.nama}
                  style={{ width: b.n * dayW }}
                  className="shrink-0 border-l first:border-l-0 px-2 text-xs font-semibold leading-7 truncate"
                >
                  {dayW * b.n >= 70 ? `${b.nama} ${tahun}` : b.nama.slice(0, 3)}
                </div>
              ))}
            </div>
            <div className="flex h-6">
              {hari.map((h, i) => {
                const weekend = h.dow === 0 || h.dow === 6;
                const isToday = i === todayIdx;
                const label = tampilAngka || (dayW >= 8 && h.dow === 1) ? h.tgl : "";
                return (
                  <div
                    key={i}
                    style={{ width: dayW }}
                    className={cn(
                      "shrink-0 text-center text-[10px] leading-6 tabular-nums",
                      weekend ? "text-rose-500" : "text-muted-foreground",
                      isToday && "bg-rose-500 text-white font-bold rounded-sm",
                      h.tgl === 1 && "border-l",
                    )}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ body */}
        <div className="relative">
          {/* Lapisan latar: akhir pekan, batas bulan, hari ini */}
          <div className="pointer-events-none absolute inset-y-0 left-[var(--left-w)]" style={latar}>
            {bulan.slice(1).map((b) => (
              <div key={b.nama} className="absolute inset-y-0 w-px bg-border" style={{ left: b.mulai * dayW }} />
            ))}
            {todayIdx >= 0 && (
              <div className="absolute inset-y-0 w-0.5 bg-rose-500/70 z-10" style={{ left: todayIdx * dayW + dayW / 2 - 1 }} />
            )}
          </div>

          {rows.map((r, i) => {
            const bar = rentangBar(r);
            const telat = terlambat(r, today);
            const post = r.post_topic_id ? postById.get(r.post_topic_id) : undefined;
            const gaya = statusStyle(r.status);

            let barEl: React.ReactNode = null;
            if (bar && bar.akhir >= awal && bar.mulai <= akhir) {
              const potongKiri = bar.mulai < awal;
              const potongKanan = bar.akhir > akhir;
              const s = selisihHari(awal, potongKiri ? awal : bar.mulai);
              const e = selisihHari(awal, potongKanan ? akhir : bar.akhir);
              const w = (e - s + 1) * dayW;
              const durasi = selisihHari(bar.mulai, bar.akhir) + 1;
              const judul = r.type_of_project || r.design;
              const labelDalam = w >= 90;
              barEl = (
                <button
                  type="button"
                  onClick={() => onEdit(r)}
                  title={`${judul}\n${tglPendek(bar.mulai)} → ${tglPendek(bar.akhir)} (${durasi} hari)\nStatus: ${r.status}${r.approval_status ? ` • ${r.approval_status}` : ""}${telat ? "\nMelewati Due Date" : ""}`}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 h-7 flex items-center text-left shadow-sm transition hover:brightness-110 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    gaya.bar,
                    potongKiri ? "rounded-l-none" : "rounded-l-md",
                    potongKanan ? "rounded-r-none" : "rounded-r-md",
                    telat && "ring-2 ring-rose-500 ring-offset-1 ring-offset-background",
                  )}
                  style={{ left: s * dayW, width: Math.max(w, 6) }}
                >
                  {labelDalam && <span className="truncate px-2 text-[11px] font-semibold text-white">{judul}</span>}
                  {!labelDalam && (
                    <span className="absolute left-full ml-1.5 whitespace-nowrap text-[11px] font-medium text-foreground/80">{judul}</span>
                  )}
                </button>
              );
            }

            const hariH = post && post.post_date >= awal && post.post_date <= akhir ? selisihHari(awal, post.post_date) : -1;

            return (
              <div key={r.id} className="group relative flex border-b hover:bg-muted/40" style={{ height: ROW_H }}>
                {/* Kolom kiri */}
                <div className="sticky left-0 z-20 w-[var(--left-w)] shrink-0 border-r bg-card group-hover:bg-muted">
                  <div className="grid h-full grid-cols-[36px_1fr] md:grid-cols-[36px_1fr_118px_92px] items-center gap-2 px-3">
                    <span className="text-xs tabular-nums text-muted-foreground">{r.no ?? i + 1}</span>
                    <button type="button" onClick={() => onEdit(r)} className="min-w-0 text-left">
                      <div className="truncate text-sm font-semibold leading-tight hover:text-primary">
                        {r.type_of_project || <span className="italic text-muted-foreground">Tanpa judul</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={cn("size-2 shrink-0 rounded-full md:hidden", gaya.dot)} />
                        <span className="truncate">{r.design}{r.layout_ukuran ? ` • ${r.layout_ukuran}` : ""}</span>
                        {r.approval_status && (
                          <span className={cn("shrink-0 rounded border px-1 text-[10px] font-medium leading-4", APPROVAL_BADGE[r.approval_status] ?? "")}>
                            {r.approval_status}
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="hidden md:block">
                      <Select value={r.status} onValueChange={(v) => onStatus(r, v)}>
                        <SelectTrigger size="sm" className={cn("h-7 w-full border text-xs font-medium", gaya.badge)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              <span className={cn("size-2 rounded-full", statusStyle(s).dot)} />
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="hidden md:block text-xs leading-tight">
                      <div className={cn("tabular-nums", telat && "font-semibold text-rose-600 dark:text-rose-400")}>
                        {r.due_date ? tglPendek(r.due_date) : "-"}
                      </div>
                      {telat && (
                        <div className="flex items-center gap-0.5 text-[10px] text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="size-3" /> Terlambat
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Track kanan */}
                <div className="relative shrink-0" style={{ width: lebar }}>
                  {barEl}
                  {!bar && (
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      className="sticky left-[calc(var(--left-w)+12px)] top-0 flex h-full items-center gap-1.5 text-xs italic text-muted-foreground hover:text-foreground"
                    >
                      <CalendarX2 className="size-3.5" /> Belum ada tanggal — klik untuk mengatur
                    </button>
                  )}
                  {hariH >= 0 && (
                    <div
                      title={`Hari H tayang: ${tglPendek(post!.post_date)}${post!.post_time ? ` pukul ${post!.post_time}` : ""}`}
                      className="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                      style={{ left: hariH * dayW + dayW / 2 }}
                    >
                      <div className="size-3 rotate-45 rounded-[2px] border-2 border-background bg-rose-500 shadow" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
