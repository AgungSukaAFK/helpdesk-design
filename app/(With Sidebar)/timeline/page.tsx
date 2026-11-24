"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarDays, CalendarPlus, CrosshairIcon, Database, Download, FileUp, GanttChart, Link2, Loader2, Megaphone,
  Pencil, Plus, Search, ShieldAlert, Trash2, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import { DropHint, PageFileDrop } from "@/components/file-drop";
import { Mounted } from "@/components/mounted";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  APPROVAL_BADGE, BULAN, DESIGN_OPTIONS, STATUS_OPTIONS, hariIni, jadwalDariHariH, namaHari, parseTgl, rentangBar, selisihHari,
  statusStyle, tambahHari, terlambat, tglPendek, type TimelineDesain, type TimelinePostTopic,
} from "@/lib/timeline";
import type { HasilImport } from "@/lib/timeline-excel";
import { Gantt, type GanttHandle } from "./gantt";
import { DesainDialog, PostDialog, type DesainForm, type PostForm, type PostOpsi } from "./dialogs";

const ZOOM = { hari: 30, minggu: 14, bulan: 5 } as const;
type Zoom = keyof typeof ZOOM;

const normJudul = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const tahunDari = (s: string | null | undefined) => parseTgl(s)?.getFullYear();

function adaDiTahun(r: TimelineDesain, tahun: number) {
  const bar = rentangBar(r);
  if (!bar) return true; // belum dijadwalkan: tetap tampil supaya bisa diatur
  return bar.mulai <= `${tahun}-12-31` && bar.akhir >= `${tahun}-01-01`;
}

