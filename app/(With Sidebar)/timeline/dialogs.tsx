"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  APPROVAL_OPTIONS, CHANNEL_OPTIONS, DESIGN_OPTIONS, DUE_SEBELUM_H, LAYOUT_OPTIONS, MULAI_SEBELUM_DUE, POST_TOPIC_OPTIONS,
  STATUS_OPTIONS, VISUAL_TYPE_OPTIONS, jadwalDariHariH, namaHari, selisihHari, statusStyle, tglPendek,
  type TimelineDesain, type TimelinePostTopic,
} from "@/lib/timeline";

const KOSONG = "__none__";

function Pilih({
  value, onChange, options, placeholder, allowEmpty,
}: { value: string | null; onChange: (v: string | null) => void; options: string[]; placeholder?: string; allowEmpty?: boolean }) {
  // Nilai lama di luar daftar (mis. hasil import) tetap ditampilkan
  const opsi = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Select value={value ?? KOSONG} onValueChange={(v) => onChange(v === KOSONG ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={KOSONG}>—</SelectItem>}
        {opsi.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);

// ===================================================================== Desain
export type DesainForm = Omit<TimelineDesain, "id" | "created_at" | "no">;

const desainKosong: DesainForm = {
  design: "Flyer", status: "Schedule", date: null, due_date: null, approval_status: null, type_of_project: "",
  layout_ukuran: null, visual_type: "JPEG", visual_link: null, asset_link: null, post_topic_id: null,
};

export function DesainDialog({
  open, onOpenChange, initial, posts, onSave, onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: TimelineDesain | null;
  posts: TimelinePostTopic[];
  onSave: (data: DesainForm) => Promise<boolean>;
  onDelete: (row: TimelineDesain) => void;
}) {
  const [f, setF] = useState<DesainForm>(desainKosong);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const { id: _id, created_at: _c, no: _n, ...rest } = initial;
      setF(rest);
    } else setF(desainKosong);
  }, [open, initial]);

  const set = <K extends keyof DesainForm>(k: K, v: DesainForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const post = posts.find((p) => p.id === f.post_topic_id);

  const pilihPost = (id: string | null) => {
    const p = posts.find((x) => x.id === id);
    setF((prev) => {
      const next = { ...prev, post_topic_id: id };
      if (p) {
        next.type_of_project = prev.type_of_project || p.project_name;
        next.design = prev.design || p.design;
        if (!prev.date && !prev.due_date) Object.assign(next, jadwalDariHariH(p.post_date));
      }
      return next;
    });
  };

  const terbalik = !!f.date && !!f.due_date && f.date > f.due_date;
  const durasi = f.date && f.due_date && !terbalik ? selisihHari(f.date, f.due_date) + 1 : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (terbalik) return;
    setSaving(true);
    const ok = await onSave({ ...f, type_of_project: f.type_of_project?.trim() || null });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{initial ? "Edit Timeline Desain" : "Tambah Timeline Desain"}</DialogTitle>
            <DialogDescription>Bar di timeline mengikuti Date → Due Date dan berwarna sesuai Status.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type of Project" className="sm:col-span-2">
              <Input
                required
                value={f.type_of_project ?? ""}
                onChange={(e) => set("type_of_project", e.target.value)}
                placeholder="mis. Selamat Hari Natal"
              />
            </Field>
            <Field label="Design">
              <Pilih value={f.design} onChange={(v) => set("design", v ?? "Flyer")} options={DESIGN_OPTIONS} />
            </Field>
            <Field label="Terhubung ke Post Topic (hari H)">
              <Select value={f.post_topic_id ?? KOSONG} onValueChange={(v) => pilihPost(v === KOSONG ? null : v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KOSONG}>Tidak terhubung</SelectItem>
                  {posts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {tglPendek(p.post_date)} — {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-primary" /> Jadwal
              </div>
              {post && (
                <Button type="button" size="sm" variant="outline" onClick={() => setF((p) => ({ ...p, ...jadwalDariHariH(post.post_date) }))}>
                  <Wand2 /> Hitung dari hari H ({tglPendek(post.post_date)})
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date (mulai)">
                <Input type="date" value={f.date ?? ""} onChange={(e) => set("date", e.target.value || null)} />
              </Field>
              <Field label="Due Date">
                <Input type="date" value={f.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
              </Field>
            </div>
            <p className={cn("text-xs", terbalik ? "text-destructive font-medium" : "text-muted-foreground")}>
              {terbalik
                ? "Date tidak boleh setelah Due Date."
                : durasi
                  ? `Durasi ${durasi} hari (${namaHari(f.date)} → ${namaHari(f.due_date)}).`
                  : `Aturan baku: Due Date = ${DUE_SEBELUM_H} hari sebelum hari H, Date = ${MULAI_SEBELUM_DUE} hari sebelum Due Date.`}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select value={f.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className={cn("size-2 rounded-full", statusStyle(s).dot)} /> {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status Approval">
              <Pilih value={f.approval_status} onChange={(v) => set("approval_status", v)} options={APPROVAL_OPTIONS} allowEmpty />
            </Field>
            <Field label="Layout / Ukuran">
              <Pilih value={f.layout_ukuran} onChange={(v) => set("layout_ukuran", v)} options={LAYOUT_OPTIONS} allowEmpty />
            </Field>
            <Field label="Visual Type">
              <Pilih value={f.visual_type} onChange={(v) => set("visual_type", v)} options={VISUAL_TYPE_OPTIONS} allowEmpty />
            </Field>
            <Field label="Visual Link (Drive)">
              <Input value={f.visual_link ?? ""} onChange={(e) => set("visual_link", e.target.value || null)} placeholder="https://drive.google.com/..." />
            </Field>
            <Field label="Link To Asset">
              <Input value={f.asset_link ?? ""} onChange={(e) => set("asset_link", e.target.value || null)} placeholder="mis. Hard Drive" />
            </Field>
          </div>

          <DialogFooter>
            {initial && (
              <Button type="button" variant="ghost" className="mr-auto text-destructive hover:text-destructive" onClick={() => onDelete(initial)}>
                <Trash2 /> Hapus
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={saving || terbalik}>
              {saving && <Loader2 className="animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================= Post Topic
export type PostForm = Omit<TimelinePostTopic, "id" | "created_at" | "no">;
export interface PostOpsi {
  /** create: buat baris timeline desain otomatis */
  buatDesain: boolean;
  /** edit: geser tanggal desain terhubung bila hari H berubah */
  geserDesain: boolean;
}

const postKosong: PostForm = {
  design: "Flyer", post_date: "", post_time: "17.00", post_topic: "Hari Raya", project_name: "", visual_type: "JPEG",
  visual_link: null, asset_link: "Hard Drive", publish_channels: "WA, IG, Linkedin",
};

export function PostDialog({
  open, onOpenChange, initial, punyaDesain, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: TimelinePostTopic | null;
  punyaDesain: boolean;
  onSave: (data: PostForm, opsi: PostOpsi) => Promise<boolean>;
}) {
  const [f, setF] = useState<PostForm>(postKosong);
  const [opsi, setOpsi] = useState<PostOpsi>({ buatDesain: true, geserDesain: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const { id: _id, created_at: _c, no: _n, ...rest } = initial;
      setF(rest);
    } else setF(postKosong);
    setOpsi({ buatDesain: true, geserDesain: true });
  }, [open, initial]);

  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const channels = (f.publish_channels ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const toggleChannel = (c: string) => {
    const next = channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c];
    set("publish_channels", CHANNEL_OPTIONS.filter((o) => next.includes(o)).concat(next.filter((x) => !CHANNEL_OPTIONS.includes(x))).join(", ") || null);
  };
  const jadwal = f.post_date ? jadwalDariHariH(f.post_date) : null;
  const tanggalBerubah = !!initial && !!f.post_date && initial.post_date !== f.post_date;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave({ ...f, project_name: f.project_name.trim() }, opsi);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{initial ? "Edit Post Topic" : "Tambah Post Topic"}</DialogTitle>
            <DialogDescription>Jadwal tayang (hari H). Timeline desain dihitung mundur dari tanggal ini.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type of Project" className="sm:col-span-2">
              <Input required value={f.project_name} onChange={(e) => set("project_name", e.target.value)} placeholder="mis. Hari Raya Idul Fitri 1447" />
            </Field>
            <Field label={`Date (hari H)${f.post_date ? ` — ${namaHari(f.post_date)}` : ""}`}>
              <Input required type="date" value={f.post_date} onChange={(e) => set("post_date", e.target.value)} />
            </Field>
            <Field label="Time">
              <Input value={f.post_time ?? ""} onChange={(e) => set("post_time", e.target.value || null)} placeholder="17.00" />
            </Field>
            <Field label="Design">
              <Pilih value={f.design} onChange={(v) => set("design", v ?? "Flyer")} options={DESIGN_OPTIONS} />
            </Field>
            <Field label="Post Topic / Type">
              <Pilih value={f.post_topic} onChange={(v) => set("post_topic", v)} options={POST_TOPIC_OPTIONS} allowEmpty />
            </Field>
            <Field label="Visual Type">
              <Pilih value={f.visual_type} onChange={(v) => set("visual_type", v)} options={VISUAL_TYPE_OPTIONS} allowEmpty />
            </Field>
            <Field label="Link To Be Publish Post">
              <div className="flex h-9 items-center gap-4">
                {CHANNEL_OPTIONS.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={channels.includes(c)} onCheckedChange={() => toggleChannel(c)} /> {c}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Visual Link (Drive)">
              <Input value={f.visual_link ?? ""} onChange={(e) => set("visual_link", e.target.value || null)} placeholder="https://drive.google.com/..." />
            </Field>
            <Field label="Link To Asset">
              <Input value={f.asset_link ?? ""} onChange={(e) => set("asset_link", e.target.value || null)} placeholder="mis. Hard Drive" />
            </Field>
          </div>

          {!initial && (
            <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
              <Checkbox className="mt-0.5" checked={opsi.buatDesain} onCheckedChange={(v) => setOpsi((o) => ({ ...o, buatDesain: v === true }))} />
              <span>
                <span className="font-medium">Buat timeline desain otomatis</span>
                <span className="block text-xs text-muted-foreground">
                  {jadwal
                    ? `Date ${tglPendek(jadwal.date)} → Due Date ${tglPendek(jadwal.due_date)}, status Schedule.`
                    : `Due Date = H-${DUE_SEBELUM_H}, Date = H-${DUE_SEBELUM_H + MULAI_SEBELUM_DUE}.`}
                </span>
              </span>
            </label>
          )}
          {initial && punyaDesain && tanggalBerubah && (
            <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <Checkbox className="mt-0.5" checked={opsi.geserDesain} onCheckedChange={(v) => setOpsi((o) => ({ ...o, geserDesain: v === true }))} />
              <span>
                <span className="font-medium">Geser timeline desain ikut hari H</span>
                <span className="block text-xs text-muted-foreground">
                  Hari H pindah {selisihHari(initial.post_date, f.post_date) > 0 ? "+" : ""}
                  {selisihHari(initial.post_date, f.post_date)} hari; Date & Due Date desain terhubung ikut bergeser.
                </span>
              </span>
            </label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={saving || !f.post_date}>
              {saving && <Loader2 className="animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
