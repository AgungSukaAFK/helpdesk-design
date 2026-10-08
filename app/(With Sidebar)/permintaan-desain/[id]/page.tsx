"use client";

import { Content } from "@/components/content";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  allowedActions,
  canEditPermintaan,
  normalizeStatus,
  STATUS_LIST,
  STATUS_META,
  type PermintaanStatus,
  type Role,
  type WorkflowAction,
} from "@/lib/permintaan-workflow";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Hand,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  RotateCcw,
  Send,
  Star,
  Trash2,
  UploadCloud,
  User,
  ShieldCheck,
  RefreshCw,
  Quote,
  Hourglass,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// --- TIPE DATA ---

interface FileItem {
  name: string;
  url: string;
}

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role: string;
}

interface KomentarItem {
  id: number;
  created_at: string;
  message: string;
  user_id: string;
  user_name?: string;
  sender_role?: string;
}

interface RiwayatItem {
  id: string;
  created_at: string;
  status_from: string | null;
  status_to: string;
  changed_by: string | null;
  changed_by_name: string | null;
  catatan: string | null;
}

interface PermintaanDetail {
  id: string;
  judul: string;
  deskripsi: string;
  project: string;
  status: string;
  due_date: string;
  created_at: string;
  updated_at?: string;
  requester: string;
  requester_data?: UserProfile;
  admin?: string | null;
  admin_data?: UserProfile;
  files?: FileItem[] | null;
  rating?: string | number | null;
  review?: string | null;
  departemen?: string;
  progress_at?: string | null;
  review_at?: string | null;
  revision_at?: string | null;
  revision_count?: number | null;
  done_at?: string | null;
  riwayat?: RiwayatItem[];
}

// --- HELPER FORMAT ---

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

