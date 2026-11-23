"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  Paperclip,
  Pencil,
  Printer,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/file-drop";
import { createClient } from "@/lib/supabase/client";
import { downloadFile } from "@/lib/permintaan-files";
import { cn } from "@/lib/utils";
import {
  CHECKLIST_REVIEW_DESIGN,
  TAHAP_CETAK,
  normalizeCetak,
  ringkasSpesifikasi,
  tahapBerikutnya,
  type DataCetak,
  type FileCetak,
  type SpesifikasiCetak,
} from "@/lib/permintaan-cetak";
import type { PermintaanStatus, WorkflowAction } from "@/lib/permintaan-workflow";

export type CetakDialogKind = "review" | "tahap" | "bast" | "spesifikasi" | null;

type RunAction = (
  action: WorkflowAction | "ubah_spesifikasi",
  payload: Record<string, unknown>,
  successMessage: string,
) => Promise<boolean>;

const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

// ===================== TRACKER =====================

export function CetakTracker({
  status,
  cetak: raw,
  canAct,
  canEditSpesifikasi,
  onOpen,
}: {
  status: PermintaanStatus;
  cetak: unknown;
  /** Aksi yang tersedia untuk tahap berikutnya bagi pengguna ini. */
  canAct: boolean;
  canEditSpesifikasi: boolean;
  onOpen: (kind: CetakDialogKind) => void;
}) {
  const cetak = normalizeCetak(raw);
  const next = tahapBerikutnya(cetak);
  const aktif = status === "CETAK" || (status === "REVIEW" && next?.key === "review_design");
  const spek = cetak.spesifikasi ?? {};
  const adaSpek = !!ringkasSpesifikasi(spek);

  return (
    <div className="border rounded-lg p-5 bg-card shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Printer className="h-4 w-4" /> Tahapan Cetak
        </h3>
        {canEditSpesifikasi && (
          <Button size="sm" variant="ghost" onClick={() => onOpen("spesifikasi")}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Spesifikasi
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {(
          [
            ["Jumlah", spek.jumlah],
            ["Ukuran", spek.ukuran],
            ["Bahan", spek.bahan],
            ["Finishing", spek.finishing],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-md bg-muted/40 px-3 py-2 min-w-0">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="font-medium truncate" title={value || undefined}>
              {value || "-"}
            </dd>
          </div>
        ))}
      </dl>
      {!adaSpek && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Spesifikasi cetak belum diisi. Lengkapi sebelum Review Design agar tidak salah cetak.
        </p>
      )}

      <ol className="relative space-y-4 border-l pl-6 ml-3">
        {TAHAP_CETAK.map((t, idx) => {
          const rec = cetak.tahap?.[t.key];
          const isNext = next?.key === t.key && aktif;
          return (
            <li key={t.key} className="relative">
              <span
                className={cn(
                  "absolute -left-[37px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-card text-[11px] font-semibold",
                  rec && "border-cyan-600 bg-cyan-600 text-white",
                  isNext && "border-cyan-600 text-cyan-700 dark:text-cyan-400 ring-4 ring-cyan-500/15",
                  !rec && !isNext && "border-border text-muted-foreground",
                )}
              >
                {rec ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", !rec && !isNext && "text-muted-foreground")}>
                    {t.label}
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                      oleh {t.pelaku === "peminta" ? "peminta" : "tim Design"}
                    </span>
                  </p>
                  {!rec && <p className="text-xs text-muted-foreground">{t.deskripsi}</p>}
                </div>
                {isNext && canAct && (
                  <Button
                    size="sm"
                    onClick={() =>
                      onOpen(t.key === "review_design" ? "review" : t.key === "bast" ? "bast" : "tahap")
                    }
                  >
                    {t.tombol}
                  </Button>
                )}
              </div>
              {rec && (
                <div className="mt-1 space-y-1 text-xs">
                  <p className="text-muted-foreground">
                    {fmtDateTime(rec.at)} · {rec.by_name}
                  </p>
                  {rec.referensi && (
                    <p>
                      <span className="text-muted-foreground">{t.referensiLabel}:</span>{" "}
                      <span className="font-medium">{rec.referensi}</span>
                    </p>
                  )}
                  {rec.catatan && (
                    <p className="rounded-md bg-muted/60 px-2.5 py-1.5 whitespace-pre-wrap">{rec.catatan}</p>
                  )}
                  {rec.files && rec.files.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {rec.files.map((f, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => downloadFile(f)}
                            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-muted"
                            title="Unduh"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span className="max-w-40 truncate">{f.name}</span>
                            <Download className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ===================== DIALOG =====================

export function CetakDialogs({
  open,
  onOpenChange,
  permintaanId,
  cetak: raw,
  isOwner,
  isSubmitting,
  runAction,
}: {
  open: CetakDialogKind;
  onOpenChange: (kind: CetakDialogKind) => void;
  permintaanId: string;
  cetak: unknown;
  isOwner: boolean;
  isSubmitting: boolean;
  runAction: RunAction;
}) {
  const cetak = normalizeCetak(raw);
  const close = () => onOpenChange(null);
  // Remount isi dialog setiap dibuka agar isian lama tidak tertinggal
  const key = `${open}-${tahapBerikutnya(cetak)?.key}`;

  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {open === "review" && (
          <ReviewDesignForm key={key} cetak={cetak} isSubmitting={isSubmitting} runAction={runAction} onDone={close} />
        )}
        {open === "tahap" && (
          <TahapForm key={key} permintaanId={permintaanId} cetak={cetak} isSubmitting={isSubmitting} runAction={runAction} onDone={close} />
        )}
        {open === "bast" && (
          <BastForm key={key} permintaanId={permintaanId} isOwner={isOwner} isSubmitting={isSubmitting} runAction={runAction} onDone={close} />
        )}
        {open === "spesifikasi" && (
          <SpesifikasiForm key={key} awal={cetak.spesifikasi} isSubmitting={isSubmitting} runAction={runAction} onDone={close} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ loading, children, onClick }: { loading: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={loading}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

function ReviewDesignForm({
  cetak,
  isSubmitting,
  runAction,
  onDone,
}: {
  cetak: DataCetak;
  isSubmitting: boolean;
  runAction: RunAction;
  onDone: () => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const spek = ringkasSpesifikasi(cetak.spesifikasi);
  const lengkap = CHECKLIST_REVIEW_DESIGN.every((c) => checked.includes(c));

  const submit = async () => {
    if (!lengkap) {
      toast.warning("Centang semua poin pengecekan terlebih dahulu.");
      return;
    }
    const ok = await runAction(
      "setujui_cetak",
      { checklist: checked, note },
      "Desain disetujui. Tim Design akan memproses MR.",
    );
    if (ok) onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> Review Design Sebelum Cetak
        </DialogTitle>
        <DialogDescription>
          Setelah disetujui, file akan diproses ke percetakan dan tidak bisa diubah lagi
          tanpa biaya cetak ulang. Cek dengan teliti file di bagian Lampiran.
        </DialogDescription>
      </DialogHeader>
      {spek ? (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{spek}</p>
      ) : (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          Spesifikasi cetak belum diisi. Tulis jumlah, ukuran & bahan di catatan bila perlu.
        </p>
      )}
      <div className="space-y-2.5">
        {CHECKLIST_REVIEW_DESIGN.map((c) => (
          <label key={c} className="flex items-start gap-2.5 text-sm cursor-pointer">
            <Checkbox
              checked={checked.includes(c)}
              onCheckedChange={(v) =>
                setChecked((prev) => (v ? [...prev, c] : prev.filter((x) => x !== c)))
              }
              className="mt-0.5"
            />
            {c}
          </label>
        ))}
      </div>
      <Label htmlFor="review-design-note">Catatan untuk tim Design (opsional)</Label>
      <Textarea
        id="review-design-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Contoh: Mohon dicetak sebelum tanggal 10."
      />
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Batal
        </Button>
        <SubmitButton loading={isSubmitting} onClick={submit}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Setujui untuk Dicetak
        </SubmitButton>
      </DialogFooter>
    </>
  );
}

function useUploadCetak(permintaanId: string) {
  const [files, setFiles] = useState<FileCetak[]>([]);
  const [uploading, setUploading] = useState(false);

  const upload = async (list: File[]) => {
    if (list.length === 0) return;
    const s = createClient();
    setUploading(true);
    const toastId = toast.loading(`Mengunggah ${list.length} file...`);
    const hasil = await Promise.all(
      list.map(async (file) => {
        const path = `${permintaanId}/cetak/${Date.now()}_${file.name}`;
        const { error } = await s.storage.from("permintaan").upload(path, file);
        if (error) return null;
        return { name: file.name, url: s.storage.from("permintaan").getPublicUrl(path).data.publicUrl };
      }),
    );
    const ok = hasil.filter((f): f is FileCetak => f !== null);
    setFiles((prev) => [...prev, ...ok]);
    if (ok.length === list.length) toast.success("File terunggah", { id: toastId });
    else toast.error(`${list.length - ok.length} file gagal diunggah`, { id: toastId });
    setUploading(false);
  };

  const remove = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  return { files, uploading, upload, remove };
}

function FileList({ files, onRemove }: { files: FileCetak[]; onRemove: (idx: number) => void }) {
  if (files.length === 0) return null;
  return (
    <ul className="divide-y rounded-md border text-sm">
      {files.map((f, i) => (
        <li key={i} className="flex items-center gap-2 px-3 py-1.5">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 min-w-0 truncate">{f.name}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemove(i)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function TahapForm({
  permintaanId,
  cetak,
  isSubmitting,
  runAction,
  onDone,
}: {
  permintaanId: string;
  cetak: DataCetak;
  isSubmitting: boolean;
  runAction: RunAction;
  onDone: () => void;
}) {
  const next = tahapBerikutnya(cetak);
  const [referensi, setReferensi] = useState("");
  const [note, setNote] = useState("");
  const { files, uploading, upload, remove } = useUploadCetak(permintaanId);

  if (!next || next.pelaku !== "pic") return null;

  const submit = async () => {
    if (next.referensiWajib && !referensi.trim()) {
      toast.warning(`${next.referensiLabel} wajib diisi.`);
      return;
    }
    const ok = await runAction(
      "tahap_cetak",
      { tahap: next.key, referensi, note, files },
      `${next.label} dicatat.`,
    );
    if (ok) onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{next.label}</DialogTitle>
        <DialogDescription>{next.deskripsi} Peminta akan diberi notifikasi.</DialogDescription>
      </DialogHeader>
      {next.referensiLabel && (
        <div className="space-y-1.5">
          <Label htmlFor="cetak-ref">
            {next.referensiLabel}
            {!next.referensiWajib && <span className="text-muted-foreground font-normal"> (opsional)</span>}
          </Label>
          <Input id="cetak-ref" value={referensi} onChange={(e) => setReferensi(e.target.value)} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="cetak-note">Catatan (opsional)</Label>
        <Textarea id="cetak-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Lampiran (opsional)</Label>
        <FileDropzone
          onFiles={upload}
          loading={uploading}
          paste={false}
          hint={next.key === "diterima_tim" ? "contoh: foto hasil cetak" : "contoh: dokumen MR/PO"}
        />
        <FileList files={files} onRemove={remove} />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Batal
        </Button>
        <SubmitButton loading={isSubmitting || uploading} onClick={submit}>
          {next.tombol}
        </SubmitButton>
      </DialogFooter>
    </>
  );
}

function BastForm({
  permintaanId,
  isOwner,
  isSubmitting,
  runAction,
  onDone,
}: {
  permintaanId: string;
  isOwner: boolean;
  isSubmitting: boolean;
  runAction: RunAction;
  onDone: () => void;
}) {
  const [referensi, setReferensi] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const { files, uploading, upload, remove } = useUploadCetak(permintaanId);

  const submit = async () => {
    if (isOwner && rating === 0) {
      toast.warning("Berikan rating bintang terlebih dahulu.");
      return;
    }
    const ok = await runAction(
      "bast",
      { referensi, files, rating: rating || undefined, review },
      "Serah terima dikonfirmasi. Permintaan selesai!",
    );
    if (ok) onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Berita Acara Serah Terima (BAST)</DialogTitle>
        <DialogDescription>
          Konfirmasi bahwa hasil cetak sudah diterima sesuai jumlah & kondisi. Permintaan akan
          ditandai selesai.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="bast-ref">
          Nomor BAST <span className="text-muted-foreground font-normal">(opsional)</span>
        </Label>
        <Input id="bast-ref" value={referensi} onChange={(e) => setReferensi(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Dokumen BAST bertanda tangan (opsional)</Label>
        <FileDropzone onFiles={upload} loading={uploading} paste={false} hint="PDF / foto BAST" />
        <FileList files={files} onRemove={remove} />
      </div>
      <div className="flex flex-col items-center gap-2 pt-2">
        <Label>Seberapa puas Anda dengan hasilnya?{!isOwner && " (opsional)"}</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} bintang`}>
              <Star
                className={cn(
                  "h-7 w-7 transition-colors hover:scale-110",
                  star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
      </div>
      <Textarea
        rows={2}
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder="Ulasan / masukan (opsional)"
      />
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Batal
        </Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={submit}
          disabled={isSubmitting || uploading}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Konfirmasi BAST & Selesai
        </Button>
      </DialogFooter>
    </>
  );
}

export function SpesifikasiFields({
  value,
  onChange,
  disabled,
}: {
  value: SpesifikasiCetak;
  onChange: (v: SpesifikasiCetak) => void;
  disabled?: boolean;
}) {
  const fields: { key: keyof SpesifikasiCetak; label: string; placeholder: string }[] = [
    { key: "jumlah", label: "Jumlah", placeholder: "Contoh: 500 lembar" },
    { key: "ukuran", label: "Ukuran", placeholder: "Contoh: A4 / 9 x 5,5 cm" },
    { key: "bahan", label: "Bahan", placeholder: "Contoh: Art Paper 260 gsm" },
    { key: "finishing", label: "Finishing", placeholder: "Contoh: Laminasi doff, 2 sisi" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <Label htmlFor={`spek-${f.key}`}>{f.label}</Label>
          <Input
            id={`spek-${f.key}`}
            value={value[f.key] ?? ""}
            placeholder={f.placeholder}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

function SpesifikasiForm({
  awal,
  isSubmitting,
  runAction,
  onDone,
}: {
  awal?: SpesifikasiCetak;
  isSubmitting: boolean;
  runAction: RunAction;
  onDone: () => void;
}) {
  const [value, setValue] = useState<SpesifikasiCetak>(awal ?? {});
  const submit = async () => {
    const ok = await runAction("ubah_spesifikasi", { spesifikasi: value }, "Spesifikasi cetak disimpan.");
    if (ok) onDone();
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>Spesifikasi Cetak</DialogTitle>
        <DialogDescription>Bisa diubah sampai Review Design disetujui.</DialogDescription>
      </DialogHeader>
      <SpesifikasiFields value={value} onChange={setValue} />
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Batal
        </Button>
        <SubmitButton loading={isSubmitting} onClick={submit}>
          Simpan
        </SubmitButton>
      </DialogFooter>
    </>
  );
}