export default function TimelinePage() {
  const supabase = useMemo(() => createClient(), []);
  const gantt = useRef<GanttHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [desain, setDesain] = useState<TimelineDesain[]>([]);
  const [posts, setPosts] = useState<TimelinePostTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [tab, setTab] = useState<"desain" | "post">("desain");
  const [tahun, setTahun] = useState(() => new Date().getFullYear());
  const [zoom, setZoom] = useState<Zoom>("minggu");
  const [cari, setCari] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fDesign, setFDesign] = useState("all");
  const [urut, setUrut] = useState<"tanggal" | "no">("tanggal");

  const [editDesain, setEditDesain] = useState<{ open: boolean; row: TimelineDesain | null }>({ open: false, row: null });
  const [editPost, setEditPost] = useState<{ open: boolean; row: TimelinePostTopic | null }>({ open: false, row: null });
  const [hapus, setHapus] = useState<{ jenis: "desain"; row: TimelineDesain } | { jenis: "post"; row: TimelinePostTopic } | null>(null);
  const [hapusTerkait, setHapusTerkait] = useState(true);

  const [impor, setImpor] = useState<{ nama: string; data: HasilImport } | null>(null);
  const [imporMode, setImporMode] = useState<"tambah" | "ganti">("tambah");
  const [imporAuto, setImporAuto] = useState(true);
  const [busy, setBusy] = useState(false);

  // ------------------------------------------------------------------ data --
  const muat = useCallback(async () => {
    const [d, p] = await Promise.all([
      supabase.from("timeline_desain").select("*").order("no", { ascending: true, nullsFirst: false }),
      supabase.from("timeline_post_topic").select("*").order("post_date", { ascending: true }),
    ]);
    const err = d.error ?? p.error;
    if (err) {
      const missing = /does not exist|schema cache|column/i.test(err.message);
      setDbError(missing ? "Tabel/kolom timeline belum ada di database." : err.message);
    } else {
      setDbError(null);
      setDesain((d.data ?? []) as TimelineDesain[]);
      setPosts((p.data ?? []) as TimelinePostTopic[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    getCurrentProfile().then((p) => setRole(p?.role ?? null)).catch(() => setRole(null));
    muat();
  }, [muat]);

  const postById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const desainByPost = useMemo(() => {
    const m = new Map<string, TimelineDesain>();
    for (const d of desain) if (d.post_topic_id) m.set(d.post_topic_id, d);
    return m;
  }, [desain]);

  const daftarTahun = useMemo(() => {
    const s = new Set<number>([new Date().getFullYear(), tahun]);
    for (const d of desain) [tahunDari(d.date), tahunDari(d.due_date)].forEach((y) => y && s.add(y));
    for (const p of posts) { const y = tahunDari(p.post_date); if (y) s.add(y); }
    return [...s].sort((a, b) => a - b);
  }, [desain, posts, tahun]);

  const desainTahun = useMemo(() => desain.filter((r) => adaDiTahun(r, tahun)), [desain, tahun]);

  const barisGantt = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const rows = desainTahun.filter((r) => {
      if (fStatus === "telat" ? !terlambat(r) : fStatus !== "all" && r.status !== fStatus) return false;
      if (fDesign !== "all" && r.design !== fDesign) return false;
      if (q && ![r.type_of_project, r.design, r.layout_ukuran, r.approval_status].some((v) => v?.toLowerCase().includes(q))) return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (urut === "no") return (a.no ?? 1e9) - (b.no ?? 1e9);
      const ka = rentangBar(a)?.mulai ?? "9999";
      const kb = rentangBar(b)?.mulai ?? "9999";
      return ka.localeCompare(kb) || (a.no ?? 0) - (b.no ?? 0);
    });
  }, [desainTahun, cari, fStatus, fDesign, urut]);

  const ringkas = useMemo(() => {
    const per: Record<string, number> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s, 0]));
    let telat = 0;
    for (const r of desainTahun) {
      per[r.status] = (per[r.status] ?? 0) + 1;
      if (terlambat(r)) telat++;
    }
    return { per, telat, total: desainTahun.length };
  }, [desainTahun]);

  const postTahun = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return posts
      .filter((p) => tahunDari(p.post_date) === tahun)
      .filter((p) => !q || [p.project_name, p.post_topic, p.design].some((v) => v?.toLowerCase().includes(q)));
  }, [posts, tahun, cari]);

  // Gulir ke hari ini saat pertama tampil di tahun berjalan
  const sudahGulir = useRef(false);
  useEffect(() => {
    if (loading || sudahGulir.current || tab !== "desain") return;
    sudahGulir.current = true;
    requestAnimationFrame(() => gantt.current?.scrollKeHariIni());
  }, [loading, tab]);

  // ------------------------------------------------------------- simpan --
  const nomorBerikut = (rows: { no: number | null }[]) => rows.reduce((m, r) => Math.max(m, r.no ?? 0), 0) + 1;

  const simpanDesain = async (data: DesainForm) => {
    const row = editDesain.row;
    const res = row
      ? await supabase.from("timeline_desain").update(data).eq("id", row.id).select().single()
      : await supabase.from("timeline_desain").insert({ ...data, no: nomorBerikut(desain) }).select().single();
    if (res.error) {
      toast.error(`Gagal menyimpan: ${res.error.message}`);
      return false;
    }
    const saved = res.data as TimelineDesain;
    setDesain((prev) => (row ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]));
    const y = tahunDari(saved.date ?? saved.due_date);
    if (!row && y && y !== tahun) setTahun(y);
    toast.success(row ? "Timeline desain diperbarui" : "Timeline desain ditambahkan");
    return true;
  };

  const ubahJadwal = async (r: TimelineDesain, jadwal: { date: string | null; due_date: string | null }) => {
    setDesain((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...jadwal } : x)));
    const { error } = await supabase.from("timeline_desain").update(jadwal).eq("id", r.id);
    if (error) {
      toast.error(`Gagal mengubah tanggal: ${error.message}`);
      setDesain((prev) => prev.map((x) => (x.id === r.id ? { ...x, date: r.date, due_date: r.due_date } : x)));
    }
  };

  const ubahStatus = async (r: TimelineDesain, status: string) => {
    setDesain((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
    const { error } = await supabase.from("timeline_desain").update({ status }).eq("id", r.id);
    if (error) {
      toast.error(`Gagal mengubah status: ${error.message}`);
      setDesain((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: r.status } : x)));
    }
  };

  const desainDariPost = (p: TimelinePostTopic, no: number) => ({
    no,
    design: p.design,
    status: "Schedule",
    approval_status: null,
    type_of_project: p.project_name,
    layout_ukuran: null,
    visual_type: p.visual_type,
    visual_link: p.visual_link,
    asset_link: p.asset_link,
    post_topic_id: p.id,
    ...jadwalDariHariH(p.post_date),
  });

  const buatDesainUntuk = async (p: TimelinePostTopic) => {
    const { data, error } = await supabase.from("timeline_desain").insert(desainDariPost(p, nomorBerikut(desain))).select().single();
    if (error) return toast.error(`Gagal membuat timeline desain: ${error.message}`);
    setDesain((prev) => [...prev, data as TimelineDesain]);
    toast.success(`Timeline desain "${p.project_name}" dibuat`);
  };

  const simpanPost = async (data: PostForm, opsi: PostOpsi) => {
    const row = editPost.row;
    const res = row
      ? await supabase.from("timeline_post_topic").update(data).eq("id", row.id).select().single()
      : await supabase.from("timeline_post_topic").insert({ ...data, no: nomorBerikut(posts) }).select().single();
    if (res.error) {
      toast.error(`Gagal menyimpan: ${res.error.message}`);
      return false;
    }
    const saved = res.data as TimelinePostTopic;
    setPosts((prev) => (row ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]).sort((a, b) => a.post_date.localeCompare(b.post_date)));

    if (!row && opsi.buatDesain) await buatDesainUntuk(saved);

    const terkait = row ? desainByPost.get(row.id) : undefined;
    if (row && terkait) {
      const patch: Partial<TimelineDesain> = {};
      if (terkait.type_of_project === row.project_name) patch.type_of_project = saved.project_name;
      if (terkait.design === row.design) patch.design = saved.design;
      if (opsi.geserDesain && row.post_date !== saved.post_date) {
        const delta = selisihHari(row.post_date, saved.post_date);
        if (terkait.date) patch.date = tambahHari(terkait.date, delta);
        if (terkait.due_date) patch.due_date = tambahHari(terkait.due_date, delta);
      }
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("timeline_desain").update(patch).eq("id", terkait.id);
        if (error) toast.error(`Timeline desain terkait gagal disesuaikan: ${error.message}`);
        else setDesain((prev) => prev.map((d) => (d.id === terkait.id ? { ...d, ...patch } : d)));
      }
    }
    const y = tahunDari(saved.post_date);
    if (!row && y && y !== tahun) setTahun(y);
    toast.success(row ? "Post topic diperbarui" : "Post topic ditambahkan");
    return true;
  };

  const konfirmasiHapus = async () => {
    if (!hapus) return;
    if (hapus.jenis === "desain") {
      const { error } = await supabase.from("timeline_desain").delete().eq("id", hapus.row.id);
      if (error) return toast.error(`Gagal menghapus: ${error.message}`);
      setDesain((prev) => prev.filter((r) => r.id !== hapus.row.id));
    } else {
      const terkait = desainByPost.get(hapus.row.id);
      if (terkait && hapusTerkait) {
        const { error } = await supabase.from("timeline_desain").delete().eq("id", terkait.id);
        if (error) return toast.error(`Gagal menghapus timeline desain: ${error.message}`);
      }
      const { error } = await supabase.from("timeline_post_topic").delete().eq("id", hapus.row.id);
      if (error) return toast.error(`Gagal menghapus: ${error.message}`);
      setPosts((prev) => prev.filter((p) => p.id !== hapus.row.id));
      setDesain((prev) =>
        terkait && hapusTerkait
          ? prev.filter((d) => d.id !== terkait.id)
          : prev.map((d) => (d.post_topic_id === hapus.row.id ? { ...d, post_topic_id: null } : d)),
      );
    }
    toast.success("Data dihapus");
    setHapus(null);
  };

  // --------------------------------------------------------------- excel --
  const bacaFile = async (file?: File) => {
    if (!file) return;
    try {
      const { bacaFileTimeline } = await import("@/lib/timeline-excel");
      const data = await bacaFileTimeline(file);
      if (!data.posts.length && !data.desain.length) {
        toast.error("Tidak ada data terbaca. Pastikan memakai format sheet Timeline Post Topic / Timeline Desain.");
        return;
      }
      setImporMode("tambah");
      setImporAuto(true);
      setImpor({ nama: file.name, data });
    } catch (e) {
      toast.error(`File tidak bisa dibaca: ${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const jalankanImpor = async () => {
    if (!impor) return;
    setBusy(true);
    try {
      const ganti = imporMode === "ganti";
      if (ganti) {
        const nil = "00000000-0000-0000-0000-000000000000";
        const a = await supabase.from("timeline_desain").delete().neq("id", nil);
        if (a.error) throw a.error;
        const b = await supabase.from("timeline_post_topic").delete().neq("id", nil);
        if (b.error) throw b.error;
      }
      const lamaPost = ganti ? [] : posts;
      const lamaDesain = ganti ? [] : desain;

      // Post topic: lewati duplikat (tanggal + judul sama)
      const kunciPost = new Set(lamaPost.map((p) => `${p.post_date}|${normJudul(p.project_name)}`));
      let noPost = nomorBerikut(lamaPost);
      const postBaru = impor.data.posts
        .filter((p) => !kunciPost.has(`${p.post_date}|${normJudul(p.project_name)}`))
        .map((p) => ({ ...p, no: ganti && p.no ? p.no : noPost++ }));
      let postMasuk: TimelinePostTopic[] = [];
      if (postBaru.length) {
        const r = await supabase.from("timeline_post_topic").insert(postBaru).select();
        if (r.error) throw r.error;
        postMasuk = r.data as TimelinePostTopic[];
      }
      const semuaPost = [...lamaPost, ...postMasuk];

      // Desain: hubungkan ke post dengan judul sama, lewati duplikat (judul + due date)
      const kunciDesain = new Set(lamaDesain.map((d) => `${d.due_date}|${normJudul(d.type_of_project)}`));
      const terhubung = new Set(lamaDesain.map((d) => d.post_topic_id).filter(Boolean) as string[]);
      let noDesain = nomorBerikut(lamaDesain);
      const desainBaru: Record<string, unknown>[] = [];
      for (const d of impor.data.desain) {
        if (kunciDesain.has(`${d.due_date}|${normJudul(d.type_of_project)}`)) continue;
        const cocok = semuaPost.find((p) => !terhubung.has(p.id) && normJudul(p.project_name) === normJudul(d.type_of_project));
        if (cocok) terhubung.add(cocok.id);
        desainBaru.push({ ...d, no: ganti && d.no ? d.no : noDesain++, post_topic_id: cocok?.id ?? null });
      }
      if (imporAuto) {
        for (const p of postMasuk) if (!terhubung.has(p.id)) desainBaru.push(desainDariPost(p, noDesain++));
      }
      if (desainBaru.length) {
        const r = await supabase.from("timeline_desain").insert(desainBaru);
        if (r.error) throw r.error;
      }
      toast.success(`Import selesai: ${postMasuk.length} post topic, ${desainBaru.length} timeline desain.`);
      setImpor(null);
      await muat();
    } catch (e) {
      toast.error(`Import gagal: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const ekspor = async () => {
    setBusy(true);
    try {
      const { eksporTimeline } = await import("@/lib/timeline-excel");
      const urutTgl = [...desainTahun].sort((a, b) => (rentangBar(a)?.mulai ?? "9999").localeCompare(rentangBar(b)?.mulai ?? "9999"));
      const nama = await eksporTimeline({ tahun, desain: urutTgl, posts: posts.filter((p) => tahunDari(p.post_date) === tahun) });
      toast.success(`${nama} diunduh`);
    } catch (e) {
      toast.error(`Export gagal: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- render --
  if (role !== undefined && role !== "admin" && role !== "designer") {
    return (
      <div className="col-span-12 flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-12 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="font-semibold">Halaman ini khusus admin dan desainer.</p>
      </div>
    );
  }

  const imporRingkas = impor && (() => {
    const tahunImpor = [...new Set([
      ...impor.data.posts.map((p) => tahunDari(p.post_date)),
      ...impor.data.desain.map((d) => tahunDari(d.due_date ?? d.date)),
    ].filter(Boolean))].sort();
    return { tahunImpor };
  })();

  return (
    <div className="col-span-12 flex flex-col gap-5 min-w-0">
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => bacaFile(e.target.files?.[0])} />
      <PageFileDrop onFiles={(files) => bacaFile(files[0])} accept=".xlsx" disabled={!!dbError} label="Lepaskan file untuk import timeline" />

      {/* ------------------------------------------------ header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card border rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex items-center gap-2.5">
          <div className="size-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Timeline Creative Tim</h1>
            <p className="text-sm text-muted-foreground">
              Jadwal posting (hari H) dan timeline pengerjaan desain. Bar timeline mengikuti Date → Due Date.
            </p>
            <DropHint className="mt-1" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/70 p-1 rounded-xl border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">Tahun</span>
            <Mounted fallback={<div className="w-[96px] h-8 rounded-md border bg-background" />}>
              <Select value={String(tahun)} onValueChange={(v) => setTahun(Number(v))}>
                <SelectTrigger size="sm" className="w-[96px] bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {daftarTahun.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  <SelectItem value={String(Math.max(...daftarTahun) + 1)}>{Math.max(...daftarTahun) + 1}</SelectItem>
                </SelectContent>
              </Select>
            </Mounted>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!!dbError || busy}>
            <FileUp /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={ekspor} disabled={!!dbError || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />} Export Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditPost({ open: true, row: null })} disabled={!!dbError}>
            <Megaphone /> Post Topic
          </Button>
          <Button size="sm" onClick={() => setEditDesain({ open: true, row: null })} disabled={!!dbError}>
            <Plus /> Timeline Desain
          </Button>
        </div>
      </div>

      {dbError && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <Database className="size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">{dbError}</p>
            <p className="text-muted-foreground">
              Jalankan <code className="rounded bg-muted px-1">supabase/migrations/0035_timeline_desain.sql</code> lalu{" "}
              <code className="rounded bg-muted px-1">0036_timeline_post_topic.sql</code> di Supabase SQL Editor, kemudian muat ulang halaman.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ ringkasan */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label={`Desain ${tahun}`} value={ringkas.total} onClick={() => { setTab("desain"); setFStatus("all"); }} active={tab === "desain" && fStatus === "all"} />
        {STATUS_OPTIONS.map((s) => (
          <StatCard
            key={s}
            label={s}
            value={ringkas.per[s] ?? 0}
            dot={statusStyle(s).dot}
            onClick={() => { setTab("desain"); setFStatus(fStatus === s ? "all" : s); }}
            active={tab === "desain" && fStatus === s}
          />
        ))}
        <StatCard
          label="Terlambat"
          value={ringkas.telat}
          danger={ringkas.telat > 0}
          onClick={() => { setTab("desain"); setFStatus(fStatus === "telat" ? "all" : "telat"); }}
          active={tab === "desain" && fStatus === "telat"}
        />
      </div>

      {/* ------------------------------------------------ konten */}
      <div className="bg-card border rounded-2xl shadow-xs min-w-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b p-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "desain" | "post")}>
            <TabsList>
              <TabsTrigger value="desain"><GanttChart className="size-4" /> Timeline Desain</TabsTrigger>
              <TabsTrigger value="post"><Megaphone className="size-4" /> Post Topic ({postTahun.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari project…" className="h-8 w-48 pl-8 text-sm" />
            </div>
            {tab === "desain" && (
              <Mounted>
                <Select value={fDesign} onValueChange={setFDesign}>
                  <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua design</SelectItem>
                    {DESIGN_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={urut} onValueChange={(v) => setUrut(v as "tanggal" | "no")}>
                  <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tanggal">Urut tanggal</SelectItem>
                    <SelectItem value="no">Urut No.</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex rounded-md border p-0.5">
                  {(Object.keys(ZOOM) as Zoom[]).map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZoom(z)}
                      className={cn("rounded px-2.5 py-1 text-xs font-medium capitalize", zoom === z ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                      {z}
                    </button>
                  ))}
                </div>
                {tahun === new Date().getFullYear() && (
                  <Button size="sm" variant="outline" onClick={() => gantt.current?.scrollKeHariIni()}>
                    <CrosshairIcon /> Hari ini
                  </Button>
                )}
              </Mounted>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /> Memuat timeline…</div>
        ) : tab === "desain" ? (
          barisGantt.length === 0 ? (
            <Kosong
              teks={desainTahun.length ? "Tidak ada desain yang cocok dengan filter." : `Belum ada timeline desain di ${tahun}.`}
              aksi={!desainTahun.length && !dbError ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileUp /> Import Excel</Button>
                  <Button size="sm" onClick={() => setEditDesain({ open: true, row: null })}><Plus /> Tambah desain</Button>
                </div>
              ) : null}
            />
          ) : (
            <>
              <Gantt
                ref={gantt}
                tahun={tahun}
                rows={barisGantt}
                postById={postById}
                dayW={ZOOM[zoom]}
                onEdit={(row) => setEditDesain({ open: true, row })}
                onStatus={ubahStatus}
                onJadwal={ubahJadwal}
              />
              <Legenda />
            </>
          )
        ) : (
          <TabelPost
            posts={postTahun}
            desainByPost={desainByPost}
            onEdit={(row) => setEditPost({ open: true, row })}
            onHapus={(row) => { setHapusTerkait(true); setHapus({ jenis: "post", row }); }}
            onBuatDesain={buatDesainUntuk}
            onLihatDesain={(d) => setEditDesain({ open: true, row: d })}
            onTambah={() => setEditPost({ open: true, row: null })}
          />
        )}
      </div>

      {/* ------------------------------------------------ dialog */}
      <DesainDialog
        open={editDesain.open}
        onOpenChange={(open) => setEditDesain((s) => ({ ...s, open }))}
        initial={editDesain.row}
        posts={posts}
        onSave={simpanDesain}
        onDelete={(row) => { setEditDesain({ open: false, row: null }); setHapus({ jenis: "desain", row }); }}
      />
      <PostDialog
        open={editPost.open}
        onOpenChange={(open) => setEditPost((s) => ({ ...s, open }))}
        initial={editPost.row}
        punyaDesain={!!(editPost.row && desainByPost.get(editPost.row.id))}
        onSave={simpanPost}
      />

      <AlertDialog open={!!hapus} onOpenChange={(o) => !o && setHapus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {hapus?.jenis === "post" ? "post topic" : "timeline desain"}?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{hapus ? (hapus.jenis === "post" ? hapus.row.project_name : hapus.row.type_of_project || hapus.row.design) : ""}&quot; akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {hapus?.jenis === "post" && desainByPost.get(hapus.row.id) && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={hapusTerkait} onCheckedChange={(v) => setHapusTerkait(v === true)} />
              Hapus juga timeline desain yang terhubung
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={konfirmasiHapus} className="bg-destructive text-white hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!impor} onOpenChange={(o) => !o && !busy && setImpor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Timeline</DialogTitle>
            <DialogDescription>{impor?.nama}</DialogDescription>
          </DialogHeader>
          {impor && (
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3">
                  <div className="text-2xl font-bold">{impor.data.posts.length}</div>
                  <div className="text-xs text-muted-foreground">Post topic</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-2xl font-bold">{impor.data.desain.length}</div>
                  <div className="text-xs text-muted-foreground">Timeline desain</div>
                </div>
              </div>
              {!!imporRingkas?.tahunImpor.length && (
                <p className="text-muted-foreground">Tahun dalam file: {imporRingkas.tahunImpor.join(", ")}</p>
              )}
              <div className="flex flex-col gap-2">
                {([
                  ["tambah", "Tambahkan", "Data lama tetap ada; baris dengan judul & tanggal sama dilewati."],
                  ["ganti", "Ganti semua", "Hapus seluruh post topic & timeline desain, lalu isi dari file."],
                ] as const).map(([v, label, ket]) => (
                  <label key={v} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", imporMode === v && "border-primary bg-primary/5")}>
                    <input type="radio" className="mt-1" checked={imporMode === v} onChange={() => setImporMode(v)} />
                    <span>
                      <span className="font-medium">{label}</span>
                      <span className="block text-xs text-muted-foreground">{ket}</span>
                    </span>
                  </label>
                ))}
              </div>
              {impor.data.posts.length > 0 && (
                <label className="flex items-start gap-3">
                  <Checkbox className="mt-0.5" checked={imporAuto} onCheckedChange={(v) => setImporAuto(v === true)} />
                  <span>
                    Buat timeline desain otomatis untuk post topic yang belum punya
                    <span className="block text-xs text-muted-foreground">Due Date = H-7, Date = H-14. Desain di file yang judulnya sama otomatis dihubungkan.</span>
                  </span>
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpor(null)} disabled={busy}>Batal</Button>
            <Button onClick={jalankanImpor} disabled={busy} variant={imporMode === "ganti" ? "destructive" : "default"}>
              {busy && <Loader2 className="animate-spin" />} Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =================================================================== bagian --
function StatCard({ label, value, dot, danger, active, onClick }: {
  label: string; value: number; dot?: string; danger?: boolean; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-2xl border bg-card p-4 text-left shadow-xs transition hover:border-primary/40",
        active && "border-primary ring-1 ring-primary/30",
        danger && "border-rose-300 dark:border-rose-900",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {dot && <span className={cn("size-2 rounded-full", dot)} />}
        {danger && <AlertTriangle className="size-3.5 text-rose-500" />}
        {label}
      </span>
      <span className={cn("text-2xl font-bold tabular-nums", danger && "text-rose-600 dark:text-rose-400")}>{value}</span>
    </button>
  );
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
      {STATUS_OPTIONS.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-5 rounded-sm", statusStyle(s).bar)} /> {s}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rotate-45 rounded-[2px] bg-rose-500" /> Hari H tayang
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-sm ring-2 ring-rose-500" /> Lewat Due Date
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-rose-500/70" /> Hari ini
      </span>
      <span className="ml-auto hidden md:inline">Klik bar atau judul untuk mengubah data; bar ikut menyesuaikan.</span>
    </div>
  );
}

function Kosong({ teks, aksi }: { teks: string; aksi?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 p-14 text-center text-sm text-muted-foreground">
      <CalendarDays className="size-8 opacity-50" />
      {teks}
      {aksi}
    </div>
  );
}

function TabelPost({ posts, desainByPost, onEdit, onHapus, onBuatDesain, onLihatDesain, onTambah }: {
  posts: TimelinePostTopic[];
  desainByPost: Map<string, TimelineDesain>;
  onEdit: (p: TimelinePostTopic) => void;
  onHapus: (p: TimelinePostTopic) => void;
  onBuatDesain: (p: TimelinePostTopic) => void;
  onLihatDesain: (d: TimelineDesain) => void;
  onTambah: () => void;
}) {
  if (!posts.length) {
    return <Kosong teks="Belum ada jadwal posting di tahun ini." aksi={<Button size="sm" onClick={onTambah}><CalendarPlus /> Tambah post topic</Button>} />;
  }
  const today = hariIni();
  let bulanLalu = -1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 w-10">No</th>
            <th className="px-3 py-2">Hari H</th>
            <th className="px-3 py-2">Type of Project</th>
            <th className="px-3 py-2">Topic</th>
            <th className="px-3 py-2">Design</th>
            <th className="px-3 py-2">Publish</th>
            <th className="px-3 py-2">Timeline Desain</th>
            <th className="px-3 py-2 w-20" />
          </tr>
        </thead>
        <tbody>
          {posts.map((p, i) => {
            const b = parseTgl(p.post_date)!.getMonth();
            const header = b !== bulanLalu;
            bulanLalu = b;
            const d = desainByPost.get(p.id);
            const lewat = p.post_date < today;
            const sisa = selisihHari(today, p.post_date);
            return (
              <Fragment key={p.id}>
                {header && (
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold text-primary">{BULAN[b]}</td>
                  </tr>
                )}
                <tr className={cn("border-b hover:bg-muted/40", lewat && "text-muted-foreground")}>
                  <td className="px-3 py-2.5 tabular-nums">{p.no ?? i + 1}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-medium">{namaHari(p.post_date)}, {tglPendek(p.post_date)}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.post_time ? `Pukul ${p.post_time}` : ""}
                      {!lewat && sisa <= 14 && <span className="ml-1 font-medium text-amber-600">• {sisa === 0 ? "hari ini" : `H-${sisa}`}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    <button type="button" onClick={() => onEdit(p)} className="block max-w-[260px] truncate text-left hover:text-primary" title={p.project_name}>{p.project_name}</button>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5" title={p.post_topic ?? undefined}>{p.post_topic ?? "-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{p.design}{p.visual_type ? <span className="text-muted-foreground"> • {p.visual_type}</span> : null}</td>
                  <td className="max-w-[140px] truncate px-3 py-2.5 whitespace-nowrap text-xs" title={p.publish_channels ?? undefined}>{p.publish_channels ?? "-"}</td>
                  <td className="px-3 py-2.5">
                    {d ? (
                      <button type="button" onClick={() => onLihatDesain(d)} className="flex flex-col items-start gap-0.5 text-left">
                        <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium", statusStyle(d.status).badge)}>
                          <Link2 className="size-3" /> {d.status}
                          {d.approval_status && <span className={cn("ml-1 rounded border px-1", APPROVAL_BADGE[d.approval_status])}>{d.approval_status}</span>}
                        </span>
                        <span className="whitespace-nowrap text-[11px] text-muted-foreground tabular-nums">{tglPendek(d.date)} → {tglPendek(d.due_date)}</span>
                      </button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onBuatDesain(p)}>
                        <Wand2 /> Buat timeline
                      </Button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => onEdit(p)} aria-label="Edit"><Pencil className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={() => onHapus(p)} aria-label="Hapus"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