const fmtDate = (iso?: string | null, long = false) =>
  iso
    ? new Date(iso).toLocaleDateString("id-ID", {
        weekday: long ? "long" : undefined,
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[normalizeStatus(status)];
  return <Badge className={cn("font-medium", meta.badgeClass)}>{meta.label}</Badge>;
}

// Teks untuk entri riwayat (audit timeline)
function riwayatLabel(r: RiwayatItem, revisionNo: number) {
  if (!r.status_from && r.status_to === "TO DO") return "Permintaan dibuat";
  switch (r.status_to) {
    case "PROGRESS":
      return r.status_from === "TO DO" || !r.status_from
        ? "Mulai dikerjakan"
        : "Kembali dikerjakan";
    case "REVIEW":
      return "Hasil dikirim untuk review";
    case "REVISION":
      return `Revisi ke-${revisionNo} diajukan`;
    case "DONE":
      return "Diterima & selesai";
    case "TO DO":
      return "Dikembalikan ke antrean";
    default:
      return `Status → ${r.status_to}`;
  }
}

export default function DetailPermintaanPage() {
  const params = useParams();
  const s = createClient();
  const id = params.id as string;

  // State Data Utama
  const [data, setData] = useState<PermintaanDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Dialog aksi alur kerja
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  // Override status oleh admin (konfirmasi)
  const [pendingStatus, setPendingStatus] = useState<string>("");

  // State Diskusi
  const [komentar, setKomentar] = useState<KomentarItem[]>([]);
  const [pesanBaru, setPesanBaru] = useState("");
  const [loadingKomentar, setLoadingKomentar] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // State Upload
  const [isUploading, setIsUploading] = useState(false);

  // --- FETCH DATA ---

  const fetchAllData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await s.auth.getUser();

      if (user) {
        const { data: myProfile } = await s
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        setCurrentUser(myProfile || null);
      }

      // Detail via API (bypass RLS, sekaligus riwayat status)
      const res = await fetch(`/api/permintaan?id=${id}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.data) {
        throw new Error("Data permintaan tidak ditemukan");
      }

      setData({
        ...json.data,
        files: Array.isArray(json.data.files) ? json.data.files : [],
      });
    } catch (e: any) {
      toast.error("Gagal memuat data: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchKomentar = useCallback(async (reqId: string) => {
    setLoadingKomentar(true);
    const { data: chatData, error } = await s
      .from("komentar")
      .select(
        `
        id, created_at, message, user_id,
        user_profiles ( name, role )
      `,
      )
      .eq("permintaan_id", reqId)
      .order("created_at", { ascending: true });

    if (!error && chatData) {
      setKomentar(
        chatData.map((c: any) => ({
          id: c.id,
          created_at: c.created_at,
          message: c.message,
          user_id: c.user_id,
          user_name: c.user_profiles?.name || "Unknown",
          sender_role: c.user_profiles?.role || "user",
        })),
      );
      // Scroll hanya di dalam panel chat, bukan seluruh halaman
      setTimeout(() => {
        const el = chatScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 100);
    }
    setLoadingKomentar(false);
  }, []);

  useEffect(() => {
    if (id) {
      fetchAllData();
      fetchKomentar(id);
    }
  }, [id, fetchAllData, fetchKomentar]);

  const handleRefreshData = async () => {
    const toastId = toast.loading("Menyegarkan data...");
    await Promise.all([fetchAllData(), fetchKomentar(id)]);
    toast.success("Data diperbarui", { id: toastId });
  };

  // --- AKSI ALUR KERJA (semua lewat server) ---

  const runAction = async (
    action: WorkflowAction,
    payload: Record<string, unknown> = {},
    successMessage: string,
  ) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/permintaan/${id}/aksi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success(successMessage);
      await Promise.all([fetchAllData(), fetchKomentar(id)]);
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmbil = () => runAction("ambil", {}, "Permintaan diambil. Selamat mengerjakan!");

  const handleKirimReview = async () => {
    const ok = await runAction(
      "kirim_review",
      { note: reviewNote },
      "Hasil dikirim. Menunggu review dari peminta.",
    );
    if (ok) {
      setIsSubmitReviewOpen(false);
      setReviewNote("");
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNote.trim()) {
      toast.warning("Isi catatan revisi terlebih dahulu.");
      return;
    }
    const ok = await runAction(
      "revisi",
      { note: revisionNote },
      "Revisi dikirim ke desainer.",
    );
    if (ok) {
      setIsRevisionOpen(false);
      setRevisionNote("");
    }
  };

  const handleFinish = async () => {
    const isOwner = data?.requester === currentUser?.id;
    if (isOwner && rating === 0) {
      toast.warning("Berikan rating bintang terlebih dahulu.");
      return;
    }
    const ok = await runAction(
      "selesai",
      { rating: rating || undefined, review: reviewText },
      "Permintaan selesai. Terima kasih!",
    );
    if (ok) setIsFinishOpen(false);
  };

  const handleOverrideStatus = async () => {
    const target = pendingStatus;
    setPendingStatus("");
    await runAction(
      "ubah_status",
      { status: target },
      `Status diubah menjadi ${STATUS_META[normalizeStatus(target)].label}`,
    );
  };

  // --- FILE ---

  const handleDeleteFile = async (fileToDelete: FileItem) => {
    if (!data || !window.confirm(`Hapus file ${fileToDelete.name}?`)) return;

    setIsDeleting(fileToDelete.name);
    try {
      const updatedFiles = (data.files || []).filter(
        (f) => f.name !== fileToDelete.name,
      );
      const { error } = await s
        .from("permintaan")
        .update({ files: updatedFiles })
        .eq("id", id);
      if (error) throw error;

      toast.success("File dihapus.");
      setData((prev) => (prev ? { ...prev, files: updatedFiles } : null));
    } catch (e: any) {
      toast.error("Gagal hapus file: " + e.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !data) return;

    setIsUploading(true);
    const toastId = toast.loading("Mengunggah file...");

    const results = await Promise.all(
      Array.from(files).map(async (file) => {
        const filePath = `${id}/${Date.now()}_${file.name}`;
        const { error } = await s.storage.from("permintaan").upload(filePath, file);
        if (error) return null;
        const { data: urlData } = s.storage.from("permintaan").getPublicUrl(filePath);
        return { name: file.name, url: urlData.publicUrl };
      }),
    );
    const successfulUploads = results.filter((r): r is FileItem => r !== null);

    if (successfulUploads.length > 0) {
      const newFilesList = [...(data.files || []), ...successfulUploads];
      const { error: dbError } = await s
        .from("permintaan")
        .update({ files: newFilesList })
        .eq("id", id);

      if (dbError) {
        toast.error("Gagal simpan ke database", { id: toastId });
      } else {
        toast.success("File berhasil diunggah", { id: toastId });
        setData((prev) => (prev ? { ...prev, files: newFilesList } : null));
      }
    } else {
      toast.error("Gagal mengunggah", { id: toastId });
    }

    setIsUploading(false);
    e.target.value = "";
  };

  // --- DISKUSI ---

  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pesanBaru.trim() || !currentUser) return;

    const tempMessage = pesanBaru;
    setPesanBaru("");

    const { error } = await s.from("komentar").insert({
      permintaan_id: id,
      user_id: currentUser.id,
      message: tempMessage,
    });

    if (error) {
      toast.error("Gagal kirim pesan");
      setPesanBaru(tempMessage);
    } else {
      await fetchKomentar(id);
    }
  };

  // --- RENDER ---

  if (loading) {
    return (
      <Content title="Memuat Data..." size="lg">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  if (!data) return <Content title="404" description="Data tidak ditemukan." />;

  const role: Role =
    currentUser?.role === "admin" || currentUser?.role === "designer"
      ? (currentUser.role as Role)
      : "user";
  const actor = { id: currentUser?.id || "", role };
  const status = normalizeStatus(data.status);
  const actions = allowedActions(data, actor);
  const isOwner = !!currentUser && data.requester === currentUser.id;
  const isPic = !!currentUser && data.admin === currentUser.id;
  const canEdit = !!currentUser && canEditPermintaan(data, actor);
  const canUpload = role === "admin" || isPic || isOwner;
  const canDeleteFile = role === "admin" || isPic;
  const fileCount = data.files?.length || 0;
  const revisionCount = data.revision_count ?? 0;

  const riwayat = data.riwayat || [];
  const revisions = riwayat.filter((r) => r.status_to === "REVISION");

  const isOverdue =
    status !== "DONE" && data.due_date && new Date(data.due_date) < new Date();

  return (
    <Content
      title="Detail Permintaan Desain"
      size="lg"
      cardAction={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshData}
            title="Muat ulang data"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/permintaan-desain/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/permintaan-desain">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Link>
          </Button>
        </div>
      }
    >
      {/* Konfirmasi override status (admin) */}
      <AlertDialog
        open={!!pendingStatus}
        onOpenChange={(open) => !open && setPendingStatus("")}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ubah status secara manual?</AlertDialogTitle>
            <AlertDialogDescription>
              Status akan diubah dari <b>{STATUS_META[status].label}</b> menjadi{" "}
              <b>{pendingStatus && STATUS_META[normalizeStatus(pendingStatus)].label}</b>{" "}
              tanpa melalui alur normal. Perubahan ini tercatat di audit timeline
              dan peminta akan diberi notifikasi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverrideStatus}>
              Ya, Ubah Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Ajukan revisi */}
      <Dialog open={isRevisionOpen} onOpenChange={setIsRevisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan Revisi {revisionCount > 0 && `ke-${revisionCount + 1}`}</DialogTitle>
            <DialogDescription>
              Jelaskan bagian yang perlu diperbaiki. Desainer akan langsung
              mendapat notifikasi dan status berubah menjadi &quot;Sedang
              Direvisi&quot;.
              {status === "DONE" &&
                " Permintaan yang sudah selesai akan dibuka kembali dan rating sebelumnya dihapus."}
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="revision-note">Detail perbaikan</Label>
          <Textarea
            id="revision-note"
            placeholder="Contoh: Ubah warna font menjadi biru, logo diperbesar sedikit..."
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRevisionOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleRequestRevision} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Revisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Terima hasil & rating */}
      <Dialog open={isFinishOpen} onOpenChange={setIsFinishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terima Hasil & Beri Rating</DialogTitle>
            <DialogDescription>
              Permintaan akan ditandai selesai. Jika nanti masih ada yang perlu
              diubah, Anda tetap bisa mengajukan revisi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <Label>Seberapa puas Anda dengan hasil desain ini?</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`${star} bintang`}
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors hover:scale-110",
                      star <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="w-full">
              <Label htmlFor="review-text">Ulasan / masukan (opsional)</Label>
              <Textarea
                id="review-text"
                placeholder="Tulis ulasan Anda..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsFinishOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleFinish}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Terima & Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Kirim untuk review (desainer) */}
      <Dialog open={isSubmitReviewOpen} onOpenChange={setIsSubmitReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kirim Hasil untuk Review</DialogTitle>
            <DialogDescription>
              Peminta akan diberi notifikasi untuk mengecek hasil, lalu memilih
              menerima atau mengajukan revisi.
            </DialogDescription>
          </DialogHeader>
          {fileCount === 0 && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              Belum ada file lampiran. Pastikan hasil sudah diunggah atau
              tuliskan lokasi file di catatan.
            </div>
          )}
          <Label htmlFor="review-note">Catatan untuk peminta (opsional)</Label>
          <Textarea
            id="review-note"
            placeholder="Contoh: Sudah saya buat 2 alternatif warna, silakan dipilih."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSubmitReviewOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleKirimReview} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim untuk Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* HEADER + STEPPER */}
        <div className="border rounded-lg p-5 bg-card shadow-sm space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold break-words">{data.judul}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline">{data.project}</Badge>
                {data.departemen && <Badge variant="secondary">{data.departemen}</Badge>}
                {revisionCount > 0 && (
                  <Badge
                    variant="outline"
                    className="border-rose-500/40 text-rose-700 dark:text-rose-400"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> {revisionCount}× revisi
                  </Badge>
                )}
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          <WorkflowStepper status={status} data={data} />
        </div>

        {/* LANGKAH SELANJUTNYA */}
        <NextStepPanel
          status={status}
          data={data}
          role={role}
          isOwner={isOwner}
          isPic={isPic}
          actions={actions}
          fileCount={fileCount}
          isSubmitting={isSubmitting}
          canEdit={canEdit}
          onAmbil={handleAmbil}
          onKirimReview={() => setIsSubmitReviewOpen(true)}
          onRevisi={() => setIsRevisionOpen(true)}
          onSelesai={() => setIsFinishOpen(true)}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* KOLOM KIRI */}
          <div className="lg:col-span-2 space-y-6">
            {/* Catatan revisi terbaru */}
            {revisions.length > 0 && (status === "REVISION" || status === "REVIEW") && (
              <div className="border border-rose-500/30 rounded-lg p-5 bg-rose-500/5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <RotateCcw className="h-4 w-4" /> Catatan Revisi Terbaru (ke-
                  {revisions.length})
                </h3>
                <p className="text-sm whitespace-pre-wrap">
                  {revisions[revisions.length - 1].catatan || "Tidak ada catatan."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Diajukan {revisions[revisions.length - 1].changed_by_name ?? ""} ·{" "}
                  {fmtDateTime(revisions[revisions.length - 1].created_at)}
                </p>
              </div>
            )}

            {/* Rating jika selesai */}
            {status === "DONE" && data.rating && (
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-lg">{data.rating} / 5</span>
                  <span className="text-muted-foreground text-sm ml-1">
                    • Penilaian peminta
                  </span>
                </div>
                {data.review ? (
                  <div className="flex gap-2 items-start">
                    <Quote className="h-4 w-4 text-muted-foreground rotate-180 shrink-0 mt-1" />
                    <p className="text-sm italic text-muted-foreground">{data.review}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Tidak ada ulasan tertulis.
                  </p>
                )}
              </div>
            )}

            {/* Deskripsi */}
            <div className="border rounded-lg p-5 bg-card shadow-sm space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" /> Deskripsi Kebutuhan
              </h3>
              <div className="text-sm p-4 bg-muted/30 rounded-md whitespace-pre-wrap leading-relaxed">
                {data.deskripsi || "-"}
              </div>
            </div>

            {/* Lampiran */}
            <div className="border rounded-lg p-5 bg-card shadow-sm space-y-3">
              <div className="flex justify-between items-center gap-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Lampiran & Hasil Desain
                  <span className="text-xs font-normal text-muted-foreground">
                    ({fileCount})
                  </span>
                </h3>
                {canUpload && (
                  <div>
                    <Input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      multiple
                      onChange={handleUpload}
                      disabled={isUploading}
                    />
                    <Button variant="outline" size="sm" asChild disabled={isUploading}>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        {isUploading ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        ) : (
                          <UploadCloud className="h-3 w-3 mr-2" />
                        )}
                        {isOwner && !isPic ? "Tambah Referensi" : "Upload Hasil"}
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              {fileCount > 0 ? (
                <ul className="divide-y border rounded-md">
                  {data.files!.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-3 px-3 py-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 min-w-0 truncate text-sm" title={f.name}>
                        {f.name}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(f.url, "_blank")}
                        title="Unduh"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canDeleteFile && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFile(f)}
                          disabled={isDeleting === f.name}
                          title="Hapus"
                        >
                          {isDeleting === f.name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center p-6 border border-dashed rounded-md text-muted-foreground text-sm">
                  Belum ada file.
                </div>
              )}
            </div>

            {/* Diskusi */}
            <div className="border rounded-lg bg-card shadow-sm flex flex-col h-[500px]">
              <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Diskusi
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => fetchKomentar(id)}
                  title="Muat ulang chat"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50"
              >
                {loadingKomentar && komentar.length === 0 ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-muted-foreground" />
                  </div>
                ) : komentar.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-10 opacity-60">
                    Belum ada diskusi. Gunakan kolom di bawah untuk bertanya
                    atau memberi info tambahan.
                  </div>
                ) : (
                  komentar.map((k) => {
                    const isMe = k.user_id === currentUser?.id;
                    const isSystem = k.message.startsWith("[SYSTEM]");
                    if (isSystem) {
                      return (
                        <div key={k.id} className="flex justify-center">
                          <div className="max-w-[90%] rounded-full border bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
                            {k.message.replace(/^\[SYSTEM\]\s*/, "")}
                            <span className="ml-2 opacity-70">
                              {fmtDateTime(k.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={k.id}
                        className={cn("flex gap-3 max-w-[85%]", isMe && "ml-auto flex-row-reverse")}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className={cn(
                              "text-xs",
                              isMe && "bg-primary text-primary-foreground",
                            )}
                          >
                            {k.user_name?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            "p-3 rounded-lg text-sm shadow-sm",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-tr-none"
                              : "bg-white dark:bg-slate-800 border rounded-tl-none",
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1 opacity-80 text-xs font-medium">
                            <span>{k.user_name}</span>
                            {(k.sender_role === "admin" || k.sender_role === "designer") && (
                              <Badge variant="secondary" className="h-4 px-1 text-[9px] uppercase">
                                {k.sender_role}
                              </Badge>
                            )}
                            <span className="font-normal text-[10px] opacity-70">
                              {fmtDateTime(k.created_at)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{k.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t bg-card">
                <form onSubmit={handleSendComment} className="flex gap-2">
                  <Input
                    placeholder="Ketik pesan..."
                    value={pesanBaru}
                    onChange={(e) => setPesanBaru(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!pesanBaru.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="space-y-6">
            {/* Info */}
            <div className="border rounded-lg p-5 bg-card shadow-sm space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Info Permintaan
              </h3>

              <InfoRow icon={Calendar} label="Deadline">
                <span className={cn(isOverdue && "text-destructive")}>
                  {fmtDate(data.due_date, true)}
                </span>
                {isOverdue && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">
                    Lewat deadline
                  </Badge>
                )}
              </InfoRow>

              <Separator />

              <InfoRow icon={User} label="Peminta">
                {data.requester_data?.name || "-"}
                {isOwner && <span className="text-xs text-muted-foreground"> (Anda)</span>}
                {data.requester_data?.email && (
                  <p className="text-xs font-normal text-muted-foreground">
                    {data.requester_data.email}
                  </p>
                )}
              </InfoRow>

              <InfoRow icon={ShieldCheck} label="Desainer (PIC)">
                {data.admin_data ? (
                  <>
                    {data.admin_data.name}
                    {isPic && <span className="text-xs text-muted-foreground"> (Anda)</span>}
                  </>
                ) : (
                  <span className="text-amber-600">Belum ada</span>
                )}
              </InfoRow>

              {actions.includes("ubah_status") && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Override status (khusus admin)
                    </Label>
                    <Select
                      value={status}
                      onValueChange={(v) => v !== status && setPendingStatus(v)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="bg-background">
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
                    <p className="text-[11px] text-muted-foreground">
                      Gunakan hanya jika alur normal tidak memungkinkan.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Audit timeline */}
            <AuditTimeline data={data} riwayat={riwayat} />
          </div>
        </div>
      </div>
    </Content>
  );
}

// ===================== KOMPONEN PENDUKUNG =====================

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-primary shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="font-medium text-sm">{children}</div>
      </div>
    </div>
  );
}

const STEPS: { key: PermintaanStatus; title: string; atKey: keyof PermintaanDetail }[] = [
  { key: "TO DO", title: "Diajukan", atKey: "created_at" },
  { key: "PROGRESS", title: "Dikerjakan", atKey: "progress_at" },
  { key: "REVIEW", title: "Review Peminta", atKey: "review_at" },
  { key: "DONE", title: "Selesai", atKey: "done_at" },
];

function WorkflowStepper({
  status,
  data,
}: {
  status: PermintaanStatus;
  data: PermintaanDetail;
}) {
  // REVISION berada di tahap "Dikerjakan" (desainer memperbaiki)
  const currentIdx =
    status === "REVISION" ? 1 : STEPS.findIndex((st) => st.key === status);
  const revisionCount = data.revision_count ?? 0;

  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx || status === "DONE";
        const active = idx === currentIdx && status !== "DONE";
        const at = data[step.atKey] as string | null | undefined;
        const isRevisionStep = idx === 1 && status === "REVISION";
        return (
          <li key={step.key} className="flex flex-col items-center text-center gap-1.5">
            <div className="flex w-full items-center">
              <div className={cn("h-0.5 flex-1", idx === 0 ? "invisible" : done || active ? "bg-primary" : "bg-border")} />
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && !isRevisionStep && "border-primary text-primary ring-4 ring-primary/15",
                  isRevisionStep && "border-rose-500 text-rose-600 ring-4 ring-rose-500/15",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : isRevisionStep ? <RotateCcw className="h-4 w-4" /> : idx + 1}
              </div>
              <div className={cn("h-0.5 flex-1", idx === STEPS.length - 1 ? "invisible" : done ? "bg-primary" : "bg-border")} />
            </div>
            <span className={cn("text-xs font-medium", !done && !active && "text-muted-foreground")}>
              {isRevisionStep ? `Revisi ke-${revisionCount}` : step.title}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {isRevisionStep
                ? fmtDateTime(data.revision_at)
                : done || active
                  ? at
                    ? fmtDateTime(at)
                    : ""
                  : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function NextStepPanel({
  status,
  data,
  role,
  isOwner,
  isPic,
  actions,
  fileCount,
  isSubmitting,
  canEdit,
  onAmbil,
  onKirimReview,
  onRevisi,
  onSelesai,
}: {
  status: PermintaanStatus;
  data: PermintaanDetail;
  role: Role;
  isOwner: boolean;
  isPic: boolean;
  actions: WorkflowAction[];
  fileCount: number;
  isSubmitting: boolean;
  canEdit: boolean;
  onAmbil: () => void;
  onKirimReview: () => void;
  onRevisi: () => void;
  onSelesai: () => void;
}) {
  const designerName = data.admin_data?.name || "Desainer";
  const requesterName = data.requester_data?.name || "Peminta";
  const isWorker = isPic || role === "admin";

  // Pesan yang menjelaskan "sekarang menunggu siapa & harus apa"
  let tone: "action" | "wait" | "done" = "wait";
  let title = "";
  let description = "";

  if (status === "TO DO") {
    if (actions.includes("ambil")) {
      tone = "action";
      title = "Permintaan ini belum ada yang mengerjakan";
      description = "Ambil permintaan untuk mulai mengerjakan. Peminta akan diberi notifikasi.";
    } else {
      title = "Menunggu desainer mengambil permintaan";
      description = isOwner
        ? "Selama belum dikerjakan, Anda masih bisa mengedit detail permintaan."
        : "Permintaan masih di antrean.";
    }
  } else if (status === "PROGRESS" || status === "REVISION") {
    const revisi = status === "REVISION";
    if (isWorker && actions.includes("kirim_review")) {
      tone = "action";
      title = revisi ? "Kerjakan revisi dari peminta" : "Sedang Anda kerjakan";
      description =
        "Upload file hasil di bagian Lampiran, lalu klik \"Kirim untuk Review\" agar peminta bisa mengecek.";
    } else {
      title = revisi
        ? `${designerName} sedang mengerjakan revisi`
        : `${designerName} sedang mengerjakan`;
      description = isOwner
        ? revisi
          ? "Anda akan diberi notifikasi saat hasil revisi dikirim. Jika ada tambahan, tulis di Diskusi."
          : "Anda akan diberi notifikasi saat hasil dikirim. Jika sudah ada hasil sementara dan perlu perbaikan, Anda bisa langsung mengajukan revisi."
        : "";
    }
  } else if (status === "REVIEW") {
    if (isOwner) {
      tone = "action";
      title = "Hasil siap — giliran Anda mengecek";
      description = `Cek file di bagian Lampiran${fileCount ? ` (${fileCount} file)` : ""}. Terima jika sudah sesuai, atau ajukan revisi jika masih perlu perbaikan.`;
    } else {
      title = `Menunggu ${requesterName} mengecek hasil`;
      description = "Peminta akan menerima hasil atau mengajukan revisi.";
    }
  } else {
    tone = "done";
    title = "Permintaan selesai";
    description = isOwner
      ? "Jika ternyata masih ada yang perlu diubah, Anda bisa mengajukan revisi untuk membuka kembali permintaan ini."
      : "Hasil sudah diterima oleh peminta.";
  }

  const Icon = tone === "done" ? CheckCircle2 : tone === "action" ? Hand : Hourglass;

  const showRevisi = actions.includes("revisi") && (isOwner || role === "admin");
  const showSelesai = actions.includes("selesai") && (isOwner || role === "admin");

  return (
    <div
      className={cn(
        "rounded-lg border p-5 flex flex-col md:flex-row md:items-center gap-4",
        tone === "action" && "border-primary/40 bg-primary/5",
        tone === "wait" && "bg-muted/40",
        tone === "done" && "border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      <div className="flex gap-3 flex-1 min-w-0">
        <Icon
          className={cn(
            "h-5 w-5 shrink-0 mt-0.5",
            tone === "action" && "text-primary",
            tone === "wait" && "text-muted-foreground",
            tone === "done" && "text-emerald-600",
          )}
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Langkah selanjutnya
          </p>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        {actions.includes("ambil") && (
          <Button onClick={onAmbil} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ambil Permintaan
          </Button>
        )}
        {actions.includes("kirim_review") && isWorker && (
          <Button onClick={onKirimReview} disabled={isSubmitting}>
            <Send className="mr-2 h-4 w-4" /> Kirim untuk Review
          </Button>
        )}
        {status === "TO DO" && isOwner && canEdit && (
          <Button variant="outline" asChild>
            <Link href={`/permintaan-desain/${data.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Permintaan
            </Link>
          </Button>
        )}
        {showRevisi && (
          <Button variant="outline" onClick={onRevisi} disabled={isSubmitting}>
            <RotateCcw className="mr-2 h-4 w-4" /> Ajukan Revisi
          </Button>
        )}
        {showSelesai && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onSelesai}
            disabled={isSubmitting}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isOwner ? "Terima Hasil" : "Tandai Selesai"}
          </Button>
        )}
      </div>
    </div>
  );
}

