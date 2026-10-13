"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Row = Record<string, any> & { id: string };

interface Field {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "score" | "url" | "month";
  required?: boolean;
  hideInTable?: boolean;
  placeholder?: string;
}

interface Computed {
  label: string;
  render: (row: Row) => React.ReactNode;
}

interface TabConfig {
  value: string;
  label: string;
  table: string;
  description: string;
  order: { column: string; ascending: boolean }[];
  fields: Field[];
  computed?: Computed[];
  groupBy?: string; // kolom untuk filter dropdown (mis. nama pada WLA)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatDate(value: string | null): string {
  if (!value) return "-";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

function formatMonth(value: string | null): string {
  if (!value) return "-";
  const [y, m] = value.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

const pct = (value: number) => `${Math.round(value)}%`;

// Bobot penilaian sesuai sheet Evaluasi (skala 1–5)
const EVAL_WEIGHTS: Record<string, number> = {
  kreativitas: 20,
  brief: 20,
  deadline: 15,
  kualitas: 20,
  komunikasi: 15,
  revisi: 10,
};

const evaluasiTotal = (row: Row) =>
  Object.entries(EVAL_WEIGHTS).reduce((sum, [key, weight]) => sum + (Number(row[key]) / 5) * weight, 0);

const STATUS_CLASS: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  designed: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  edited: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  "in progress": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  revisi: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  schedule: "bg-muted text-muted-foreground",
};

const TABS: TabConfig[] = [
  {
    value: "content-plan",
    label: "Content Plan",
    table: "content_plan",
    description: "Jadwal desain & konten per bulan (sheet Design Month).",
    order: [{ column: "tgl_mulai", ascending: false }],
    fields: [
      { key: "jenis", label: "Jenis", type: "text", placeholder: "Poster, Flyer, Video Event, ..." },
      { key: "judul", label: "Judul / Task", type: "text", required: true },
      { key: "tgl_mulai", label: "Mulai", type: "date" },
      { key: "tgl_selesai", label: "Selesai", type: "date" },
      { key: "due_date", label: "Due Date", type: "date" },
      { key: "tgl_publish", label: "Publish", type: "date" },
      { key: "status", label: "Status", type: "text", placeholder: "Schedule, In Progress, Designed, Published, ..." },
      { key: "designer", label: "Designer", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
    groupBy: "designer",
  },
  {
    value: "target-project",
    label: "Target Project",
    table: "target_project",
    description: "Target jumlah vs realisasi project tim (sheet Todo List).",
    order: [{ column: "tgl_mulai", ascending: true }],
    fields: [
      { key: "nama", label: "Nama", type: "text", required: true },
      { key: "aktivitas", label: "Aktivitas", type: "text", required: true },
      { key: "rencana", label: "Rencana", type: "number" },
      { key: "realisasi", label: "Realisasi", type: "number" },
      { key: "tgl_mulai", label: "Mulai", type: "date" },
      { key: "deadline", label: "Deadline", type: "date" },
      { key: "status", label: "Status", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "link", label: "Link", type: "url" },
    ],
    computed: [
      {
        label: "Capaian",
        render: (row) => (Number(row.rencana) > 0 ? pct((Number(row.realisasi) / Number(row.rencana)) * 100) : "-"),
      },
    ],
    groupBy: "nama",
  },
  {
    value: "evaluasi",
    label: "Evaluasi Designer",
    table: "evaluasi_designer",
    description:
      "Skor 1–5 per project. Bobot: Kreativitas 20%, Brief 20%, Deadline 15%, Kualitas 20%, Komunikasi 15%, Revisi 10%.",
    order: [
      { column: "periode", ascending: false },
      { column: "designer", ascending: true },
      { column: "created_at", ascending: true },
    ],
    fields: [
      { key: "periode", label: "Periode", type: "month", required: true },
      { key: "designer", label: "Designer", type: "text", required: true },
      { key: "project", label: "Project", type: "text", required: true },
      { key: "kreativitas", label: "Kreativitas", type: "score", required: true },
      { key: "brief", label: "Brief", type: "score", required: true },
      { key: "deadline", label: "Deadline", type: "score", required: true },
      { key: "kualitas", label: "Kualitas", type: "score", required: true },
      { key: "komunikasi", label: "Komunikasi", type: "score", required: true },
      { key: "revisi", label: "Revisi", type: "score", required: true },
    ],
    computed: [{ label: "Total", render: (row) => pct(evaluasiTotal(row)) }],
    groupBy: "designer",
  },
  {
    value: "wla",
    label: "WLA",
    table: "wla_item",
    description: "Kertas kerja analisis beban kerja per individu. Total durasi = frekuensi × jumlah keluaran × durasi.",
    order: [
      { column: "nama", ascending: true },
      { column: "no_urut", ascending: true },
    ],
    fields: [
      { key: "nama", label: "Nama", type: "text", required: true },
      { key: "posisi", label: "Posisi", type: "text", hideInTable: true },
      { key: "divisi", label: "Divisi", type: "text", hideInTable: true },
      { key: "no_urut", label: "No", type: "number" },
      { key: "tanggung_jawab", label: "Tanggung Jawab", type: "text", hideInTable: true },
      { key: "aktivitas", label: "Aktivitas", type: "text", required: true },
      { key: "keluaran", label: "Keluaran", type: "text" },
      { key: "pelaksanaan", label: "Pelaksanaan", type: "text", placeholder: "Rutin/Utama, Berkala/Proyek, Tambahan" },
      { key: "frekuensi", label: "Frekuensi", type: "number" },
      { key: "satuan", label: "Per", type: "text", placeholder: "Hari, Minggu, Bulan, Triwulan, Semester, Tahun" },
      { key: "jumlah_keluaran", label: "Jumlah", type: "number" },
      { key: "durasi_menit", label: "Durasi (menit)", type: "number" },
      { key: "catatan", label: "Catatan", type: "textarea", hideInTable: true },
    ],
    computed: [
      {
        label: "Total (menit)",
        render: (row) =>
          (Number(row.frekuensi) * Number(row.jumlah_keluaran) * Number(row.durasi_menit)).toLocaleString("id-ID"),
      },
    ],
    groupBy: "nama",
  },
];

function renderCell(field: Field, value: any): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">-</span>;
  switch (field.type) {
    case "date":
      return <span className="whitespace-nowrap">{formatDate(value)}</span>;
    case "month":
      return <span className="whitespace-nowrap">{formatMonth(value)}</span>;
    case "url":
      return (
        <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          Buka <ExternalLink className="size-3" />
        </a>
      );
    case "number":
      return Number(value).toLocaleString("id-ID");
    default:
      if (field.key === "status") {
        return (
          <Badge variant="outline" className={STATUS_CLASS[String(value).toLowerCase()] ?? ""}>
            {value}
          </Badge>
        );
      }
      return <span className="whitespace-pre-line">{value}</span>;
  }
}

function CrudTab({ config, canEdit }: { config: TabConfig; canEdit: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(config.table).select("*");
    for (const o of config.order) query = query.order(o.column, { ascending: o.ascending, nullsFirst: false });
    const { data, error } = await query;
    if (error) toast.error(`Gagal memuat ${config.label}: ${error.message}`);
    setRows((data as Row[]) || []);
    setLoading(false);
  }, [supabase, config]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(
    () =>
      config.groupBy
        ? Array.from(new Set(rows.map((r) => r[config.groupBy!]).filter(Boolean))).sort()
        : [],
    [rows, config.groupBy]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (config.groupBy && group !== "all" && r[config.groupBy] !== group) return false;
      if (!q) return true;
      return config.fields.some((f) => String(r[f.key] ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, group, config]);

  const tableFields = config.fields.filter((f) => !f.hideInTable);

  const openForm = (row: Row | null) => {
    setEditing(row);
    setForm(
      Object.fromEntries(
        config.fields.map((f) => [
          f.key,
          row ? String(row[f.key] ?? "") : f.type === "month" ? new Date().toISOString().slice(0, 7) : "",
        ])
      )
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const missing = config.fields.find((f) => f.required && !form[f.key]?.trim());
    if (missing) {
      toast.error(`${missing.label} wajib diisi.`);
      return;
    }
    const payload: Record<string, any> = {};
    for (const f of config.fields) {
      const raw = form[f.key]?.trim() ?? "";
      payload[f.key] =
        raw === "" ? (f.type === "number" ? 0 : null) : f.type === "number" || f.type === "score" ? Number(raw) : raw;
    }
    setSaving(true);
    const { error } = editing
      ? await supabase.from(config.table).update(payload).eq("id", editing.id)
      : await supabase.from(config.table).insert(payload);
    setSaving(false);
    if (error) {
      toast.error(`Gagal menyimpan: ${error.message}`);
      return;
    }
    toast.success(editing ? "Data diperbarui." : "Data ditambahkan.");
    setDialogOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from(config.table).delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) {
      toast.error(`Gagal menghapus: ${error.message}`);
      return;
    }
    toast.success("Data dihapus.");
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{config.description}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari..."
            className="pl-8"
          />
        </div>
        {config.groupBy && (
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Semua</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        {canEdit && (
          <Button size="sm" onClick={() => openForm(null)} className="gap-1.5">
            <Plus className="size-4" /> Tambah
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {tableFields.map((f) => (
                <TableHead key={f.key} className="whitespace-nowrap">
                  {f.label}
                </TableHead>
              ))}
              {config.computed?.map((c) => (
                <TableHead key={c.label} className="whitespace-nowrap">
                  {c.label}
                </TableHead>
              ))}
              {canEdit && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={99} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={99} className="py-10 text-center text-muted-foreground">
                  Belum ada data.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  {tableFields.map((f) => (
                    <TableCell key={f.key} className="min-w-[160px] max-w-xs align-top">
                      {renderCell(f, row[f.key])}
                    </TableCell>
                  ))}
                  {config.computed?.map((c) => (
                    <TableCell key={c.label} className="align-top font-medium">
                      {c.render(row)}
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell className="align-top">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openForm(row)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} data</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Tambah"} {config.label}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" || f.key === "judul" || f.key === "aktivitas" ? "grid gap-1.5 sm:col-span-2" : "grid gap-1.5"}>
                <Label htmlFor={f.key}>
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={f.key}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    id={f.key}
                    type={f.type === "score" ? "number" : f.type === "url" ? "url" : f.type}
                    min={f.type === "score" ? 1 : undefined}
                    max={f.type === "score" ? 5 : undefined}
                    placeholder={f.placeholder}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.judul || deleteTarget?.aktivitas || deleteTarget?.project} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ToolsCreativePage() {
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
      setIsAdmin(data?.role === "admin");
    })();
  }, [supabase]);

  return (
    <Content title="Tools Creative" description="Perencanaan, target, evaluasi, dan beban kerja tim design." size="lg">
      <Tabs defaultValue={TABS[0].value}>
        <TabsList className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-2">
            <CrudTab config={t} canEdit={isAdmin} />
          </TabsContent>
        ))}
      </Tabs>
    </Content>
  );
}
