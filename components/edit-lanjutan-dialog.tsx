"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeStatus,
  STATUS_LIST,
  STATUS_META,
  susunTimeline,
  validasiTimeline,
} from "@/lib/permintaan-workflow";
import { cn } from "@/lib/utils";

export interface EditLanjutanData {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  due_date: string;
  requester: string;
  rating?: string | number | null;
  review?: string | null;
  revision_count?: number | null;
  riwayat?: {
    created_at: string;
    status_to: string;
    changed_by: string | null;
    catatan: string | null;
  }[];
}

interface EditLanjutanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EditLanjutanData;
  currentUserId: string;
  onSuccess: () => void;
}

interface Pengguna {
  id: string;
  name: string | null;
  email: string | null;
}

interface BarisTimeline {
  key: number;
  /** Nilai input apa adanya; kosong saat admin sedang mengetik ulang. */
  waktu: string;
  /** Waktu tersimpan. Baris yang tidak disentuh tetap presisi sampai milidetik. */
  iso: string | null;
  status_to: string;
  changed_by: string;
  catatan: string;
}

const TANPA_PELAKU = "none";
const TANPA_RATING = "none";

const keInputWaktu = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm:ss");
const keInputDeadline = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");

const urutkanBaris = (rows: BarisTimeline[]) =>
  rows.some((r) => !r.iso)
    ? rows
    : [...rows].sort((a, b) => Date.parse(a.iso!) - Date.parse(b.iso!));