function AuditTimeline({
  data,
  riwayat,
}: {
  data: PermintaanDetail;
  riwayat: RiwayatItem[];
}) {
  // Data lama (sebelum riwayat dicatat): minimal tampilkan waktu dibuat
  const entries: RiwayatItem[] =
    riwayat.length > 0
      ? riwayat
      : [
          {
            id: "created",
            created_at: data.created_at,
            status_from: null,
            status_to: "TO DO",
            changed_by: data.requester,
            changed_by_name: data.requester_data?.name ?? null,
            catatan: null,
          },
        ];

  let revisionNo = 0;
  const rows = entries.map((r) => {
    if (r.status_to === "REVISION") revisionNo++;
    return { r, label: riwayatLabel(r, revisionNo) };
  });

  return (
    <div className="border rounded-lg p-5 bg-card shadow-sm space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <History className="h-4 w-4" /> Audit Timeline
      </h3>
      <ol className="relative space-y-4 border-l pl-5 ml-1.5">
        {rows.map(({ r, label }) => {
          const meta = STATUS_META[normalizeStatus(r.status_to)];
          return (
            <li key={r.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-card",
                  !r.status_from && r.status_to === "TO DO" ? "bg-blue-600" : meta.dotClass,
                )}
              />
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" /> {fmtDateTime(r.created_at)}
                {r.changed_by_name && <> · {r.changed_by_name}</>}
              </p>
              {r.catatan && (
                <p className="mt-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs whitespace-pre-wrap">
                  {r.catatan}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