export function EditLanjutanDialog({
  open,
  onOpenChange,
  data,
  currentUserId,
  onSuccess,
}: EditLanjutanDialogProps) {
  const [requester, setRequester] = useState("");
  const [deadline, setDeadline] = useState("");
  const [rating, setRating] = useState(TANPA_RATING);
  const [review, setReview] = useState("");
  const [rows, setRows] = useState<BarisTimeline[]>([]);
  const [users, setUsers] = useState<Pengguna[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const nextKey = useRef(0);

  useEffect(() => {
    if (!open) return;

    setRequester(data.requester);
    setDeadline(data.due_date ? keInputDeadline(data.due_date) : "");
    const nilaiRating = Number(data.rating);
    setRating(nilaiRating >= 1 && nilaiRating <= 5 ? String(nilaiRating) : TANPA_RATING);
    setReview(data.review || "");

    // Tiket lama tanpa riwayat: mulai dari satu entri agar status tiket tidak berubah
    const sumber = data.riwayat?.length
      ? data.riwayat
      : [{ created_at: data.created_at, status_to: data.status, changed_by: data.requester, catatan: null }];
    setRows(
      sumber.map((r) => ({
        key: nextKey.current++,
        waktu: keInputWaktu(r.created_at),
        iso: r.created_at,
        status_to: normalizeStatus(r.status_to),
        changed_by: r.changed_by || TANPA_PELAKU,
        catatan: r.catatan || "",
      })),
    );

    createClient()
      .from("user_profiles")
      .select("id, name, email")
      .order("name")
      .then(({ data: profiles, error }) => {
        if (error) toast.error("Gagal memuat daftar pengguna: " + error.message);
        else setUsers(profiles || []);
      });
  }, [open, data]);

  const updateRow = (key: number, patch: Partial<BarisTimeline>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Waktu tetap di posisinya, isi entri yang bertukar: timeline selalu kronologis
  const pindahkan = (index: number, arah: -1 | 1) =>
    setRows((prev) => {
      const target = index + arah;
      const next = [...prev];
      next[index] = { ...prev[target], waktu: prev[index].waktu, iso: prev[index].iso };
      next[target] = { ...prev[index], waktu: prev[target].waktu, iso: prev[target].iso };
      return next;
    });

  const tambahEntri = () => {
    const iso = new Date().toISOString();
    setRows((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        waktu: keInputWaktu(iso),
        iso,
        status_to: prev[prev.length - 1]?.status_to ?? "TO DO",
        changed_by: currentUserId,
        catatan: "",
      },
    ]);
  };

  const timeline = rows.map((r) => ({
    created_at: r.iso,
    status_to: r.status_to,
    changed_by: r.changed_by === TANPA_PELAKU ? null : r.changed_by,
    catatan: r.catatan,
  }));
  const timelineError = validasiTimeline(timeline);
  const pratinjau = useMemo(
    () =>
      !timelineError && rows.length > 0
        ? susunTimeline(
            rows.map((r) => ({ created_at: r.iso!, status_to: r.status_to })),
          ).kolom
        : null,
    [rows, timelineError],
  );
  const statusSekarang = normalizeStatus(data.status);
  const statusBaru = pratinjau ? normalizeStatus(pratinjau.status) : statusSekarang;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timelineError) return toast.error(timelineError);
    if (!deadline) return toast.error("Deadline wajib diisi");

    setIsSaving(true);
    try {
      const res = await fetch(`/api/permintaan/${data.id}/edit-lanjutan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updated_at: data.updated_at,
          requester,
          // Deadline yang tidak disentuh dikirim apa adanya agar tidak terhitung berubah
          due_date:
            deadline === keInputDeadline(data.due_date)
              ? data.due_date
              : new Date(deadline).toISOString(),
          rating: rating === TANPA_RATING ? null : Number(rating),
          review,
          timeline,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      toast.success(json.changed ? "Perubahan berhasil disimpan" : "Tidak ada perubahan");
      onOpenChange(false);
      if (json.changed) onSuccess();
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const namaPengguna = (u: Pengguna) => u.name || u.email || u.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Lanjutan</DialogTitle>
          <DialogDescription>
            Ubah timeline dan data yang biasanya terkunci. Perubahan dicatat di diskusi tiket
            dan peminta tidak menerima notifikasi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lanjutan-requester">Peminta</Label>
                <Select value={requester} onValueChange={setRequester}>
                  <SelectTrigger id="lanjutan-requester" className="w-full">
                    <SelectValue placeholder="Memuat pengguna..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {namaPengguna(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lanjutan-deadline">Deadline</Label>
                <Input
                  id="lanjutan-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lanjutan-rating">Rating</Label>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger id="lanjutan-rating" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TANPA_RATING}>Belum ada</SelectItem>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / 5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lanjutan-review">Ulasan</Label>
                <Textarea
                  id="lanjutan-review"
                  rows={2}
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Timeline</h3>
              <p className="text-xs text-muted-foreground">
                Waktu entri pertama menjadi tanggal dibuat tiket, dan status entri terakhir
                menjadi status tiket. Urutan selalu mengikuti waktu.
              </p>
            </div>

            <ol className="space-y-2">
              {rows.map((row, index) => (
                <li key={row.key} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {index === 0 ? "Entri 1 · Tanggal dibuat" : `Entri ${index + 1}`}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Pindah ke atas"
                        aria-label={`Pindahkan entri ${index + 1} ke atas`}
                        disabled={index === 0}
                        onClick={() => pindahkan(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Pindah ke bawah"
                        aria-label={`Pindahkan entri ${index + 1} ke bawah`}
                        disabled={index === rows.length - 1}
                        onClick={() => pindahkan(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Hapus entri"
                        aria-label={`Hapus entri ${index + 1}`}
                        disabled={rows.length === 1}
                        onClick={() =>
                          setRows((prev) => prev.filter((r) => r.key !== row.key))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      type="datetime-local"
                      step={1}
                      aria-label={`Waktu entri ${index + 1}`}
                      value={row.waktu}
                      onChange={(e) => {
                        const waktu = e.target.value;
                        updateRow(row.key, {
                          waktu,
                          iso: waktu ? new Date(waktu).toISOString() : null,
                        });
                      }}
                      onBlur={() => setRows(urutkanBaris)}
                    />
                    <Select
                      value={row.status_to}
                      onValueChange={(status_to) => updateRow(row.key, { status_to })}
                    >
                      <SelectTrigger aria-label={`Status entri ${index + 1}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_LIST.map((st) => (
                          <SelectItem key={st} value={st}>
                            {STATUS_META[st].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={row.changed_by}
                      onValueChange={(changed_by) => updateRow(row.key, { changed_by })}
                    >
                      <SelectTrigger aria-label={`Pelaku entri ${index + 1}`} className="w-full">
                        <SelectValue placeholder="Memuat pengguna..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value={TANPA_PELAKU}>Tanpa pelaku</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {namaPengguna(u)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    aria-label={`Catatan entri ${index + 1}`}
                    placeholder="Catatan (opsional)"
                    value={row.catatan}
                    onChange={(e) => updateRow(row.key, { catatan: e.target.value })}
                  />
                </li>
              ))}
            </ol>

            <Button type="button" variant="outline" size="sm" onClick={tambahEntri}>
              <Plus className="mr-1.5 h-4 w-4" /> Tambah Entri
            </Button>

            {timelineError ? (
              <p role="alert" className="text-sm text-destructive">
                {timelineError}
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                Setelah disimpan:
                <Badge className={cn("font-medium", STATUS_META[statusBaru].badgeClass)}>
                  {STATUS_META[statusBaru].label}
                </Badge>
                {statusBaru !== statusSekarang && (
                  <span>(sekarang {STATUS_META[statusSekarang].label})</span>
                )}
                <span>· {pratinjau?.revision_count ?? 0} revisi</span>
              </p>
            )}
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSaving || !!timelineError}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
